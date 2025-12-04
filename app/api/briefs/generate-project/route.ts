/**
 * API de génération de projet à partir d'un brief
 * 
 * Flow en 3 phases :
 * 1. Analyse du brief avec LLM (GPT-5.1 ou GPT-4o en mode test) → JSON structuré
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
// Import des configurations par défaut
import { 
  DEFAULT_CHARACTER_SYSTEM_PROMPT, 
  DEFAULT_DECOR_SYSTEM_PROMPT,
  DEFAULT_CHARACTER_VARIANT_PROMPTS,
  DEFAULT_DECOR_VARIANT_PROMPTS 
} from '@/lib/brief-defaults';

const SYSTEM_PROMPT_ANALYSIS = `Tu es un scénariste et réalisateur expert, doté d'une sensibilité littéraire et cinématographique aiguë.
Tu analyses des briefs créatifs et génères une structure de projet complète pour la production vidéo.

## ARCHITECTURE DU PROJET

### 1. PERSONNAGES - Descriptions exhaustives (SEUL ENDROIT)
Chaque personnage a UN prompt "primary" extrêmement détaillé décrivant son apparence physique complète.
C'est LE SEUL ENDROIT où les descriptions physiques apparaissent.

### 2. DÉCORS - Descriptions exhaustives (SEUL ENDROIT)  
Chaque décor a UN prompt "primary" extrêmement détaillé décrivant l'environnement complet.
C'est LE SEUL ENDROIT où les descriptions de décor apparaissent.

### 3. PLANS - Trois prompts distincts par plan

#### A. prompt (ACTION VIDÉO)
Ce prompt décrit l'ACTION, le MOUVEMENT, la PSYCHOLOGIE du plan.
Il sera utilisé pour animer la vidéo entre l'image de départ et l'image de fin.

**STYLE REQUIS :** Littéraire, raffiné, cinématographique.
- Verbes d'action précis et évocateurs
- Mouvements de caméra (travelling, panoramique, plan fixe...)
- Rythme (lent, saccadé, fluide...)
- Psychologie des personnages (tension, soulagement, hésitation...)
- Atmosphère (oppressante, légère, suspendue...)

**INTERDICTION ABSOLUE :** Ne JAMAIS décrire l'apparence physique des personnages ou des décors.
Utiliser uniquement des DÉSIGNATIONS SIMPLES : "l'homme", "la femme", "le vieux", "l'enfant".

**EXEMPLE :**
"L'homme s'avance vers elle d'un pas hésitant, le regard fuyant. Elle se retourne lentement. Travelling avant accompagnant le rapprochement, tension croissante dans l'espace qui se réduit entre eux."

#### B. promptImageDepart (COMPOSITION VISUELLE DÉBUT)
Décrit la COMPOSITION SPATIALE de l'image au DÉBUT du plan.
Cette image sera générée en 21:9 (cinémascope) par édition depuis les collections.

**CONTENU :** Position des personnages dans le cadre, rapport au décor, postures.
**STYLE :** Descriptif, spatial, cinématographique (comme une indication de mise en scène).

**EXEMPLE :**
"L'homme de dos au premier plan gauche, face à la porte. La femme au fond, assise à son bureau, de profil."

#### C. promptImageFin (COMPOSITION VISUELLE FIN)
Décrit la COMPOSITION SPATIALE de l'image à la FIN du plan.
Cette image sera générée en 21:9 (cinémascope) par édition depuis les collections.

**LOGIQUE :** DÉDUIRE cette composition de l'action décrite dans le prompt principal.
Si l'action est "l'homme s'approche", la fin montre le résultat de ce rapprochement.

**EXEMPLE :**
"L'homme et la femme face à face, proches, au centre du cadre. Tension dans leurs regards."

---

## RÈGLES POUR LES PROMPTS PRIMAIRES DE PERSONNAGES
${DEFAULT_CHARACTER_SYSTEM_PROMPT}

## RÈGLES POUR LES PROMPTS PRIMAIRES DE DÉCORS  
${DEFAULT_DECOR_SYSTEM_PROMPT}

---

## FORMAT JSON OBLIGATOIRE

{
  "title": "Titre du projet",
  "synopsis": "Synopsis général (2-3 phrases)",
  "characters": [
    {
      "id": "perso-prenom",
      "name": "Prénom",
      "description": "Description narrative du personnage",
      "referenceCode": "[PERSO:Prénom]",
      "prompts": {
        "primary": "[DESCRIPTION PHYSIQUE EXHAUSTIVE - 200+ mots minimum]",
        "face": "${DEFAULT_CHARACTER_VARIANT_PROMPTS.face}",
        "profile": "${DEFAULT_CHARACTER_VARIANT_PROMPTS.profile}",
        "back": "${DEFAULT_CHARACTER_VARIANT_PROMPTS.back}"
      }
    }
  ],
  "decors": [
    {
      "id": "decor-nom",
      "name": "Nom du décor",
      "description": "Description narrative du décor",
      "referenceCode": "[DECOR:Nom]",
      "prompts": {
        "primary": "[DESCRIPTION EXHAUSTIVE DU DÉCOR - 150+ mots minimum]",
        "angle2": "${DEFAULT_DECOR_VARIANT_PROMPTS.angle2}",
        "plongee": "${DEFAULT_DECOR_VARIANT_PROMPTS.plongee}",
        "contrePlongee": "${DEFAULT_DECOR_VARIANT_PROMPTS.contrePlongee}"
      }
    }
  ],
  "scenes": [
    {
      "id": "scene-1",
      "sceneNumber": 1,
      "title": "Titre évocateur",
      "description": "Synopsis de la scène",
      "plans": [
        {
          "id": "plan-1-1",
          "planNumber": 1,
          "prompt": "[ACTION LITTÉRAIRE - mouvement, psychologie, caméra - SANS description physique]",
          "promptImageDepart": "[COMPOSITION SPATIALE DÉBUT - positions, postures, rapport au cadre]",
          "promptImageFin": "[COMPOSITION SPATIALE FIN - déduite de l'action]",
          "characterRefs": ["perso-prenom"],
          "decorRef": "decor-nom",
          "duration": 5,
          "cameraMovement": "Type de mouvement caméra"
        }
      ]
    }
  ],
  "totalPlans": 4,
  "estimatedDuration": 60
}

## RÈGLES ABSOLUES

1. **SÉPARATION STRICTE** : Descriptions physiques UNIQUEMENT dans les prompts "primary". JAMAIS dans les prompts de plans.

2. **DÉSIGNATIONS SIMPLES** dans les plans : "l'homme", "la femme", "le vieux", "l'enfant" - PAS de descriptions.

3. **COHÉRENCE** : promptImageFin doit être la conséquence logique de l'action décrite dans prompt.

4. **characterRefs** : Liste des IDs de personnages présents (peut être vide si plan de décor seul).

5. **decorRef** : ID du décor (obligatoire sauf exceptions).

6. **Prompts variantes** (face, profile, back, angle2, plongee, contrePlongee) : FIXES, ne pas modifier.`;

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
  // On met type en dernier pour qu'il ne soit pas écrasé par les données
  return `data: ${JSON.stringify({ ...data, type })}\n\n`;
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
          // Déterminer le modèle à utiliser
          // En mode test, forcer GPT-4o pour aller vite
          const modelToUse = isTestMode ? 'gpt-4o' : (config?.aiModel || 'gpt-5.1-2025-11-13');
          
          // ========== PHASE 1 : ANALYSE ==========
          controller.enqueue(encoder.encode(sseEvent('phase_start', { 
            phase: 'analysis',
            message: `🧠 Phase 1 : Analyse du brief avec ${modelToUse}...`,
          })));

          const openai = new OpenAI({ apiKey });
          
          // Construire le system prompt
          let systemPrompt = config?.systemPrompt || SYSTEM_PROMPT_ANALYSIS;
          if (isTestMode) {
            systemPrompt += SYSTEM_PROMPT_TEST_MODE;
          }

          // Appel LLM avec streaming et reasoning HIGH
          console.log(`[API] Mode test: ${isTestMode}, Modèle: ${modelToUse}`);
          const useReasoningAPI = modelToUse.startsWith('gpt-5') || modelToUse.includes('o1') || modelToUse.includes('o3');
          
          let completion;
          if (useReasoningAPI) {
            // GPT-5.1 utilise reasoning_effort
            const reasoningEffort = config?.reasoningLevel || 'high';
            console.log(`[API] Utilisation de ${modelToUse} avec reasoning_effort=${reasoningEffort}`);
            
            completion = await openai.chat.completions.create({
              model: modelToUse,
              reasoning_effort: reasoningEffort as 'low' | 'medium' | 'high',
              max_completion_tokens: 16000, // Augmenté pour les projets avec beaucoup de plans
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Analyse ce brief et génère la structure du projet. IMPORTANT: Crée des prompts PRIMAIRES extrêmement détaillés pour chaque personnage et décor.\n\n${briefData.content}` },
              ],
              stream: true,
            } as any); // Type étendu pour supporter reasoning_effort
          } else {
            // Modèles classiques (GPT-4o, etc.)
            completion = await openai.chat.completions.create({
              model: modelToUse,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Analyse ce brief et génère la structure du projet :\n\n${briefData.content}` },
              ],
              temperature: 0.7,
              max_tokens: 16000, // Augmenté pour les projets avec beaucoup de plans
              stream: true,
            });
          }

          let fullResponse = '';
          let reasoningContent = '';
          let chunkCount = 0;

          // Stream la réponse de GPT-5.1
          for await (const chunk of completion) {
            chunkCount++;
            const delta = chunk.choices[0]?.delta as any;
            const choice = chunk.choices[0] as any;
            
            // DEBUG: Log les premiers chunks pour voir la structure
            if (chunkCount <= 3) {
              console.log(`[GPT-5.1 DEBUG] Chunk ${chunkCount}:`, JSON.stringify(chunk, null, 2));
            }
            
            // Capturer le reasoning - plusieurs champs possibles selon le modèle
            const reasoningText = delta?.reasoning_content || delta?.reasoning || choice?.reasoning_content || choice?.reasoning;
            if (reasoningText) {
              reasoningContent += reasoningText;
              console.log(`[GPT-5.1] Reasoning chunk: ${reasoningText.substring(0, 100)}...`);
            }
            
            // Capturer la réponse finale (le JSON)
            if (delta?.content) {
              fullResponse += delta.content;
            }
          }
          
          console.log(`[GPT-5.1] Total chunks: ${chunkCount}, Reasoning length: ${reasoningContent.length}, Response length: ${fullResponse.length}`);
          
          // Log du reasoning pour debug
          if (reasoningContent) {
            console.log(`[API] Reasoning capturé: ${reasoningContent.length} caractères`);
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
            
            // Sauvegarder le reasoning de GPT-5.1 dans la structure
            if (reasoningContent && reasoningContent.length > 0) {
              projectStructure.reasoning = reasoningContent;
              console.log(`[API] Reasoning sauvegardé: ${reasoningContent.substring(0, 200)}...`);
            }
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

          // Récupérer les paramètres vidéo depuis la config
          const videoCopies = config?.settings?.videoCopies || 4;
          const videoDuration = config?.settings?.videoDuration || 10;
          const videoAspectRatio = config?.settings?.videoAspectRatio || '16:9';

          // Générer les nœuds du canvas (avec N nœuds vidéo par plan et paramètres)
          const canvasData = generateCanvasFromProject(projectStructure, isTestMode, videoCopies, {
            videoDuration,
            videoAspectRatio,
          });
          
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
          // Supporter les deux formats : decors (nouveau) ou locations (ancien)
          const decorsCount = projectStructure.decors?.length || projectStructure.locations?.length || 0;
          
          const summary = {
            projectName,
            characters: projectStructure.characters.length,
            decors: decorsCount,
            locations: decorsCount, // Alias pour rétrocompatibilité
            scenes: projectStructure.scenes.length,
            plans: projectStructure.totalPlans,
            nodes: canvasData.nodes.length,
            edges: canvasData.edges.length,
            // Infos pour génération parallèle
            // Note: chaque personnage/décor a 1 image primaire + 3 variantes = 4 images
            imagesToGenerate: generationSequence.characterImages.reduce((acc, c) => acc + c.imageNodeIds.length, 0) +
                              (generationSequence.decorImages?.reduce((acc, d) => acc + d.imageNodeIds.length, 0) || 
                               generationSequence.locationImages.reduce((acc, l) => acc + l.imageNodeIds.length, 0)),
            videosToGenerate: generationSequence.videos.length,
            quality: config?.quality || 'elevee',
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

