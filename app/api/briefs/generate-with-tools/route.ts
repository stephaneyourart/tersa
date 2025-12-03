import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/lib/database';
import { briefs, projectGenerationConfigs } from '@/schema';
import { eq } from 'drizzle-orm';
import { BRIEF_GENERATION_TOOLS } from '@/lib/brief-tools';
import {
  initGenerationSession,
  getSession,
  handleCreateProjectStructure,
  handleGenerateCharacterImage,
  handleGenerateLocationImage,
  handleCreateCollection,
  handleGenerateVideoPlan,
  handleSendToDavinci,
} from '@/lib/brief-tool-handlers';

/**
 * API pour générer un projet avec function calling (approche agentique)
 * L'IA orchestre elle-même la génération via des tool calls
 */
export async function POST(request: NextRequest) {
  const { briefId, projectName, config } = await request.json();

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Fonction helper pour envoyer des événements SSE
  const sendEvent = async (event: string, data: any) => {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    await writer.write(encoder.encode(message));
  };

  // Démarrer le traitement en arrière-plan
  (async () => {
    try {

      await sendEvent('status', { message: '🧠 Démarrage de l\'analyse...', step: 'init' });

      // Charger le brief
      const [brief] = await database
        .select()
        .from(briefs)
        .where(eq(briefs.id, briefId));

      if (!brief) {
        await sendEvent('error', { message: 'Brief non trouvé' });
        await writer.close();
        return;
      }

      // Charger les documents
      const { briefDocuments } = require('@/schema');
      const docs = await database.select().from(briefDocuments).where(eq(briefDocuments.briefId, briefId));
      
      // Construire le contexte
      let briefContext = `# BRIEF: ${brief.name}\n\n`;
      if (brief.description) {
        briefContext += `## Description\n${brief.description}\n\n`;
      }
      briefContext += `## Documents\n\n`;
      for (const doc of docs) {
        if (doc.content) {
          briefContext += `### ${doc.name}\n${doc.content}\n\n`;
        }
      }

      // Créer le projet (mode local)
      const { createLocalProject } = await import('@/lib/local-projects-store');
      const project = createLocalProject(projectName);
      
      if (!project) {
        throw new Error('Erreur création projet local');
      }

      const projectId = project.id;
      
      // Initialiser la session
      initGenerationSession(projectId);

      await sendEvent('status', { message: '🤖 GPT-5.1 analyse le brief...', step: 'analyzing' });

      // Appeler GPT-5.1 avec function calling
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY non configuré');
      }

      const systemMessage = config.systemPrompt + `\n\nTu as accès à des outils pour générer le projet. Utilise-les dans cet ordre :
1. create_project_structure() - Définir la structure
2. generate_character_image() - Pour chaque personnage (4 angles)
3. generate_location_image() - Pour chaque lieu
4. create_collection() - Grouper les images
5. generate_video_plan() - Pour chaque plan
6. send_videos_to_davinci() - Export final`;

      let messages: any[] = [
        { role: 'system', content: systemMessage },
        { role: 'user', content: briefContext },
      ];

      let toolCallCount = 0;
      const maxIterations = 100; // Limite de sécurité

      while (toolCallCount < maxIterations) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: config.aiModel,
            messages,
            tools: BRIEF_GENERATION_TOOLS,
            tool_choice: 'auto',
            stream: true, // ACTIVER LE STREAMING
            stream_options: {
              include_usage: true,
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`OpenAI error: ${response.statusText}`);
        }

        // Lire le stream SSE de OpenAI
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Pas de reader');
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let currentMessage: any = {
          role: 'assistant',
          content: '',
          tool_calls: [],
        };
        let currentToolCall: any = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim() || line === 'data: [DONE]') continue;
            if (!line.startsWith('data: ')) continue;

            try {
              const data = JSON.parse(line.slice(6));
              const delta = data.choices?.[0]?.delta;

              if (!delta) continue;

              // Stream du contenu (raisonnement)
              if (delta.content) {
                currentMessage.content += delta.content;
                // ENVOYER LE RAISONNEMENT EN TEMPS RÉEL
                await sendEvent('reasoning_stream', { chunk: delta.content });
              }

              // Tool calls
              if (delta.tool_calls) {
                for (const toolCallDelta of delta.tool_calls) {
                  const index = toolCallDelta.index;
                  
                  if (!currentMessage.tool_calls[index]) {
                    currentMessage.tool_calls[index] = {
                      id: toolCallDelta.id || '',
                      type: 'function',
                      function: {
                        name: toolCallDelta.function?.name || '',
                        arguments: '',
                      },
                    };
                  }

                  if (toolCallDelta.function?.name) {
                    currentMessage.tool_calls[index].function.name = toolCallDelta.function.name;
                  }
                  if (toolCallDelta.function?.arguments) {
                    currentMessage.tool_calls[index].function.arguments += toolCallDelta.function.arguments;
                  }
                  if (toolCallDelta.id) {
                    currentMessage.tool_calls[index].id = toolCallDelta.id;
                  }
                }
              }
            } catch (e) {
              console.error('Erreur parse SSE OpenAI:', e);
            }
          }
        }

        const message = currentMessage;

        // Si pas de tool calls, on a fini
        if (!message.tool_calls || message.tool_calls.length === 0) {
          await sendEvent('status', { message: '✅ Génération terminée !', step: 'done' });
          break;
        }

        // Ajouter le message de l'assistant
        messages.push(message);

        // Exécuter les tool calls
        const toolResults: any[] = [];

        for (const toolCall of message.tool_calls) {
          const toolName = toolCall.function.name;
          const toolParams = JSON.parse(toolCall.function.arguments);

          await sendEvent('tool_call', {
            toolName,
            params: toolParams,
          });

          let result;

          switch (toolName) {
            case 'create_project_structure':
              result = await handleCreateProjectStructure(toolParams, projectId);
              break;
            case 'generate_character_image':
              result = await handleGenerateCharacterImage(toolParams, projectId, config.settings?.imageModel || 'nanobanana-pro');
              break;
            case 'generate_location_image':
              result = await handleGenerateLocationImage(toolParams, projectId, config.settings?.imageModel || 'nanobanana-pro');
              break;
            case 'create_collection':
              result = await handleCreateCollection(toolParams, projectId);
              break;
            case 'generate_video_plan':
              if (config.generateMediaDirectly) {
                result = await handleGenerateVideoPlan(toolParams, projectId, config.settings?.videoModel || 'kling-o1');
              } else {
                result = { success: true, data: { message: 'Vidéo ajoutée (génération manuelle)' } };
              }
              break;
            case 'send_videos_to_davinci':
              result = await handleSendToDavinci(toolParams, projectId);
              break;
            default:
              result = { success: false, error: `Tool inconnu: ${toolName}` };
          }

          await sendEvent('tool_result', {
            toolName,
            success: result.success,
            data: result.data,
            error: result.error,
          });

          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: toolName,
            content: JSON.stringify(result),
          });

          toolCallCount++;
        }

        // Ajouter les résultats des tools
        messages.push(...toolResults);
      }

      await sendEvent('complete', { projectId });
      await writer.close();
    } catch (error: any) {
      console.error('[Generate Tools] Erreur:', error);
      await sendEvent('error', { message: error.message });
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

