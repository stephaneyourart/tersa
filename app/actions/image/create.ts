'use server';

import { getSubscribedUser } from '@/lib/auth';
import { database } from '@/lib/database';
import { parseError } from '@/lib/error/parse';
import { imageModels } from '@/lib/models/image';
import { visionModels } from '@/lib/models/vision';
import { trackCreditUsage } from '@/lib/stripe';
import { uploadBuffer, generateUniqueFilename } from '@/lib/storage';
import { isLocalProject, getLocalProject } from '@/lib/local-project';
import { saveMediaMetadata } from '@/lib/media-metadata';
import { wavespeedImage, type WaveSpeedTextToImageParams, type WaveSpeedAspectRatio } from '@/lib/models/image/wavespeed';
import { projects } from '@/schema';
import type { Edge, Node, Viewport } from '@xyflow/react';
import {
  type Experimental_GenerateImageResult,
  experimental_generateImage as generateImage,
} from 'ai';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';

// Mode local
const isLocalMode = process.env.LOCAL_MODE === 'true';

/**
 * Génère un titre intelligent pour un fichier basé sur le prompt
 * Utilise GPT-4.1-mini pour créer un titre court et descriptif
 */
async function generateSmartTitle(prompt: string, instructions?: string): Promise<string> {
  try {
    const openai = new OpenAI();
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: `Tu génères des titres de fichiers courts et descriptifs.
Règles:
- Maximum 50 caractères
- Pas de caractères spéciaux (/ \\ : * ? " < > |)
- Remplace les espaces par des tirets ou underscores
- Capture l'essence de l'image
- En français si le prompt est en français
- Pas d'extension de fichier
Réponds UNIQUEMENT avec le titre, rien d'autre.`
        },
        {
          role: 'user',
          content: `Génère un titre de fichier pour cette image:
Prompt: ${prompt}
${instructions ? `Instructions: ${instructions}` : ''}`
        }
      ],
      max_tokens: 60,
      temperature: 0.7,
    });

    let title = response.choices[0]?.message?.content?.trim() || 'image';
    
    // Nettoyer le titre
    title = title
      .replace(/[/\\:*?"<>|]/g, '') // Supprimer caractères interdits
      .replace(/\s+/g, '-') // Espaces → tirets
      .replace(/^-+|-+$/g, '') // Supprimer tirets début/fin
      .substring(0, 50); // Max 50 caractères
    
    return title || 'image';
  } catch (error) {
    console.warn('[SmartTitle] Erreur génération titre, utilisation fallback:', error);
    // Fallback: premiers mots du prompt
    return prompt
      .split(/\s+/)
      .slice(0, 5)
      .join('-')
      .replace(/[/\\:*?"<>|]/g, '')
      .substring(0, 50) || 'image';
  }
}

type GenerateImageActionProps = {
  prompt: string;
  nodeId: string;
  projectId: string;
  modelId: string;
  instructions?: string;
  // MODE TEST: utilise size (dimensions en pixels)
  size?: string;
  // MODE PROD: utilise aspectRatio + resolution directement pour WaveSpeed
  aspectRatio?: string;
  resolution?: string; // '4k' ou '8k'
};

const generateGptImage1Image = async ({
  instructions,
  prompt,
  size,
}: {
  instructions?: string;
  prompt: string;
  size?: string;
}) => {
  const openai = new OpenAI();
  const response = await openai.images.generate({
    model: 'gpt-image-1',
    prompt: [
      'Generate an image based on the following instructions and context.',
      '---',
      'Instructions:',
      instructions ?? 'None.',
      '---',
      'Context:',
      prompt,
    ].join('\n'),
    size: size as never | undefined,
    moderation: 'low',
    quality: 'high',
    output_format: 'png',
  });

  const json = response.data?.at(0)?.b64_json;

  if (!json) {
    throw new Error('No response JSON found');
  }

  if (!response.usage) {
    throw new Error('No usage found');
  }

  const image: Experimental_GenerateImageResult['image'] = {
    base64: json,
    uint8Array: Buffer.from(json, 'base64'),
    mediaType: 'image/png',
  };

  return {
    image,
    usage: {
      textInput: response.usage?.input_tokens_details.text_tokens,
      imageInput: response.usage?.input_tokens_details.image_tokens,
      output: response.usage?.output_tokens,
    },
  };
};

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

// Convertit une taille "1024x1024" en aspect ratio "1:1"
function sizeToAspectRatio(size: string): WaveSpeedAspectRatio {
  const [width, height] = size.split('x').map(Number);
  const ratio = width / height;
  
  if (ratio === 1) return '1:1';
  if (Math.abs(ratio - 16/9) < 0.1) return '16:9';
  if (Math.abs(ratio - 9/16) < 0.1) return '9:16';
  if (Math.abs(ratio - 4/3) < 0.1) return '4:3';
  if (Math.abs(ratio - 3/4) < 0.1) return '3:4';
  if (Math.abs(ratio - 3/2) < 0.1) return '3:2';
  if (Math.abs(ratio - 2/3) < 0.1) return '2:3';
  if (Math.abs(ratio - 21/9) < 0.1) return '21:9';
  if (Math.abs(ratio - 9/21) < 0.1) return '9:21';
  
  return '1:1'; // Par défaut
}

// Génère une image via WaveSpeed API
// MODE PROD: aspectRatio + resolution sont passés directement
// MODE TEST: size est passé, et on le convertit en aspectRatio
// SPECIAL: Seedream V4.5 utilise size au format "width*height"
async function generateWaveSpeedImage(
  modelId: string,
  prompt: string,
  instructions?: string,
  options?: {
    size?: string;           // MODE TEST: dimensions en pixels
    aspectRatio?: string;    // MODE PROD: ratio direct
    resolution?: string;     // MODE PROD: '4k' ou '8k'
    width?: number;          // Pour Seedream V4.5
    height?: number;         // Pour Seedream V4.5
  }
): Promise<{ url: string; mediaType: string; aspectRatio: string }> {
  // Mapper les IDs de modèle vers les instances WaveSpeed
  const modelMap: Record<string, () => ReturnType<typeof wavespeedImage.nanoBananaPro>> = {
    // Bytedance Seedream V4.5
    'seedream-v4.5-wavespeed': wavespeedImage.seedreamV45,
    // Nano Banana
    'nano-banana-wavespeed': wavespeedImage.nanoBanana,
    'nano-banana-pro-wavespeed': wavespeedImage.nanoBananaPro,
    'nano-banana-pro-multi-wavespeed': wavespeedImage.nanoBananaProMulti,
    'nano-banana-pro-ultra-wavespeed': wavespeedImage.nanoBananaProUltra,
    // Imagen
    'imagen3-wavespeed': wavespeedImage.imagen3,
    'imagen3-fast-wavespeed': wavespeedImage.imagen3Fast,
    'imagen4-wavespeed': wavespeedImage.imagen4,
    'imagen4-fast-wavespeed': wavespeedImage.imagen4Fast,
    'imagen4-ultra-wavespeed': wavespeedImage.imagen4Ultra,
    // Gemini
    'gemini-2.5-flash-wavespeed': wavespeedImage.gemini25FlashText2Img,
    'gemini-3-pro-wavespeed': wavespeedImage.gemini3ProText2Img,
    // Flux
    'flux-dev-wavespeed': wavespeedImage.fluxDev,
    'flux-dev-ultra-fast-wavespeed': wavespeedImage.fluxDevUltraFast,
    'flux-schnell-wavespeed': wavespeedImage.fluxSchnell,
    'flux-1.1-pro-wavespeed': wavespeedImage.flux11Pro,
    'flux-1.1-pro-ultra-wavespeed': wavespeedImage.flux11ProUltra,
    'flux-2-dev-wavespeed': wavespeedImage.flux2DevText2Img,
    'flux-2-pro-wavespeed': wavespeedImage.flux2ProText2Img,
    // Qwen
    'qwen-text2img-wavespeed': wavespeedImage.qwenText2Img,
    // Hunyuan
    'hunyuan-2.1-wavespeed': wavespeedImage.hunyuan21,
    'hunyuan-3-wavespeed': wavespeedImage.hunyuan3,
    // Stability AI
    'sdxl-wavespeed': wavespeedImage.sdxl,
    'sd3-wavespeed': wavespeedImage.sd3,
    'sd35-large-wavespeed': wavespeedImage.sd35Large,
    'sd35-large-turbo-wavespeed': wavespeedImage.sd35LargeTurbo,
  };

  const modelFactory = modelMap[modelId];
  if (!modelFactory) {
    throw new Error(`Modèle WaveSpeed non supporté: ${modelId}`);
  }

  const model = modelFactory();
  
  const fullPrompt = instructions 
    ? `${instructions}\n\n${prompt}`
    : prompt;

  // CAS SPÉCIAL: Seedream V4.5 utilise size au format "width*height"
  if (modelId === 'seedream-v4.5-wavespeed') {
    // Déterminer la taille à utiliser
    // Priorité: width/height explicites > size > défaut 2100*900
    let seedreamSize: string;
    
    if (options?.width && options?.height) {
      seedreamSize = `${options.width}*${options.height}`;
    } else if (options?.size) {
      // Convertir le format "widthxheight" en "width*height"
      seedreamSize = options.size.replace('x', '*');
    } else {
      // Taille par défaut pour Seedream V4.5: 2100*800
      seedreamSize = '2100*800';
    }
    
    console.log(`[WaveSpeed] Seedream V4.5 - size: ${seedreamSize}`);
    
    const seedreamParams = {
      prompt: fullPrompt,
      size: seedreamSize,
    };
    
    const imageUrl = await model.generate(seedreamParams);
    
    // Calculer l'aspect ratio pour le retour
    const [w, h] = seedreamSize.split('*').map(Number);
    const aspectRatio = w > h ? '16:9' : h > w ? '9:16' : '1:1';
    
    return {
      url: imageUrl,
      mediaType: 'image/png',
      aspectRatio,
    };
  }

  // Déterminer l'aspect ratio à utiliser (pour les autres modèles)
  let effectiveAspectRatio: WaveSpeedAspectRatio;
  
  if (options?.aspectRatio) {
    // MODE PROD: aspectRatio fourni directement
    effectiveAspectRatio = options.aspectRatio as WaveSpeedAspectRatio;
    console.log(`[WaveSpeed] MODE PROD - aspect_ratio: ${effectiveAspectRatio}, resolution: ${options.resolution || '4k'}`);
  } else if (options?.size) {
    // MODE TEST: convertir size en aspectRatio
    effectiveAspectRatio = sizeToAspectRatio(options.size);
    console.log(`[WaveSpeed] MODE TEST - size: ${options.size} → aspect_ratio: ${effectiveAspectRatio}`);
  } else {
    effectiveAspectRatio = '1:1';
    console.log(`[WaveSpeed] FALLBACK - aspect_ratio: ${effectiveAspectRatio}`);
  }

  const params: WaveSpeedTextToImageParams = {
    prompt: fullPrompt,
    aspect_ratio: effectiveAspectRatio,
    output_format: 'png',
    // Ajouter resolution si fournie (MODE PROD)
    ...(options?.resolution ? { resolution: options.resolution as '1k' | '2k' | '4k' } : {}),
  };

  console.log(`[WaveSpeed] Génération avec modèle: ${modelId}, params:`, { aspect_ratio: params.aspect_ratio, resolution: params.resolution });
  const imageUrl = await model.generate(params);

  return {
    url: imageUrl,
    mediaType: 'image/png',
    aspectRatio: effectiveAspectRatio,
  };
}

export const generateImageAction = async ({
  prompt,
  modelId,
  instructions,
  nodeId,
  projectId,
  size,
  aspectRatio,
  resolution,
}: GenerateImageActionProps): Promise<
  | {
      nodeData: object;
    }
  | {
      error: string;
    }
> => {
  try {
    await getSubscribedUser();
    const model = imageModels[modelId];

    if (!model) {
      throw new Error('Model not found');
    }

    let imageUrl: string;
    let mediaType: string = 'image/png';
    let imageBuffer: Buffer;

    const provider = model.providers[0];

    // Vérifier si c'est un modèle WaveSpeed
    if (modelId.endsWith('-wavespeed')) {
      console.log(`[WaveSpeed] Détecté modèle WaveSpeed: ${modelId}`);
      
      // 1. Générer le titre via IA EN PARALLÈLE de la génération d'image
      const titlePromise = generateSmartTitle(prompt, instructions);
      const imagePromise = generateWaveSpeedImage(modelId, prompt, instructions, {
        size,
        aspectRatio,
        resolution,
      });
      
      // Attendre les deux en parallèle
      const [smartTitle, result] = await Promise.all([titlePromise, imagePromise]);
      
      console.log(`[WaveSpeed] Titre généré: ${smartTitle}`);
      console.log(`[WaveSpeed] Image générée: ${result.url}, aspectRatio: ${result.aspectRatio}`);
      
      // 2. Télécharger l'image depuis WaveSpeed
      const response = await fetch(result.url);
      if (!response.ok) {
        throw new Error(`Erreur téléchargement image: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
      mediaType = result.mediaType;
      
      // 3. Sauvegarder avec le titre intelligent
      const extension = mediaType.split('/').pop() || 'png';
      const filenameWithTitle = `${smartTitle}.${extension}`;
      const stored = await uploadBuffer(imageBuffer, filenameWithTitle, mediaType);
      
      console.log(`[WaveSpeed] Fichier sauvegardé: ${stored.path}`);
      
      // Calculer le coût pour cette génération
      const generationCost = provider.getCost({ size });
      
      // Sauvegarder les métadonnées dans un fichier sidecar .meta.json
      // IMPORTANT: Inclure originalUrl pour permettre réutilisation sans conversion base64
      if (stored.path) {
        saveMediaMetadata(stored.path, {
          isGenerated: true,
          modelId: modelId,
          prompt: prompt,
          aspectRatio: result.aspectRatio,
          format: mediaType,
          smartTitle: smartTitle,
          generatedAt: new Date().toISOString(),
          originalUrl: result.url, // URL CloudFront WaveSpeed pour réutilisation
          cost: generationCost,
          service: 'wavespeed',
        });
      }

      // Ne pas tracker les crédits en mode local
      if (!isLocalMode) {
        await trackCreditUsage({
          action: 'generate_image',
          cost: provider.getCost({ size }),
        });
      }

      // Extraire les dimensions réelles de l'image depuis le paramètre size
      // Format: "widthxheight" (ex: "1024x1024", "256x256")
      let width = 1024;
      let height = 1024;
      if (size) {
        const parts = size.split('x').map(Number);
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          width = parts[0];
          height = parts[1];
        }
      }

      // Retourner avec l'URL locale ET l'URL CloudFront originale
      const newData = {
        updatedAt: new Date().toISOString(),
        generated: {
          url: stored.url,          // URL locale pour l'affichage
          type: mediaType,
          originalUrl: result.url,  // URL CloudFront pour WaveSpeed video API
          model: modelId,           // Modèle utilisé pour l'affichage sous le nœud
        },
        // Stocker les dimensions réelles pour un affichage correct dans les nœuds
        width,
        height,
        localPath: stored.path,
        smartTitle: smartTitle,
        isGenerated: true,
        modelId: modelId,
        model: modelId, // Pour compatibilité avec l'affichage du modèle sous le nœud
        instructions: instructions,
        aspectRatio: result.aspectRatio, // Utiliser l'aspectRatio retourné par WaveSpeed
        resolution: resolution, // Stocker la résolution utilisée (4k/8k)
        description: `Generated from prompt: ${prompt}`,
        cost: generationCost, // Coût de la génération pour les stats
      };

      // En mode local, on ne met pas à jour la BDD
      if (!isLocalProject(projectId)) {
        const project = await database.query.projects.findFirst({
          where: eq(projects.id, projectId),
        });

        if (project) {
          const content = project.content as {
            nodes: Node[];
            edges: Edge[];
            viewport: Viewport;
          };

          const updatedNodes = content.nodes.map((existingNode) => {
            if (existingNode.id === nodeId) {
              return {
                ...existingNode,
                data: newData,
              };
            }
            return existingNode;
          });

          await database
            .update(projects)
            .set({ content: { ...content, nodes: updatedNodes } })
            .where(eq(projects.id, projectId));
        }
      }

      return {
        nodeData: newData,
      };
    }
    
    if (modelId === 'gpt-image-1') {
      const generatedImageResponse = await generateGptImage1Image({
        instructions,
        prompt,
        size,
      });

      // Ne pas tracker les crédits en mode local
      if (!isLocalMode) {
        await trackCreditUsage({
          action: 'generate_image',
          cost: provider.getCost({
            ...generatedImageResponse.usage,
            size,
          }),
        });
      }

      imageBuffer = Buffer.from(generatedImageResponse.image.uint8Array);
      mediaType = generatedImageResponse.image.mediaType;
    } else {
      let aspectRatio: `${number}:${number}` | undefined;
      if (size) {
        const [width, height] = size.split('x').map(Number);
        const divisor = gcd(width, height);
        aspectRatio = `${width / divisor}:${height / divisor}`;
      }

      const generatedImageResponse = await generateImage({
        model: provider.model,
        prompt: [
          'Generate an image based on the following instructions and context.',
          '---',
          'Instructions:',
          instructions ?? 'None.',
          '---',
          'Context:',
          prompt,
        ].join('\n'),
        size: size as never,
        aspectRatio,
      });

      // Ne pas tracker les crédits en mode local
      if (!isLocalMode) {
        await trackCreditUsage({
          action: 'generate_image',
          cost: provider.getCost({ size }),
        });
      }

      imageBuffer = Buffer.from(generatedImageResponse.image.uint8Array);
      mediaType = generatedImageResponse.image.mediaType;
    }

    let extension = mediaType.split('/').pop();
    if (extension === 'jpeg') {
      extension = 'jpg';
    }

    const name = generateUniqueFilename(extension || 'png');

    // Utiliser le wrapper de stockage unifié (local ou Supabase)
    const stored = await uploadBuffer(imageBuffer, name, mediaType);

    // URL pour affichage
    const displayUrl = stored.url;
    
    // URL pour OpenAI : doit être base64 en mode local
    const openaiUrl = isLocalMode
      ? `data:${mediaType};base64,${imageBuffer.toString('base64')}`
      : stored.url;

    // Description optionnelle - essayer avec OpenAI si disponible
    let description = `Generated from prompt: ${prompt}`;
    
    try {
      if (process.env.OPENAI_API_KEY) {
        const project = isLocalProject(projectId)
          ? getLocalProject()
          : await database.query.projects.findFirst({
              where: eq(projects.id, projectId),
            });

        if (project) {
          const visionModel = visionModels[project.visionModel];
          
          if (visionModel) {
            const openai = new OpenAI();
            const response = await openai.chat.completions.create({
              model: visionModel.providers[0].model.modelId,
              messages: [
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: 'Describe this image.' },
                    {
                      type: 'image_url',
                      image_url: {
                        url: openaiUrl,
                      },
                    },
                  ],
                },
              ],
            });

            const aiDescription = response.choices.at(0)?.message.content;
            if (aiDescription) {
              description = aiDescription;
            }
          }
        }
      }
    } catch (descError) {
      console.warn('[LOCAL MODE] Description auto échouée, utilisation du prompt:', descError);
    }

    // Calculer le coût pour cette génération
    const generationCostOther = provider.getCost({ size });
    
    const newData = {
      updatedAt: new Date().toISOString(),
      generated: {
        url: displayUrl,
        type: mediaType,
        model: modelId, // Ajouter le modèle utilisé
      },
      description,
      model: modelId, // Pour l'affichage dans la media library
      modelId: modelId,
      isGenerated: true,
      cost: generationCostOther, // Coût de la génération pour les stats
    };

    // En mode local, on ne met pas à jour la BDD
    if (!isLocalProject(projectId)) {
      const project = await database.query.projects.findFirst({
        where: eq(projects.id, projectId),
      });

      if (project) {
        const content = project.content as {
          nodes: Node[];
          edges: Edge[];
          viewport: Viewport;
        };

        const updatedNodes = content.nodes.map((existingNode) => {
          if (existingNode.id === nodeId) {
            return {
              ...existingNode,
              data: newData,
            };
          }
          return existingNode;
        });

        await database
          .update(projects)
          .set({ content: { ...content, nodes: updatedNodes } })
          .where(eq(projects.id, projectId));
      }
    }

    return {
      nodeData: newData,
    };
  } catch (error) {
    const message = parseError(error);
    return { error: message };
  }
};
