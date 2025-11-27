/**
 * Provider Fal.ai pour les modèles vidéo
 * Supporte: Kling 2.5, Pixverse, Seedream, etc.
 */

import type { VideoModel } from '.';

// Types pour l'API Fal
type FalVideoModel =
  | 'fal-ai/kling-video/v2.5/standard/image-to-video'
  | 'fal-ai/kling-video/v2.5/standard/text-to-video'
  | 'fal-ai/kling-video/v2.5/pro/image-to-video'
  | 'fal-ai/kling-video/v2.5/pro/text-to-video'
  | 'fal-ai/pixverse/v3.5/text-to-video'
  | 'fal-ai/pixverse/v3.5/image-to-video'
  | 'fal-ai/mochi-v1'
  | 'fal-ai/hunyuan-video'
  | 'fal-ai/cogvideox-5b';

type FalRequest = {
  prompt: string;
  image_url?: string;
  duration?: string;
  aspect_ratio?: string;
  negative_prompt?: string;
  seed?: number;
};

type FalResponse = {
  video: {
    url: string;
    file_size?: number;
    file_name?: string;
  };
};

/**
 * Appelle l'API Fal.ai
 */
async function callFalApi(
  modelId: FalVideoModel,
  input: FalRequest
): Promise<string> {
  const apiKey = process.env.FAL_API_KEY;
  
  if (!apiKey) {
    throw new Error('FAL_API_KEY non configuré');
  }

  // Construire l'URL de l'API
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
    throw new Error(`Erreur Fal API: ${error}`);
  }

  const { request_id, status_url } = await submitResponse.json();

  // Attendre le résultat (polling)
  let attempts = 0;
  const maxAttempts = 120; // 10 minutes max (5s * 120)
  
  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // 5 secondes

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
      const result = statusData.result as FalResponse;
      return result.video.url;
    }

    if (statusData.status === 'FAILED') {
      throw new Error(statusData.error || 'Génération échouée');
    }

    attempts++;
  }

  throw new Error('Timeout: génération trop longue');
}

/**
 * Crée un modèle vidéo Fal
 */
function createFalModel(modelId: FalVideoModel): VideoModel {
  return {
    modelId,
    generate: async ({ prompt, imagePrompt, duration, aspectRatio }) => {
      const input: FalRequest = {
        prompt,
        aspect_ratio: aspectRatio || '16:9',
        duration: duration ? `${duration}` : '5',
      };

      // Ajouter l'image si c'est un modèle I2V
      if (imagePrompt && modelId.includes('image-to-video')) {
        input.image_url = imagePrompt;
      }

      return callFalApi(modelId, input);
    },
  };
}

/**
 * Export des modèles Fal
 */
export const fal = {
  // Kling 2.5
  kling25Standard: (isI2V: boolean = false): VideoModel => 
    createFalModel(isI2V 
      ? 'fal-ai/kling-video/v2.5/standard/image-to-video'
      : 'fal-ai/kling-video/v2.5/standard/text-to-video'
    ),
  
  kling25Pro: (isI2V: boolean = false): VideoModel => 
    createFalModel(isI2V 
      ? 'fal-ai/kling-video/v2.5/pro/image-to-video'
      : 'fal-ai/kling-video/v2.5/pro/text-to-video'
    ),

  // Pixverse
  pixverse35: (isI2V: boolean = false): VideoModel => 
    createFalModel(isI2V 
      ? 'fal-ai/pixverse/v3.5/image-to-video'
      : 'fal-ai/pixverse/v3.5/text-to-video'
    ),

  // Autres modèles
  mochi: (): VideoModel => createFalModel('fal-ai/mochi-v1'),
  hunyuan: (): VideoModel => createFalModel('fal-ai/hunyuan-video'),
  cogVideoX: (): VideoModel => createFalModel('fal-ai/cogvideox-5b'),
};

