/**
 * API de génération de projet à partir d'un brief
 * 
 * Flow en 3 phases :
 * 1. Analyse du brief avec GPT-5.1 → JSON structuré
 * 2. Création du projet + nœuds canvas
 * 3. (Optionnel) Génération des médias
 * 
 * Streaming SSE pour afficher le raisonnement en temps réel
 */

import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import type { GeneratedProjectStructure } from '@/types/generated-project';
import { generateCanvasFromProject } from '@/lib/brief-canvas-generator';

// ========== SYSTEM PROMPT ==========
const SYSTEM_PROMPT_ANALYSIS = `Tu es un assistant expert en création de vidéos et scénarios.
Tu analyses des briefs créatifs et génères une structure de projet complète.

## Ta mission
Analyser le brief fourni et générer un JSON structuré contenant :
- Les personnages avec leurs descriptions et prompts d'images
- Les lieux avec leurs descriptions et prompts d'angles
- Les scènes découpées en plans numérotés

## Format de sortie OBLIGATOIRE
Tu DOIS retourner UNIQUEMENT un JSON valide (pas de markdown, pas de commentaires) avec cette structure exacte :

{
  "title": "Titre du projet",
  "synopsis": "Synopsis général du projet (2-3 phrases)",
  "characters": [
    {
      "id": "perso-prenom",
      "name": "Prénom",
      "description": "Description complète du personnage",
      "referenceCode": "[PERSO:Prénom]",
      "prompts": {
        "face": "Prompt pour portrait frontal...",
        "profile": "Prompt pour portrait de profil...",
        "fullBody": "Prompt pour photo en pied de face...",
        "back": "Prompt pour photo de dos..."
      }
    }
  ],
  "locations": [
    {
      "id": "lieu-nom",
      "name": "Nom du lieu",
      "description": "Description complète du lieu",
      "referenceCode": "[LIEU:Nom]",
      "prompts": {
        "angle1": "Prompt pour vue principale...",
        "angle2": "Prompt pour vue alternative...",
        "angle3": "Prompt pour vue détail/ambiance..."
      }
    }
  ],
  "scenes": [
    {
      "id": "scene-1",
      "sceneNumber": 1,
      "title": "Titre de la scène",
      "description": "Description/synopsis de la scène",
      "plans": [
        {
          "id": "plan-1-1",
          "planNumber": 1,
          "prompt": "Prompt détaillé pour la génération vidéo...",
          "characterRefs": ["perso-prenom"],
          "locationRef": "lieu-nom",
          "duration": 5,
          "cameraMovement": "Description du mouvement de caméra",
          "notes": "Notes additionnelles optionnelles"
        }
      ]
    }
  ],
  "totalPlans": 4,
  "estimatedDuration": 60
}

## Règles pour les prompts
1. Chaque prompt doit être AUTONOME et COMPLET - ne jamais référencer d'autres éléments
2. Inclure tous les détails visuels nécessaires pour la génération
3. Pour les personnages : décrire vêtements, posture, expression, éclairage
4. Pour les lieux : décrire décor, ambiance, éclairage, heure du jour
5. Pour les plans : décrire l'action, le cadrage, le mouvement, l'émotion

## Exemples de bons prompts
- Face: "Portrait frontal d'un homme de 35 ans aux cheveux bruns courts, yeux marron, sourire confiant, costume gris anthracite avec cravate bordeaux, fond neutre gris clair, éclairage studio professionnel, haute résolution"
- Lieu angle1: "Vue frontale d'un bureau moderne open space avec grandes baies vitrées donnant sur une ville au coucher du soleil, mobilier design blanc et chrome, plantes vertes, ambiance chaleureuse et professionnelle"
- Plan: "Jean (35 ans, costume gris) debout devant les baies vitrées du bureau moderne, dos à la caméra, regardant la ville au coucher du soleil, puis se retourne vers la caméra avec un sourire confiant, travelling avant lent"`;

const SYSTEM_PROMPT_TEST_MODE = `

## ⚠️ MODE TEST ACTIVÉ ⚠️
CONTRAINTES STRICTES À RESPECTER :
- Maximum 2 personnages
- Maximum 1 scène avec 2 plans maximum
- Chaque prompt doit faire MAXIMUM 3 PHRASES COURTES
- Descriptions simples et directes
- Ne pas détailler excessivement`;

// ========== HELPERS ==========
function sseEvent(type: string, data: Record<string, unknown>): string {
  return `data: ${JSON.stringify({ type, ...data })}\n\n`;
}

async function getBriefContent(briefId: string): Promise<{ title: string; content: string } | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/briefs/${briefId}`);
    if (!response.ok) return null;
    
    const data = await response.json();
    
    // Le brief est directement dans data (pas data.brief)
    const brief = data;
    
    // Construire le contenu du brief
    let content = '';
    
    // Ajouter la description du brief
    if (brief.description) {
      content += brief.description + '\n\n';
    }
    
    // Ajouter le contenu des documents texte
    if (brief.documents && Array.isArray(brief.documents)) {
      for (const doc of brief.documents) {
        if (doc.content) {
          content += `--- ${doc.name || 'Document'} ---\n${doc.content}\n\n`;
        }
      }
    }
    
    const finalContent = content.trim();
    
    return {
      title: brief.name || 'Projet sans titre',
      content: finalContent || 'Brief vide - génère un projet de démonstration simple avec 1 personnage et 1 plan de 5 secondes.',
    };
  } catch (error) {
    console.error('Erreur récupération brief:', error);
    return null;
  }
}

// ========== ROUTE HANDLER ==========
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  try {
    const body = await request.json();
    const { 
      briefId, 
      projectName: customProjectName,
      config,
      isTestMode = false,
    } = body;

    // Vérifier l'API key OpenAI
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY non configurée' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Récupérer le contenu du brief
    const briefData = await getBriefContent(briefId);
    if (!briefData) {
      return new Response(JSON.stringify({ error: 'Brief non trouvé' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const projectName = customProjectName || `${briefData.title} v1`;

    // Créer le stream SSE
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // ========== PHASE 1 : ANALYSE ==========
          controller.enqueue(encoder.encode(sseEvent('phase_start', { 
            phase: 'analysis',
            message: '🧠 Phase 1 : Analyse du brief avec GPT-5.1...',
          })));

          const openai = new OpenAI({ apiKey });
          
          // Construire le system prompt
          let systemPrompt = config?.systemPrompt || SYSTEM_PROMPT_ANALYSIS;
          if (isTestMode) {
            systemPrompt += SYSTEM_PROMPT_TEST_MODE;
          }

          // Appel GPT-5.1 avec streaming
          const completion = await openai.chat.completions.create({
            model: config?.aiModel || 'gpt-4o',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `Analyse ce brief et génère la structure du projet :\n\n${briefData.content}` },
            ],
            temperature: 0.7,
            stream: true,
          });

          let fullResponse = '';
          let reasoningContent = '';

          // Stream le raisonnement
          for await (const chunk of completion) {
            const delta = chunk.choices[0]?.delta;
            
            if (delta?.content) {
              fullResponse += delta.content;
              reasoningContent += delta.content;
              
              // Envoyer le chunk de raisonnement
              controller.enqueue(encoder.encode(sseEvent('reasoning', { 
                content: delta.content,
              })));
            }
          }

          controller.enqueue(encoder.encode(sseEvent('phase_complete', { 
            phase: 'analysis',
            message: '✅ Analyse terminée',
          })));

          // Parser le JSON
          let projectStructure: GeneratedProjectStructure;
          try {
            // Extraire le JSON de la réponse (au cas où il y aurait du texte autour)
            const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
              throw new Error('Aucun JSON trouvé dans la réponse');
            }
            projectStructure = JSON.parse(jsonMatch[0]);
            projectStructure.reasoning = reasoningContent;
          } catch (parseError) {
            console.error('Erreur parsing JSON:', parseError);
            controller.enqueue(encoder.encode(sseEvent('error', { 
              error: 'Erreur de parsing du JSON généré par l\'IA',
              details: fullResponse.substring(0, 500),
            })));
            controller.close();
            return;
          }

          // ========== PHASE 2 : CRÉATION CANVAS ==========
          controller.enqueue(encoder.encode(sseEvent('phase_start', { 
            phase: 'canvas_creation',
            message: '🎨 Phase 2 : Création du canvas...',
          })));

          // Générer les nœuds du canvas
          const canvasData = generateCanvasFromProject(projectStructure);
          
          // Extraire la séquence de génération pour plus tard (avec le projet pour les prompts)
          const { getGenerationSequence } = await import('@/lib/brief-canvas-generator');
          const generationSequence = getGenerationSequence(canvasData.structure, projectStructure);

          controller.enqueue(encoder.encode(sseEvent('progress', { 
            progress: 50,
            message: `📦 ${canvasData.nodes.length} nœuds créés`,
          })));
          
          controller.enqueue(encoder.encode(sseEvent('progress', { 
            progress: 60,
            message: `🔗 ${canvasData.edges.length} connexions créées`,
          })));

          // IMPORTANT: Le projet est créé côté CLIENT (localStorage)
          // L'API envoie les données, le client les stocke
          controller.enqueue(encoder.encode(sseEvent('project_data', { 
            projectName,
            canvasData: {
              nodes: canvasData.nodes,
              edges: canvasData.edges,
              viewport: canvasData.viewport,
            },
            projectStructure,
            generationSequence,
          })));

          controller.enqueue(encoder.encode(sseEvent('phase_complete', { 
            phase: 'canvas_creation',
            message: '✅ Canvas créé avec succès',
            nodeCount: canvasData.nodes.length,
            edgeCount: canvasData.edges.length,
          })));

          // ========== RÉSUMÉ FINAL ==========
          const summary = {
            projectName,
            characters: projectStructure.characters.length,
            locations: projectStructure.locations.length,
            scenes: projectStructure.scenes.length,
            plans: projectStructure.totalPlans,
            nodes: canvasData.nodes.length,
            edges: canvasData.edges.length,
            // Infos pour génération séquentielle
            imagesToGenerate: generationSequence.characterImages.reduce((acc, c) => acc + c.imageNodeIds.length, 0) +
                              generationSequence.locationImages.reduce((acc, l) => acc + l.imageNodeIds.length, 0),
            videosToGenerate: generationSequence.videos.length,
          };

          controller.enqueue(encoder.encode(sseEvent('complete', { 
            message: '🎉 Projet généré avec succès !',
            summary,
            generationSequence,
          })));

          controller.close();
        } catch (error: unknown) {
          console.error('Erreur génération:', error);
          controller.enqueue(encoder.encode(sseEvent('error', { 
            error: error instanceof Error ? error.message : 'Erreur inconnue',
          })));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: unknown) {
    console.error('Erreur API:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erreur inconnue' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

