/**
 * Provider WaveSpeed pour les modèles vidéo
 * Supporte: Kling, Seedream, et autres modèles via WaveSpeed API
 */

import type { VideoModel } from '.';

// Types pour l'API WaveSpeed
type WaveSpeedVideoModel =
  | 'kling-v2.5-turbo'
  | 'kling-v2.5-standard'
  | 'kling-v2.5-pro'
  | 'seedream-v1'
  | 'wan-2.1'
  | 'wan-2.1-pro';

type WaveSpeedRequest = {
  model: string;
  prompt: string;
  image_url?: string;
  duration?: number;
  aspect_ratio?: string;
  negative_prompt?: string;
  seed?: number;
  cfg_scale?: number;
  motion_bucket_id?: number;
};

type WaveSpeedResponse = {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  output?: {
    video_url: string;
  };
  error?: string;
};

/**
 * Appelle l'API WaveSpeed
 */
async function callWaveSpeedApi(
  model: WaveSpeedVideoModel,
  input: Omit<WaveSpeedRequest, 'model'>
): Promise<string> {
  const apiKey = process.env.WAVESPEED_API_KEY;
  
  if (!apiKey) {
    throw new Error('WAVESPEED_API_KEY non configuré');
  }

  const baseUrl = 'https://api.wavespeed.ai/v1';

  // Soumettre la requête de génération
  const submitResponse = await fetch(`${baseUrl}/video/generate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      ...input,
    }),
  });

  if (!submitResponse.ok) {
    const error = await submitResponse.text();
    throw new Error(`Erreur WaveSpeed API: ${error}`);
  }

  const { id } = await submitResponse.json() as { id: string };

  // Polling pour le résultat
  let attempts = 0;
  const maxAttempts = 120; // 10 minutes max

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // 5 secondes

    const statusResponse = await fetch(`${baseUrl}/video/status/${id}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!statusResponse.ok) {
      throw new Error('Erreur lors de la vérification du statut');
    }

    const statusData = await statusResponse.json() as WaveSpeedResponse;

    if (statusData.status === 'completed' && statusData.output) {
      return statusData.output.video_url;
    }

    if (statusData.status === 'failed') {
      throw new Error(statusData.error || 'Génération échouée');
    }

    attempts++;
  }

  throw new Error('Timeout: génération trop longue');
}

/**
 * Crée un modèle vidéo WaveSpeed
 */
function createWaveSpeedModel(modelId: WaveSpeedVideoModel): VideoModel {
  return {
    modelId,
    generate: async ({ prompt, imagePrompt, duration, aspectRatio }) => {
      const input: Omit<WaveSpeedRequest, 'model'> = {
        prompt,
        aspect_ratio: aspectRatio || '16:9',
        duration: duration || 5,
      };

      if (imagePrompt) {
        input.image_url = imagePrompt;
      }

      return callWaveSpeedApi(modelId, input);
    },
  };
}

/**
 * Export des modèles WaveSpeed
 */
export const wavespeed = {
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

