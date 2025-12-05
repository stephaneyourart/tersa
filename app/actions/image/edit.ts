'use server';

import { getSubscribedUser } from '@/lib/auth';
import { database } from '@/lib/database';
import { parseError } from '@/lib/error/parse';
import { imageModels } from '@/lib/models/image';
import { trackCreditUsage } from '@/lib/stripe';
import { uploadBuffer, generateUniqueFilename } from '@/lib/storage';
import { isLocalProject } from '@/lib/local-project';
import { saveMediaMetadata } from '@/lib/media-metadata';

// Mode local
const isLocalMode = process.env.LOCAL_MODE === 'true';
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

// Lit originalUrl depuis le fichier .meta.json d'une image locale
function getOriginalUrlFromMeta(localUrl: string): string | null {
  if (!localUrl.startsWith('/api/storage/')) return null;
  
  const relativePath = localUrl.replace('/api/storage/', '');
  const storagePath = process.env.LOCAL_STORAGE_PATH || './storage';
  const filePath = path.join(storagePath, relativePath);
  const metaPath = `${filePath}.meta.json`;
  
  try {
    if (fs.existsSync(metaPath)) {
      const metaContent = fs.readFileSync(metaPath, 'utf-8');
      const meta = JSON.parse(metaContent);
      if (meta.originalUrl && (meta.originalUrl.startsWith('http://') || meta.originalUrl.startsWith('https://'))) {
        console.log(`[WaveSpeed] Found originalUrl in .meta.json: ${meta.originalUrl.substring(0, 60)}...`);
        return meta.originalUrl;
      }
    }
  } catch (e) {
    console.warn(`[WaveSpeed] Could not read .meta.json for ${localUrl}:`, e);
  }
  return null;
}

// Convertit un fichier local en URL publique pour WaveSpeed
// IMPORTANT: Utilise originalUrl (CloudFront) en priorité pour éviter base64 et limite 30MB
async function getPublicImageUrl(img: { url: string; originalUrl?: string }): Promise<string> {
  // Priorité 1: URL CloudFront originale (depuis données du nœud)
  if (img.originalUrl && (img.originalUrl.startsWith('http://') || img.originalUrl.startsWith('https://'))) {
    console.log(`[WaveSpeed] Using originalUrl from node data: ${img.originalUrl.substring(0, 60)}...`);
    return img.originalUrl;
  }
  
  // Priorité 2: URL publique directe
  if (img.url.startsWith('http://') || img.url.startsWith('https://')) {
    console.log(`[WaveSpeed] Using public URL: ${img.url.substring(0, 60)}...`);
    return img.url;
  }

  // Priorité 3: Lire originalUrl depuis le fichier .meta.json
  if (img.url.startsWith('/api/storage/')) {
    const metaOriginalUrl = getOriginalUrlFromMeta(img.url);
    if (metaOriginalUrl) {
      return metaOriginalUrl;
    }
    
    // FALLBACK: URL locale sans originalUrl - AVERTISSEMENT car peut dépasser 30MB
    console.warn(`[WaveSpeed] ⚠️ No originalUrl for local image (not in node data nor .meta.json), converting to base64 (may exceed 30MB limit): ${img.url}`);
    const { buffer } = await fetchImageContent(img.url);
    const ext = img.url.split('.').pop()?.toLowerCase();
    const mimeType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  }

  return img.url;
}

type EditImageActionProps = {
  images: {
    url: string;
    type: string;
    originalUrl?: string; // URL CloudFront pour WaveSpeed (évite conversion base64)
  }[];
  modelId: string;
  instructions?: string;
  nodeId: string;
  projectId: string;
  // MODE TEST: utilise size (dimensions en pixels)
  size?: string;
  // MODE PROD: utilise aspectRatio + resolution directement pour WaveSpeed
  aspectRatio?: string;
  resolution?: string; // '4k' ou '8k'
  // Paramètres optionnels pour certains modèles
  numInferenceSteps?: number;
  guidanceScale?: number;
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
// MODE PROD: aspectRatio + resolution sont passés directement à WaveSpeed
// MODE TEST: size est passé (dimensions en pixels)
async function editWaveSpeedImage(
  modelId: string,
  images: { url: string; type: string; originalUrl?: string }[],
  prompt: string,
  options?: {
    size?: string;           // MODE TEST: dimensions en pixels
    aspectRatio?: string;    // MODE PROD: ratio direct
    resolution?: string;     // MODE PROD: '4k' ou '8k'
    numInferenceSteps?: number;
    guidanceScale?: number;
  }
): Promise<{ url: string; mediaType: string; aspectRatio?: string }> {
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
    'flux-kontext-dev-multi-ultra-fast-wavespeed': wavespeedImage.fluxKontextDevMultiUltraFast,
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
  
  // Déterminer les limites d'images selon le modèle
  const isNanoBananaBasicEdit = modelId === 'nano-banana-edit-wavespeed';
  const isFluxKontextMulti = modelId.includes('flux-kontext-dev-multi');
  const isNanoBananaProEdit = modelId.includes('nano-banana-pro-edit');
  
  // nano-banana/edit supporte max 10 images, nano-banana-pro/edit supporte 14
  const maxImages = isNanoBananaBasicEdit ? 10 : 14;
  const imagesToUse = images.slice(0, maxImages);
  
  if (images.length > maxImages) {
    console.log(`[WaveSpeed] Limitation: ${images.length} images -> ${maxImages} max pour ${modelId}`);
  }
  
  // Convertir les images en URLs publiques (utilise originalUrl CloudFront en priorité)
  const imageUrls = await Promise.all(
    imagesToUse.map(img => getPublicImageUrl({ url: img.url, originalUrl: img.originalUrl }))
  );
  
  const params: WaveSpeedEditParams = {
    prompt,
    images: imageUrls,
    output_format: 'png',
  };
  
  // Déterminer le mode (PROD ou TEST)
  const isProdMode = options?.aspectRatio && options?.resolution;
  
  if (isProdMode && isNanoBananaProEdit) {
    // MODE PROD pour Nano Banana Pro Edit: aspect_ratio + resolution directement
    (params as Record<string, unknown>).aspect_ratio = options.aspectRatio;
    params.resolution = options.resolution as '1k' | '2k' | '4k';
    console.log(`[WaveSpeed] MODE PROD - aspect_ratio: ${options.aspectRatio}, resolution: ${options.resolution}`);
  } else if (isFluxKontextMulti && options?.size) {
    // Format "widthxheight" pour flux-kontext-dev/multi (MODE TEST)
    (params as Record<string, unknown>).size = options.size;
    console.log(`[WaveSpeed] Flux Kontext Multi - size: ${options.size}`);
  } else if (isNanoBananaProEdit && options?.size) {
    // MODE TEST pour Nano Banana Pro Edit: dériver resolution depuis size
    const resolution = options.size?.includes('2048') ? '4k' : options.size?.includes('1536') ? '2k' : '1k';
    params.resolution = resolution;
    console.log(`[WaveSpeed] MODE TEST - size: ${options.size} -> resolution: ${resolution}`);
  } else if (isNanoBananaBasicEdit) {
    // nano-banana-edit (pas pro) n'a pas de paramètre de taille
    console.log(`[WaveSpeed] nano-banana-edit: pas de paramètre de taille`);
  }
  
  // Ajouter les paramètres optionnels si fournis ET si le modèle les supporte
  // nano-banana-edit (pas pro) ne supporte PAS ces paramètres
  if (!isNanoBananaBasicEdit) {
    if (options?.numInferenceSteps !== undefined) {
      (params as Record<string, unknown>).num_inference_steps = options.numInferenceSteps;
    }
    if (options?.guidanceScale !== undefined) {
      params.guidance_scale = options.guidanceScale;
    }
  }

  console.log(`[WaveSpeed] Édition avec modèle: ${modelId}`, {
    aspectRatio: options?.aspectRatio,
    resolution: options?.resolution,
    size: options?.size,
    steps: options?.numInferenceSteps,
    guidance: options?.guidanceScale,
  });
  const imageUrl = await model.generate(params);

  return {
    url: imageUrl,
    mediaType: 'image/png',
    aspectRatio: options?.aspectRatio,
  };
}

export const editImageAction = async ({
  images,
  instructions,
  modelId,
  nodeId,
  projectId,
  size,
  aspectRatio,
  resolution,
  numInferenceSteps,
  guidanceScale,
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
    let cloudFrontOriginalUrl: string | undefined; // URL CloudFront pour réutilisation dans WaveSpeed

    const defaultPrompt =
      images.length > 1
        ? 'Create a variant of the image.'
        : 'Create a single variant of the images.';

    const prompt =
      !instructions || instructions === '' ? defaultPrompt : instructions;

    // Vérifier si c'est un modèle WaveSpeed Edit
    if (modelId.endsWith('-wavespeed') && model.supportsEdit) {
      console.log(`[WaveSpeed] Détecté modèle Edit WaveSpeed: ${modelId}`);
      const result = await editWaveSpeedImage(modelId, images, prompt, {
        size,
        aspectRatio,
        resolution,
        numInferenceSteps,
        guidanceScale,
      });
      
      // IMPORTANT: Stocker l'URL CloudFront originale pour éviter base64 lors des réutilisations
      cloudFrontOriginalUrl = result.url;
      
      // Télécharger l'image depuis l'URL WaveSpeed
      const response = await fetch(result.url);
      const arrayBuffer = await response.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
      mediaType = result.mediaType;

      if (!isLocalMode) {
        await trackCreditUsage({
          action: 'generate_image',
          cost: provider.getCost({ size }),
        });
      }
    } else if (provider.model.modelId === 'gpt-image-1') {
      const generatedImageResponse = await generateGptImage1Image({
        prompt,
        images,
        size,
      });

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

      if (!isLocalMode) {
        await trackCreditUsage({
          action: 'generate_image',
          cost: provider.getCost({ size }),
        });
      }

      imageBuffer = Buffer.from(generatedImageResponse.image.uint8Array);
      mediaType = generatedImageResponse.image.mediaType;
    }

    const bytes = imageBuffer;
    const contentType = mediaType;

    // Utiliser le wrapper de stockage unifié (local ou Supabase)
    const name = generateUniqueFilename('png');
    const stored = await uploadBuffer(bytes, name, contentType);

    // Sauvegarder les métadonnées dans un fichier sidecar .meta.json
    // Cela permet à la Media Library d'afficher le modèle utilisé
    // IMPORTANT: Inclure originalUrl pour permettre réutilisation sans conversion base64
    if (stored.path) {
      saveMediaMetadata(stored.path, {
        isGenerated: true,
        modelId: modelId,
        prompt: instructions || '',
        format: contentType,
        generatedAt: new Date().toISOString(),
        // Marquer comme image secondaire (edit) pour le tracking
        generationType: 'edit',
        sourceImagesCount: images.length,
        originalUrl: cloudFrontOriginalUrl, // URL CloudFront WaveSpeed pour réutilisation
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

    // En mode local, créer les données directement sans accès BDD
    const newData = {
      updatedAt: new Date().toISOString(),
      generated: {
        url: stored.url,
        type: contentType,
        model: modelId, // Ajouter le modèle utilisé pour les métadonnées
        originalUrl: cloudFrontOriginalUrl, // URL CloudFront pour WaveSpeed (évite base64)
      },
      // Stocker les dimensions réelles pour un affichage correct dans les nœuds
      width,
      height,
      description: instructions ?? defaultPrompt,
      model: modelId, // Pour l'affichage dans la media library
      isGenerated: true, // Marquer comme généré pour le tracking
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
