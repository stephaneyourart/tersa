'use server';

import { getSubscribedUser } from '@/lib/auth';
import { database } from '@/lib/database';
import { parseError } from '@/lib/error/parse';
import { imageModels } from '@/lib/models/image';
import { visionModels } from '@/lib/models/vision';
import { trackCreditUsage } from '@/lib/stripe';
import { uploadBuffer, generateUniqueFilename } from '@/lib/storage';
import { isLocalProject, getLocalProject } from '@/lib/local-project';
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

type GenerateImageActionProps = {
  prompt: string;
  nodeId: string;
  projectId: string;
  modelId: string;
  instructions?: string;
  size?: string;
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
async function generateWaveSpeedImage(
  modelId: string,
  prompt: string,
  instructions?: string,
  size?: string
): Promise<{ url: string; mediaType: string }> {
  // Mapper les IDs de modèle vers les instances WaveSpeed
  const modelMap: Record<string, () => ReturnType<typeof wavespeedImage.nanoBananaPro>> = {
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

  const params: WaveSpeedTextToImageParams = {
    prompt: fullPrompt,
    aspect_ratio: size ? sizeToAspectRatio(size) : '1:1',
    output_format: 'png',
  };

  console.log(`[WaveSpeed] Génération avec modèle: ${modelId}`);
  const imageUrl = await model.generate(params);

  return {
    url: imageUrl,
    mediaType: 'image/png',
  };
}

export const generateImageAction = async ({
  prompt,
  modelId,
  instructions,
  nodeId,
  projectId,
  size,
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
      const result = await generateWaveSpeedImage(modelId, prompt, instructions, size);
      
      // Télécharger l'image depuis l'URL WaveSpeed
      console.log(`[WaveSpeed] Téléchargement de l'image: ${result.url}`);
      const response = await fetch(result.url);
      
      if (!response.ok) {
        console.error(`[WaveSpeed] Erreur téléchargement: ${response.status} ${response.statusText}`);
        throw new Error(`Erreur téléchargement image: ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      console.log(`[WaveSpeed] Image téléchargée: ${arrayBuffer.byteLength} bytes`);
      imageBuffer = Buffer.from(arrayBuffer);
      mediaType = result.mediaType;

      await trackCreditUsage({
        action: 'generate_image',
        cost: provider.getCost({ size }),
      });
    } else if (provider.model.modelId === 'gpt-image-1') {
      const generatedImageResponse = await generateGptImage1Image({
        instructions,
        prompt,
        size,
      });

      await trackCreditUsage({
        action: 'generate_image',
        cost: provider.getCost({
          ...generatedImageResponse.usage,
          size,
        }),
      });

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

      await trackCreditUsage({
        action: 'generate_image',
        cost: provider.getCost({ size }),
      });

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

    const newData = {
      updatedAt: new Date().toISOString(),
      generated: {
        url: displayUrl,
        type: mediaType,
      },
      description,
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
