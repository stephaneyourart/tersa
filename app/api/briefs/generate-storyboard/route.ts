/**
 * API de génération de storyboard à partir d'un synopsis
 * 
 * Utilise TOUJOURS mistral-large-latest pour transformer
 * un synopsis/brief créatif en storyboard détaillé
 * 
 * Streaming SSE pour afficher la réponse en temps réel
 */

import { NextRequest } from 'next/server';

// ========== SYSTEM PROMPT SYNOPSIS → STORYBOARD ==========
const SYSTEM_PROMPT_STORYBOARD = `Tu es un réalisateur et scénariste professionnel de films publicitaires, documentaires et films d'auteur.

Ta mission : transformer un synopsis ou une idée créative en un storyboard détaillé et professionnel.

## Format de sortie attendu

Tu dois produire un storyboard complet avec :

1. **Titre** : Un titre évocateur pour le projet
2. **Format** : Type de production (spot publicitaire, documentaire, court-métrage, etc.) + durée estimée
3. **Thème** : Le message central, l'essence du projet
4. **Tonalité** : L'atmosphère visuelle et émotionnelle (brut, poétique, épique, intimiste, etc.)

5. **Plans détaillés** (numérotés) : Pour chaque plan :
   - **Type de plan** (Extérieur/Intérieur – Jour/Nuit – Type de cadrage)
   - **Description visuelle** détaillée et immersive (italique pour l'action)
   - **Dialogues ou voix-off** si applicable (avec indication du personnage)
   - **Son/Ambiance** : Bruits, musique, silences
   - **Transitions** si nécessaire

6. **Notes d'intention** (à la fin) :
   - Direction artistique (couleurs, lumière, style)
   - Direction sonore (musique, silences, bruits réels)
   - Ton global et émotions recherchées
   - Pourquoi ce traitement fonctionne

## Règles importantes

- Sois **précis et visuel** : chaque plan doit être filmable
- Évite le cliché et la mièvrerie, sauf si explicitement demandé
- Respecte le ton demandé (documentaire, poétique, brut, etc.)
- Indique le nombre minimum de plans demandés si spécifié
- Les descriptions doivent être riches mais pas verbeuses
- Pense en termes de **montage** et de **rythme**

## Langue

Réponds TOUJOURS dans la même langue que le synopsis fourni.`;

// ========== HELPERS ==========
function sseEvent(type: string, data: Record<string, unknown>): string {
  return `data: ${JSON.stringify({ ...data, type })}\n\n`;
}

// ========== STREAMING MISTRAL ==========
async function* streamMistralStoryboard(
  synopsis: string
): AsyncGenerator<{ content?: string; done: boolean }> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error('MISTRAL_API_KEY non configurée');
  
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'mistral-large-latest',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_STORYBOARD },
        { role: 'user', content: synopsis },
      ],
      stream: true,
      temperature: 0.8, // Un peu de créativité
      max_tokens: 8000, // Storyboards peuvent être longs
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erreur Mistral API: ${response.status} - ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('Pas de reader disponible');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    
    if (value) {
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            yield { done: true };
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              yield { content, done: false };
            }
          } catch {
            // Ignorer les lignes mal formées
          }
        }
      }
    }

    if (done) {
      yield { done: true };
      return;
    }
  }
}

// ========== ROUTE HANDLER ==========
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(sseEvent(type, data)));
      };

      try {
        const { synopsis } = await request.json();
        
        if (!synopsis || typeof synopsis !== 'string' || synopsis.trim().length < 10) {
          send('error', { error: 'Synopsis trop court ou invalide (minimum 10 caractères)' });
          controller.close();
          return;
        }

        send('phase_start', { 
          phase: 'storyboard',
          message: '🎬 Génération du storyboard avec Mistral Large...\n\n'
        });

        let fullStoryboard = '';

        // Streaming de la réponse Mistral
        for await (const chunk of streamMistralStoryboard(synopsis.trim())) {
          if (chunk.content) {
            fullStoryboard += chunk.content;
            send('content', { content: chunk.content });
          }
          if (chunk.done) {
            break;
          }
        }

        send('complete', { 
          message: '\n\n✅ Storyboard généré !',
          storyboard: fullStoryboard
        });

      } catch (error: any) {
        console.error('[Storyboard] Erreur:', error);
        send('error', { error: error.message || 'Erreur lors de la génération du storyboard' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
