'use server';

import { getSubscribedUser } from '@/lib/auth';
import { database } from '@/lib/database';
import { parseError } from '@/lib/error/parse';
import { imageModels } from '@/lib/models/image';
import { trackCreditUsage } from '@/lib/stripe';
import { uploadBuffer, generateUniqueFilename } from '@/lib/storage';
import { isLocalProject } from '@/lib/local-project';
import { wavespeedImage, type WaveSpeedEditParams } from '@/lib/models/image/wavespeed';
import { projects } from '@/schema';
import type { Edge, Node, Viewport } from '@xyflow/react';
import {
  type Experimental_GenerateImageResult,
  experimental_generateImage as generateImage,
} from 'ai';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import OpenAI, { toFile } from 'openai';
import fs from 'fs';
import path from 'path';

// Convertit une URL relative en contenu (pour les fichiers locaux)
async function fetchImageContent(url: string): Promise<{ blob: Blob; buffer: Buffer }> {
  // Si c'est une URL locale /api/storage/...
  if (url.startsWith('/api/storage/')) {
    const relativePath = url.replace('/api/storage/', '');
    const storagePath = process.env.LOCAL_STORAGE_PATH || './storage';
    const filePath = path.join(storagePath, relativePath);
    
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      const blob = new Blob([buffer]);
      return { blob, buffer };
    }
  }
  
  // Sinon, fetch normal (URL absolue)
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const blob = new Blob([buffer]);
  return { blob, buffer };
}

// Convertit un fichier local en URL publique pour WaveSpeed
async function getPublicImageUrl(url: string): Promise<string> {
  // Si c'est déjà une URL absolue, la retourner
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // Si c'est une URL locale, convertir en base64 data URL
  if (url.startsWith('/api/storage/')) {
    const { buffer } = await fetchImageContent(url);
    const ext = url.split('.').pop()?.toLowerCase();
    const mimeType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  }

  return url;
}

type EditImageActionProps = {
  images: {
    url: string;
    type: string;
  }[];
  modelId: string;
  instructions?: string;
  nodeId: string;
  projectId: string;
  size?: string;
};

const generateGptImage1Image = async ({
  prompt,
  size,
  images,
}: {
  prompt: string;
  size?: string;
  images: {
    url: string;
    type: string;
  }[];
}) => {
  const openai = new OpenAI();
  const promptImages = await Promise.all(
    images.map(async (image) => {
      const { blob } = await fetchImageContent(image.url);

      return toFile(blob, nanoid(), {
        type: image.type,
      });
    })
  );

  const response = await openai.images.edit({
    model: 'gpt-image-1',
    image: promptImages,
    prompt,
    size: size as never | undefined,
    quality: 'high',
  });

  const json = response.data?.at(0)?.b64_json;

  if (!json) {
    throw new Error('No response JSON found');
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

// Édite une image via WaveSpeed API
async function editWaveSpeedImage(
  modelId: string,
  images: { url: string; type: string }[],
  prompt: string,
  size?: string
): Promise<{ url: string; mediaType: string }> {
  // Mapper les IDs de modèle vers les instances WaveSpeed Edit
  const modelMap: Record<string, () => ReturnType<typeof wavespeedImage.nanoBananaProEdit>> = {
    // Nano Banana Edit
    'nano-banana-edit-wavespeed': wavespeedImage.nanoBananaEdit,
    'nano-banana-pro-edit-wavespeed': wavespeedImage.nanoBananaProEdit,
    'nano-banana-pro-edit-multi-wavespeed': wavespeedImage.nanoBananaProEditMulti,
    'nano-banana-pro-edit-ultra-wavespeed': wavespeedImage.nanoBananaProEditUltra,
    'nano-banana-effects-wavespeed': wavespeedImage.nanoBananaEffects,
    // Gemini Edit
    'gemini-2.5-flash-edit-wavespeed': wavespeedImage.gemini25FlashEdit,
    'gemini-3-pro-edit-wavespeed': wavespeedImage.gemini3ProEdit,
    // Flux Kontext (edit)
    'flux-kontext-dev-wavespeed': wavespeedImage.fluxKontextDev,
    'flux-kontext-pro-wavespeed': wavespeedImage.fluxKontextPro,
    'flux-kontext-max-wavespeed': wavespeedImage.fluxKontextMax,
    // Qwen Edit
    'qwen-edit-wavespeed': wavespeedImage.qwenEdit,
    'qwen-edit-plus-wavespeed': wavespeedImage.qwenEditPlus,
  };

  const modelFactory = modelMap[modelId];
  if (!modelFactory) {
    throw new Error(`Modèle WaveSpeed Edit non supporté: ${modelId}`);
  }

  const model = modelFactory();
  
  // Convertir les images en URLs publiques ou base64
  const imageUrls = await Promise.all(
    images.map(img => getPublicImageUrl(img.url))
  );

  const params: WaveSpeedEditParams = {
    prompt,
    images: imageUrls,
    resolution: size?.includes('2048') ? '4k' : size?.includes('1536') ? '2k' : '1k',
    output_format: 'png',
  };

  console.log(`[WaveSpeed] Édition avec modèle: ${modelId}`);
  const imageUrl = await model.generate(params);

  return {
    url: imageUrl,
    mediaType: 'image/png',
  };
}

export const editImageAction = async ({
  images,
  instructions,
  modelId,
  nodeId,
  projectId,
  size,
}: EditImageActionProps): Promise<
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

    if (!model.supportsEdit) {
      throw new Error('Model does not support editing');
    }

    const provider = model.providers[0];

    let imageBuffer: Buffer;
    let mediaType: string = 'image/png';

    const defaultPrompt =
      images.length > 1
        ? 'Create a variant of the image.'
        : 'Create a single variant of the images.';

    const prompt =
      !instructions || instructions === '' ? defaultPrompt : instructions;

    // Vérifier si c'est un modèle WaveSpeed Edit
    if (modelId.endsWith('-wavespeed') && model.supportsEdit) {
      console.log(`[WaveSpeed] Détecté modèle Edit WaveSpeed: ${modelId}`);
      const result = await editWaveSpeedImage(modelId, images, prompt, size);
      
      // Télécharger l'image depuis l'URL WaveSpeed
      const response = await fetch(result.url);
      const arrayBuffer = await response.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
      mediaType = result.mediaType;

      await trackCreditUsage({
        action: 'generate_image',
        cost: provider.getCost({ size }),
      });
    } else if (provider.model.modelId === 'gpt-image-1') {
      const generatedImageResponse = await generateGptImage1Image({
        prompt,
        images,
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
      const { buffer } = await fetchImageContent(images[0].url);
      const base64Image = buffer.toString('base64');

      const generatedImageResponse = await generateImage({
        model: provider.model,
        prompt,
        size: size as never,
        providerOptions: {
          bfl: {
            image: base64Image,
          },
        },
      });

      await trackCreditUsage({
        action: 'generate_image',
        cost: provider.getCost({ size }),
      });

      imageBuffer = Buffer.from(generatedImageResponse.image.uint8Array);
      mediaType = generatedImageResponse.image.mediaType;
    }

    const bytes = imageBuffer;
    const contentType = mediaType;

    // Utiliser le wrapper de stockage unifié (local ou Supabase)
    const name = generateUniqueFilename('png');
    const stored = await uploadBuffer(bytes, name, contentType);

    // En mode local, créer les données directement sans accès BDD
    const newData = {
      updatedAt: new Date().toISOString(),
      generated: {
        url: stored.url,
        type: contentType,
      },
      description: instructions ?? defaultPrompt,
    };

    // En mode local, on ne met pas à jour la BDD
    if (!isLocalProject(projectId)) {
      const project = await database.query.projects.findFirst({
        where: eq(projects.id, projectId),
      });

      if (!project) {
        throw new Error('Project not found');
      }

      const content = project.content as {
        nodes: Node[];
        edges: Edge[];
        viewport: Viewport;
      };

      const existingNode = content.nodes.find((n) => n.id === nodeId);

      if (existingNode) {
        Object.assign(newData, existingNode.data, newData);
      }

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
