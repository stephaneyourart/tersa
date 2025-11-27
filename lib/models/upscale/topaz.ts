/**
 * Provider Topaz pour l'upscaling (via Fal.ai)
 * Supporte: Image Upscaler, Video Upscaler
 */

import type { UpscaleModel } from '.';

type TopazImageModel = 'fal-ai/topaz/upscale/image';
type TopazVideoModel = 'fal-ai/topaz/upscale/video';

type TopazImageRequest = {
  image_url: string;
  scale?: number;
  enhance_face?: boolean;
  denoise_strength?: number;
  output_format?: 'png' | 'jpeg' | 'webp';
};

type TopazVideoRequest = {
  video_url: string;
  scale?: number;
  denoise_strength?: number;
  output_format?: 'mp4' | 'webm';
};

type TopazResponse = {
  image?: { url: string };
  video?: { url: string };
};

/**
 * Appelle l'API Topaz via Fal.ai
 */
async function callTopazApi<T extends TopazImageRequest | TopazVideoRequest>(
  modelId: TopazImageModel | TopazVideoModel,
  input: T
): Promise<string> {
  const apiKey = process.env.FAL_API_KEY;
  
  if (!apiKey) {
    throw new Error('FAL_API_KEY non configuré');
  }

  const baseUrl = 'https://queue.fal.run';
  const endpoint = `${baseUrl}/${modelId}`;

  // Soumettre la requête
  const submitResponse = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!submitResponse.ok) {
    const error = await submitResponse.text();
    throw new Error(`Erreur Topaz API: ${error}`);
  }

  const { request_id, status_url } = await submitResponse.json();

  // Polling pour le résultat
  let attempts = 0;
  const maxAttempts = 120; // 10 minutes max pour les vidéos
  
  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 3000)); // 3 secondes

    const statusResponse = await fetch(status_url, {
      headers: {
        'Authorization': `Key ${apiKey}`,
      },
    });

    if (!statusResponse.ok) {
      throw new Error('Erreur lors de la vérification du statut');
    }

    const statusData = await statusResponse.json();

    if (statusData.status === 'COMPLETED') {
      const result = statusData.result as TopazResponse;
      
      // Retourner l'URL selon le type
      if (result.image?.url) return result.image.url;
      if (result.video?.url) return result.video.url;
      
      throw new Error('Aucun résultat dans la réponse');
    }

    if (statusData.status === 'FAILED') {
      throw new Error(statusData.error || 'Upscaling échoué');
    }

    attempts++;
  }

  throw new Error('Timeout: upscaling trop long');
}

/**
 * Crée un modèle d'upscale image Topaz
 */
function createTopazImageModel(): UpscaleModel {
  return {
    modelId: 'fal-ai/topaz/upscale/image',
    generate: async ({ imageUrl, scale, enhanceFace, denoiseStrength }) => {
      if (!imageUrl) {
        throw new Error('imageUrl requis pour l\'upscaling image');
      }

      const input: TopazImageRequest = {
        image_url: imageUrl,
        scale: scale || 2,
        enhance_face: enhanceFace,
        denoise_strength: denoiseStrength,
        output_format: 'png',
      };

      return callTopazApi('fal-ai/topaz/upscale/image', input);
    },
  };
}

/**
 * Crée un modèle d'upscale vidéo Topaz
 */
function createTopazVideoModel(): UpscaleModel {
  return {
    modelId: 'fal-ai/topaz/upscale/video',
    generate: async ({ videoUrl, scale, denoiseStrength }) => {
      if (!videoUrl) {
        throw new Error('videoUrl requis pour l\'upscaling vidéo');
      }

      const input: TopazVideoRequest = {
        video_url: videoUrl,
        scale: scale || 2,
        denoise_strength: denoiseStrength,
        output_format: 'mp4',
      };

      return callTopazApi('fal-ai/topaz/upscale/video', input);
    },
  };
}

/**
 * Export des modèles Topaz
 */
export const topaz = {
  image: (): UpscaleModel => createTopazImageModel(),
  video: (): UpscaleModel => createTopazVideoModel(),
};

