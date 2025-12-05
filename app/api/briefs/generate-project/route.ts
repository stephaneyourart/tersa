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
import { fLog } from '@/lib/file-logger';

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

// ========== HELPERS LLM ==========
type LLMProvider = 'mistral' | 'openai';

async function* streamMistralCompletion(
  model: string,
  systemPrompt: string,
  userPrompt: string
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
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8, // Plus créatif que OpenAI
      max_tokens: 32000,
      stream: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Mistral API error: ${error}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      yield { done: true };
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') {
          yield { done: true };
          continue;
        }
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            yield { content, done: false };
          }
        } catch (e) {
          // Ignorer les erreurs de parsing
        }
      }
    }
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

    // Déterminer le provider LLM (Mistral par défaut)
    const llmProvider: LLMProvider = config?.llmProvider || 'mistral';
    const modelToUse = config?.aiModel || (llmProvider === 'mistral' ? 'mistral-large-latest' : 'gpt-5.1-2025-11-13');

    // Vérifier l'API key appropriée
    if (llmProvider === 'mistral') {
      if (!process.env.MISTRAL_API_KEY) {
        return new Response(JSON.stringify({ error: 'MISTRAL_API_KEY non configurée' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } else {
      if (!process.env.OPENAI_API_KEY) {
        return new Response(JSON.stringify({ error: 'OPENAI_API_KEY non configurée' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
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

    // LOG: Configuration complète du projet (TOUS les paramètres)
    fLog.projectStart(projectName, briefId, {
      // LLM
      llmProvider: llmProvider,
      llmModel: modelToUse,
      reasoningLevel: config?.reasoningLevel,
      // T2I (images primaires)
      t2iModel: config?.settings?.imageModel,
      t2iAspectRatio: config?.settings?.imageAspectRatio || config?.settings?.aspectRatio,
      t2iResolution: config?.settings?.resolution,
      // I2I (first/last frames)
      i2iModel: config?.settings?.editModel,
      i2iAspectRatio: config?.settings?.videoAspectRatio, // I2I utilise le ratio vidéo (21:9)
      i2iResolution: config?.settings?.resolution,
      // Video
      videoModel: config?.settings?.videoModel,
      videoMode: config?.settings?.frameMode,
      videoDuration: config?.settings?.videoDuration,
      videoAspectRatio: config?.settings?.videoAspectRatio,
      videoGuidance: config?.settings?.videoGuidance || config?.settings?.cfgScale,
      // Quantities
      plansCount: config?.settings?.plansCount,
      imageSetsPerPlan: config?.settings?.couplesPerPlan,
      videosPerImageSet: config?.settings?.videosPerCouple,
      generateSecondaryImages: config?.settings?.generateSecondaryImages,
      firstFrameIsPrimary: config?.settings?.firstFrameIsPrimary,
      // Mode & Prompts
      testMode: isTestMode,
      systemPrompt: config?.systemPrompt,
      customInstructions: config?.customInstructions,
    });

    // Créer le stream SSE
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const providerLabel = llmProvider === 'mistral' ? 'Mistral' : 'OpenAI';
          
          // ========== PHASE 1 : ANALYSE ==========
          controller.enqueue(encoder.encode(sseEvent('phase_start', { 
            phase: 'analysis',
            message: `🧠 Phase 1 : Analyse du brief avec ${providerLabel} (${modelToUse})...`,
          })));
          
          // Construire le system prompt
          let systemPrompt = config?.systemPrompt || SYSTEM_PROMPT_ANALYSIS;
          if (isTestMode) {
            systemPrompt += SYSTEM_PROMPT_TEST_MODE;
          }

          // Appel LLM avec streaming
          console.log(`[API] Provider: ${llmProvider}, Mode test: ${isTestMode}, Modèle: ${modelToUse}`);

          let fullResponse = '';
          let reasoningContent = '';
          let chunkCount = 0;

          // ========== MISTRAL ==========
          if (llmProvider === 'mistral') {
            // Adapter le prompt selon le modèle (mistral-small = plus concis)
            const isSmallModel = modelToUse.includes('small');
            const userPrompt = isSmallModel
              ? `Analyse ce brief et génère la structure du projet en JSON.
RÈGLES CRITIQUES:
- Génère un JSON VALIDE et COMPLET
- Termine TOUJOURS le JSON correctement avec toutes les fermetures } et ]
- Limite-toi à 2-3 plans maximum pour un brief court
- Sois CONCIS dans les descriptions (1-2 phrases max par prompt)

Brief à analyser:
${briefData.content}`
              : `Analyse ce brief et génère la structure du projet. IMPORTANT: Crée des prompts PRIMAIRES extrêmement détaillés et CRÉATIFS pour chaque personnage et décor. Sois audacieux et original dans tes descriptions.\n\n${briefData.content}`;
            
            for await (const chunk of streamMistralCompletion(modelToUse, systemPrompt, userPrompt)) {
              if (chunk.done) break;
              if (chunk.content) {
                fullResponse += chunk.content;
                chunkCount++;
              }
            }
            
            console.log(`[Mistral] Total chunks: ${chunkCount}, Response length: ${fullResponse.length}, Model: ${modelToUse}`);
          }
          // ========== OPENAI ==========
          else {
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            const useReasoningAPI = modelToUse.startsWith('gpt-5') || modelToUse.includes('o1') || modelToUse.includes('o3');
            
            let completion;
            if (useReasoningAPI) {
              // GPT-5.1 utilise reasoning_effort
              const reasoningEffort = config?.reasoningLevel || 'high';
              console.log(`[API] Utilisation de ${modelToUse} avec reasoning_effort=${reasoningEffort}`);
              
              completion = await openai.chat.completions.create({
                model: modelToUse,
                reasoning_effort: reasoningEffort as 'low' | 'medium' | 'high',
                max_completion_tokens: 65536,
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: `Analyse ce brief et génère la structure du projet. IMPORTANT: Crée des prompts PRIMAIRES extrêmement détaillés pour chaque personnage et décor.\n\n${briefData.content}` },
                ],
                stream: true,
              } as any);
            } else {
              // Modèles classiques (GPT-4o, etc.)
              const maxTokens = modelToUse.includes('gpt-4o') ? 16384 : 32000;
              console.log(`[API] Modèle classique ${modelToUse}, max_tokens: ${maxTokens}`);
              
              completion = await openai.chat.completions.create({
                model: modelToUse,
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: `Analyse ce brief et génère la structure du projet :\n\n${briefData.content}` },
                ],
                temperature: 0.7,
                max_tokens: maxTokens,
                stream: true,
              });
            }

            // Stream OpenAI (completion est un Stream car stream: true)
            for await (const chunk of completion as AsyncIterable<any>) {
              chunkCount++;
              const delta = chunk.choices[0]?.delta as any;
              const choice = chunk.choices[0] as any;
              
              if (chunkCount <= 3) {
                console.log(`[OpenAI DEBUG] Chunk ${chunkCount}:`, JSON.stringify(chunk, null, 2));
              }
              
              // Capturer le reasoning
              const reasoningText = delta?.reasoning_content || delta?.reasoning || choice?.reasoning_content || choice?.reasoning;
              if (reasoningText) {
                reasoningContent += reasoningText;
                controller.enqueue(encoder.encode(sseEvent('reasoning', { content: reasoningText })));
              }
              
              if (delta?.content) {
                fullResponse += delta.content;
              }
            }
            
            console.log(`[OpenAI] Total chunks: ${chunkCount}, Reasoning: ${reasoningContent.length}, Response: ${fullResponse.length}`);
          }
          
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
            
            let jsonStr = jsonMatch[0];
            
            // Détecter si le JSON est tronqué (ne finit pas par un } valide ou contient des propriétés incomplètes)
            const openBraces = (jsonStr.match(/\{/g) || []).length;
            const closeBraces = (jsonStr.match(/\}/g) || []).length;
            const openBrackets = (jsonStr.match(/\[/g) || []).length;
            const closeBrackets = (jsonStr.match(/\]/g) || []).length;
            
            if (openBraces !== closeBraces || openBrackets !== closeBrackets) {
              console.error(`[API] JSON tronqué détecté: { = ${openBraces}, } = ${closeBraces}, [ = ${openBrackets}, ] = ${closeBrackets}`);
              
              // Tenter de réparer le JSON tronqué en ajoutant les fermetures manquantes
              const missingBrackets = closeBrackets < openBrackets ? ']'.repeat(openBrackets - closeBrackets) : '';
              const missingBraces = closeBraces < openBraces ? '}'.repeat(openBraces - closeBraces) : '';
              
              // Trouver la dernière propriété complète et couper là
              // Pattern: chercher la dernière virgule ou le dernier "}" ou "]" suivi de données incomplètes
              // Stratégie plus robuste : trouver la dernière fermeture valide d'objet ou tableau
              const lastClosingBrace = jsonStr.lastIndexOf('}');
              const lastClosingBracket = jsonStr.lastIndexOf(']');
              const lastValidPos = Math.max(lastClosingBrace, lastClosingBracket);
              
              if (lastValidPos > 0) {
                // Couper après la dernière structure valide
                jsonStr = jsonStr.substring(0, lastValidPos + 1);
                
                // Recalculer les fermetures manquantes pour ce nouveau fragment
                const currentOpenBraces = (jsonStr.match(/\{/g) || []).length;
                const currentCloseBraces = (jsonStr.match(/\}/g) || []).length;
                const currentOpenBrackets = (jsonStr.match(/\[/g) || []).length;
                const currentCloseBrackets = (jsonStr.match(/\]/g) || []).length;
                
                const neededBrackets = currentOpenBrackets - currentCloseBrackets;
                const neededBraces = currentOpenBraces - currentCloseBraces;
                
                jsonStr += ']'.repeat(Math.max(0, neededBrackets)) + '}'.repeat(Math.max(0, neededBraces));
                console.log(`[API] Tentative de réparation du JSON tronqué (v2)...`);
              } else {
                // Si on ne peut pas réparer, lever une erreur explicite
                throw new Error(`JSON tronqué par l'IA (limite de tokens atteinte). Réponse reçue: ${fullResponse.length} caractères. Essayez de simplifier le brief ou réduire le nombre de personnages/plans.`);
              }
            }
            
            projectStructure = JSON.parse(jsonStr);
            
            // Sauvegarder le reasoning de GPT-5.1 dans la structure
            if (reasoningContent && reasoningContent.length > 0) {
              projectStructure.reasoning = reasoningContent;
              console.log(`[API] Reasoning sauvegardé: ${reasoningContent.substring(0, 200)}...`);
            }
          } catch (parseError) {
            console.error('Erreur parsing JSON:', parseError);
            
            // Message d'erreur plus détaillé
            const errorMessage = parseError instanceof Error ? parseError.message : 'Erreur inconnue';
            const isTruncated = fullResponse.length > 0 && !fullResponse.trim().endsWith('}');
            
            controller.enqueue(encoder.encode(sseEvent('error', { 
              error: isTruncated 
                ? `JSON tronqué par l'IA (limite de tokens probablement atteinte). Essayez de simplifier le brief ou réduire le nombre de personnages/scènes.`
                : `Erreur de parsing du JSON généré par l'IA: ${errorMessage}`,
              details: fullResponse.substring(0, 500),
              responseLength: fullResponse.length,
              hint: isTruncated ? 'Le modèle a généré une réponse trop longue qui a été coupée.' : undefined,
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
          // NOUVEAU: N couples × M vidéos par plan
          const couplesPerPlan = config?.settings?.couplesPerPlan || 1;  // N
          const videosPerCouple = config?.settings?.videosPerCouple || 4;  // M
          const videoCopies = config?.settings?.videoCopies || couplesPerPlan * videosPerCouple;  // Rétrocompat
          const videoDuration = config?.settings?.videoDuration || 10;
          const videoAspectRatio = config?.settings?.videoAspectRatio || '16:9';
          
          // Mode frame: first-last (2 images) ou first-only (1 image)
          const frameMode = config?.settings?.frameMode || 'first-last';
          
          // NOUVELLES OPTIONS
          const generateSecondaryImages = config?.settings?.generateSecondaryImages !== false; // true par défaut
          const firstFrameIsPrimary = config?.settings?.firstFrameIsPrimary || false;
          
          console.log(`[API] Frame mode: ${frameMode}`);
          console.log(`[API] Generate secondary images: ${generateSecondaryImages}`);
          console.log(`[API] First frame is primary: ${firstFrameIsPrimary}`);
          console.log(`[API] Full config.settings:`, JSON.stringify(config?.settings, null, 2));

          // Générer les nœuds du canvas (avec N couples × M vidéos par plan)
          const canvasData = generateCanvasFromProject(projectStructure, isTestMode, videoCopies, {
            couplesPerPlan,
            videosPerCouple,
            videoDuration,
            videoAspectRatio,
            frameMode,
            generateSecondaryImages,
            firstFrameIsPrimary,
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
          // Inclure les modèles T2I/I2I sélectionnés pour la génération future
          controller.enqueue(encoder.encode(sseEvent('project_data', { 
            projectName,
            canvasData: {
              nodes: canvasData.nodes,
              edges: canvasData.edges,
              viewport: canvasData.viewport,
            },
            projectStructure,
            generationSequence,
            // NOUVEAU: Modèles sélectionnés par l'utilisateur pour la génération
            generationModels: {
              t2iModel: config?.settings?.imageModel || null,
              i2iModel: config?.settings?.editModel || null,
              videoModel: config?.settings?.videoModel || null,
              t2iResolution: config?.settings?.resolution || '4k',
              i2iResolution: config?.settings?.resolution || '4k',
            },
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
          
          // Calcul des images et vidéos à générer
          const characterAndDecorImages = generationSequence.characterImages.reduce((acc, c) => acc + c.imageNodeIds.length, 0) +
                              (generationSequence.decorImages?.reduce((acc, d) => acc + d.imageNodeIds.length, 0) || 
                               generationSequence.locationImages.reduce((acc, l) => acc + l.imageNodeIds.length, 0));
          const planFrameImages = generationSequence.planImages.length; // N couples × 2 images par plan
          const totalVideos = generationSequence.videos.reduce((acc, v) => acc + v.videoNodeIds.length, 0);
          
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
            imagesToGenerate: characterAndDecorImages + planFrameImages,
            planImagesCount: planFrameImages, // Images first/last frames (N couples × 2)
            videosToGenerate: totalVideos,  // N couples × M vidéos par plan
            // Config vidéo
            couplesPerPlan,
            videosPerCouple,
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

