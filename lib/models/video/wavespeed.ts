/**
 * Provider WaveSpeed pour les modèles vidéo
 * Supporte: Kling, Seedream, WAN et autres modèles via WaveSpeed API v3
 */

import type { VideoModel } from '.';

// Mapping des modelId courts vers les chemins API complets
const MODEL_PATH_MAP: Record<string, string> = {
  // Kling O1 (nouveau modèle de raisonnement)
  'kling-o1': 'kwaivgi/kling-video-o1/text-to-video',
  'kling-o1-i2v': 'kwaivgi/kling-video-o1/image-to-video',
  'kling-o1-ref': 'kwaivgi/kling-video-o1/reference-to-video', // NOUVEAU: reference-to-video avec images multiples
  // Kling 2.6 Pro (nouveau)
  'kling-v2.6-pro-t2v': 'kwaivgi/kling-v2.6-pro/text-to-video',
  'kling-v2.6-pro-i2v': 'kwaivgi/kling-v2.6-pro/image-to-video',
  // Kling 2.5
  'kling-v2.5-turbo': 'kwaivgi/kling-v2.5-turbo-pro/image-to-video',
  'kling-v2.5-standard': 'kwaivgi/kling-v2.5-std/image-to-video',
  'kling-v2.5-pro': 'kwaivgi/kling-v2.5-pro/image-to-video',
  // Seedream
  'seedream-v1': 'wavespeed-ai/seedream-3.0/image-to-video',
  // WAN
  'wan-2.1': 'wavespeed-ai/wan-2.1/image-to-video',
  'wan-2.1-pro': 'wavespeed-ai/wan-2.1-pro/image-to-video',
  // Veo
  'veo3.1-i2v': 'google/veo3.1-image-to-video',
  'veo3.1-t2v': 'google/veo3.1-text-to-video',
  // Sora
  'sora-2-i2v': 'openai/sora-2-image-to-video-pro',
  'sora-2-t2v': 'openai/sora-2-text-to-video-pro',
};

// Types pour l'API WaveSpeed
type WaveSpeedVideoModel =
  | 'kling-o1'
  | 'kling-o1-i2v'
  | 'kling-o1-ref'      // NOUVEAU: reference-to-video
  | 'kling-v2.6-pro-t2v' // NOUVEAU
  | 'kling-v2.6-pro-i2v' // NOUVEAU
  | 'kling-v2.5-turbo'
  | 'kling-v2.5-standard'
  | 'kling-v2.5-pro'
  | 'seedream-v1'
  | 'wan-2.1'
  | 'wan-2.1-pro'
  | 'veo3.1-i2v'
  | 'veo3.1-t2v'
  | 'sora-2-i2v'
  | 'sora-2-t2v';

type WaveSpeedRequest = {
  prompt: string;
  image?: string;
  last_image?: string;  // Last frame pour Kling (paramètre officiel)
  images?: string[];
  duration?: number;
  aspect_ratio?: string;
  resolution?: string;
  negative_prompt?: string;
  seed?: number;
  guidance_scale?: number;
  enable_base64_output?: boolean;
  enable_sync_mode?: boolean;
};

type WaveSpeedResponse = {
  data?: {
    id: string;
    status: string;
    outputs?: string[];
    urls?: {
      get: string;
    };
  };
  code?: number;
  message?: string;
};

/**
 * Appelle l'API WaveSpeed v3
 */
async function callWaveSpeedApi(
  model: WaveSpeedVideoModel,
  input: WaveSpeedRequest
): Promise<string> {
  const apiKey = process.env.WAVESPEED_API_KEY;
  
  if (!apiKey) {
    throw new Error('WAVESPEED_API_KEY non configuré');
  }

  const modelPath = MODEL_PATH_MAP[model];
  if (!modelPath) {
    throw new Error(`Modèle inconnu: ${model}`);
  }

  const baseUrl = 'https://api.wavespeed.ai/api/v3';

  // Soumettre la requête de génération
  console.log(`[WaveSpeed Video] POST ${baseUrl}/${modelPath}`);
  console.log(`[WaveSpeed Video] Body:`, JSON.stringify(input, null, 2));

  const submitResponse = await fetch(`${baseUrl}/${modelPath}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...input,
      enable_base64_output: false,
      enable_sync_mode: false,
    }),
  });

  if (!submitResponse.ok) {
    const error = await submitResponse.text();
    throw new Error(`Erreur WaveSpeed API: ${error}`);
  }

  const responseData = await submitResponse.json() as WaveSpeedResponse;
  console.log(`[WaveSpeed Video] Response:`, JSON.stringify(responseData, null, 2));

  // Vérifier si on a directement le résultat
  if (responseData.data?.outputs?.[0]) {
    return responseData.data.outputs[0];
  }

  // Sinon, polling pour le résultat
  const pollUrl = responseData.data?.urls?.get;
  if (!pollUrl) {
    throw new Error('Pas d\'URL de polling dans la réponse');
  }

  let attempts = 0;
  const maxAttempts = 180; // 6 minutes max (2s * 180)

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 secondes

    const statusResponse = await fetch(pollUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      throw new Error(`Erreur polling: ${errorText}`);
    }

    const statusData = await statusResponse.json() as WaveSpeedResponse;

    if (statusData.data?.status === 'completed' && statusData.data?.outputs?.[0]) {
      console.log(`[WaveSpeed Video] Completed after ${attempts * 2}s`);
      return statusData.data.outputs[0];
    }

    if (statusData.data?.status === 'failed') {
      throw new Error(statusData.message || 'Génération vidéo échouée');
    }

    attempts++;
    if (attempts % 15 === 0) {
      console.log(`[WaveSpeed Video] Still processing... (${attempts * 2}s)`);
    }
  }

  throw new Error('Timeout: génération vidéo trop longue');
}

/**
 * Crée un modèle vidéo WaveSpeed standard (image-to-video, text-to-video)
 */
function createWaveSpeedModel(modelId: WaveSpeedVideoModel): VideoModel {
  return {
    modelId,
    generate: async ({ prompt, imagePrompt, lastFrameImage, duration, aspectRatio }) => {
      const input: WaveSpeedRequest = {
        prompt,
        aspect_ratio: aspectRatio || '16:9',
        duration: duration || 5,
      };

      // Ajouter first frame (image) si fournie
      if (imagePrompt) {
        input.image = imagePrompt;
      }

      // Ajouter last frame (last_image) si fournie - supporté par Kling
      if (lastFrameImage) {
        input.last_image = lastFrameImage;
        console.log(`[WaveSpeed Video] Adding last_image for first-last frame animation`);
      }

      return callWaveSpeedApi(modelId, input);
    },
  };
}

/**
 * Crée un modèle vidéo KLING v2.6 optimisé pour first+last frame
 * IMPORTANT : Quand on utilise last_image, on ne doit PAS spécifier aspect_ratio
 * Le ratio est déduit des images d'entrée (21:9 → crop 16:9)
 * native_audio est désactivé car il bloque last_image
 */
function createKling26FirstLastModel(modelId: WaveSpeedVideoModel): VideoModel {
  return {
    modelId,
    generate: async ({ prompt, imagePrompt, lastFrameImage, duration }) => {
      const input: WaveSpeedRequest = {
        prompt,
        duration: duration || 5,
        // PAS de aspect_ratio - déduit des images d'entrée
        // PAS de native_audio - bloque last_image
      };

      // First frame (image de départ)
      if (imagePrompt) {
        input.image = imagePrompt;
        console.log(`[WaveSpeed KLING 2.6] First frame: ${imagePrompt.substring(0, 50)}...`);
      }

      // Last frame (image de fin) - OBLIGATOIRE pour ce modèle
      if (lastFrameImage) {
        input.last_image = lastFrameImage;
        console.log(`[WaveSpeed KLING 2.6] Last frame: ${lastFrameImage.substring(0, 50)}...`);
      }

      if (!imagePrompt || !lastFrameImage) {
        console.warn(`[WaveSpeed KLING 2.6] Attention: first ou last frame manquant`);
      }

      return callWaveSpeedApi(modelId, input);
    },
  };
}

/**
 * Crée un modèle vidéo WaveSpeed reference-to-video
 * Ce modèle utilise un tableau d'images de référence (personnages, décors)
 * pour maintenir la cohérence dans la vidéo générée
 */
function createReferenceToVideoModel(modelId: WaveSpeedVideoModel): VideoModel {
  return {
    modelId,
    generate: async ({ prompt, imagePrompt, referenceImages, duration, aspectRatio }) => {
      const input: WaveSpeedRequest = {
        prompt,
        aspect_ratio: aspectRatio || '16:9',
        duration: duration || 5,
      };

      // Pour reference-to-video, on utilise le champ 'images' avec un tableau
      // Combiner l'image principale et les images de référence
      const allImages: string[] = [];
      
      if (imagePrompt) {
        allImages.push(imagePrompt);
      }
      
      if (referenceImages && referenceImages.length > 0) {
        allImages.push(...referenceImages);
      }
      
      if (allImages.length > 0) {
        input.images = allImages;
        console.log(`[WaveSpeed Video] Reference-to-video avec ${allImages.length} images de référence`);
      }

      return callWaveSpeedApi(modelId, input);
    },
  };
}

/**
 * Export des modèles WaveSpeed
 */
export const wavespeed = {
  // Kling O1 (nouveau modèle de raisonnement)
  klingO1: (): VideoModel => createWaveSpeedModel('kling-o1'),
  klingO1I2V: (): VideoModel => createWaveSpeedModel('kling-o1-i2v'),
  klingO1Ref: (): VideoModel => createReferenceToVideoModel('kling-o1-ref'), // NOUVEAU: reference-to-video

  // Kling 2.6 Pro
  kling26ProT2V: (): VideoModel => createWaveSpeedModel('kling-v2.6-pro-t2v'),
  kling26ProI2V: (): VideoModel => createWaveSpeedModel('kling-v2.6-pro-i2v'),
  // NOUVEAU: Modèle optimisé pour first+last frame (briefs)
  kling26ProFirstLast: (): VideoModel => createKling26FirstLastModel('kling-v2.6-pro-i2v'),

  // Kling 2.5 via WaveSpeed
  kling25Turbo: (): VideoModel => createWaveSpeedModel('kling-v2.5-turbo'),
  kling25Standard: (): VideoModel => createWaveSpeedModel('kling-v2.5-standard'),
  kling25Pro: (): VideoModel => createWaveSpeedModel('kling-v2.5-pro'),

  // Seedream
  seedream: (): VideoModel => createWaveSpeedModel('seedream-v1'),

  // Wan
  wan21: (): VideoModel => createWaveSpeedModel('wan-2.1'),
  wan21Pro: (): VideoModel => createWaveSpeedModel('wan-2.1-pro'),
};

