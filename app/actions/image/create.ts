'use server';

import { getSubscribedUser } from '@/lib/auth';
import { database } from '@/lib/database';
import { parseError } from '@/lib/error/parse';
import { imageModels } from '@/lib/models/image';
import { visionModels } from '@/lib/models/vision';
import { trackCreditUsage } from '@/lib/stripe';
import { uploadBuffer, generateUniqueFilename } from '@/lib/storage';
import { isLocalProject, getLocalProject } from '@/lib/local-project';
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

    let image: Experimental_GenerateImageResult['image'] | undefined;

    const provider = model.providers[0];

    if (provider.model.modelId === 'gpt-image-1') {
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

      image = generatedImageResponse.image;
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
        cost: provider.getCost({
          size,
        }),
      });

      image = generatedImageResponse.image;
    }

    let extension = image.mediaType.split('/').pop();

    if (extension === 'jpeg') {
      extension = 'jpg';
    }

    const name = generateUniqueFilename(extension || 'png');

    // Utiliser le wrapper de stockage unifié (local ou Supabase)
    const stored = await uploadBuffer(
      Buffer.from(image.uint8Array),
      name,
      image.mediaType
    );

    // URL pour affichage : en mode local on utilise l'URL de stockage local
    const displayUrl = stored.url;
    
    // URL pour OpenAI : doit être base64 en mode local
    const openaiUrl = isLocalMode
      ? `data:${image.mediaType};base64,${Buffer.from(image.uint8Array).toString('base64')}`
      : stored.url;

    // Description optionnelle - essayer avec OpenAI si disponible
    let description = `Generated from prompt: ${prompt}`;
    
    try {
      // Vérifier si on a une clé OpenAI
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
        type: image.mediaType,
      },
      description,
    };

    // En mode local, on ne met pas à jour la BDD - le frontend gère l'état
    if (!isLocalProject(projectId)) {
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

    return {
      nodeData: newData,
    };
  } catch (error) {
    const message = parseError(error);

    return { error: message };
  }
};
