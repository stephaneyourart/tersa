/**
 * Provider WaveSpeed pour les modèles image
 * Supporte: Nano Banana Pro, Seedream, etc. via WaveSpeed API
 */

// Types pour l'API WaveSpeed Image
type WaveSpeedImageModel =
  | 'nano-banana-pro'
  | 'seedream-3.0'
  | 'flux-dev'
  | 'flux-schnell'
  | 'sdxl-turbo';

type WaveSpeedImageRequest = {
  model: string;
  prompt: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  num_images?: number;
  seed?: number;
  guidance_scale?: number;
  num_inference_steps?: number;
};

type WaveSpeedImageResponse = {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  output?: {
    images: Array<{
      url: string;
      width: number;
      height: number;
    }>;
  };
  error?: string;
};

/**
 * Appelle l'API WaveSpeed pour la génération d'images
 */
async function callWaveSpeedImageApi(
  model: WaveSpeedImageModel,
  input: Omit<WaveSpeedImageRequest, 'model'>
): Promise<string> {
  const apiKey = process.env.WAVESPEED_API_KEY;
  
  if (!apiKey) {
    throw new Error('WAVESPEED_API_KEY non configuré');
  }

  const baseUrl = 'https://api.wavespeed.ai/api/v2';

  // Soumettre la requête de génération
  const submitResponse = await fetch(`${baseUrl}/wavespeed-ai/${model}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...input,
      enable_safety_checker: false,
    }),
  });

  if (!submitResponse.ok) {
    const error = await submitResponse.text();
    throw new Error(`Erreur WaveSpeed API: ${error}`);
  }

  const responseData = await submitResponse.json();
  
  // Si la réponse contient directement les images
  if (responseData.data?.images?.[0]?.url) {
    return responseData.data.images[0].url;
  }

  // Sinon, on a un ID et on doit faire du polling
  const requestId = responseData.data?.id || responseData.id;
  
  if (!requestId) {
    throw new Error('Pas d\'ID de requête retourné');
  }

  // Polling pour le résultat
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes max

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // 5 secondes

    const statusResponse = await fetch(`${baseUrl}/predictions/${requestId}/result`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!statusResponse.ok) {
      // Continuer le polling
      attempts++;
      continue;
    }

    const statusData = await statusResponse.json();

    if (statusData.data?.images?.[0]?.url) {
      return statusData.data.images[0].url;
    }

    if (statusData.status === 'failed') {
      throw new Error(statusData.error || 'Génération échouée');
    }

    attempts++;
  }

  throw new Error('Timeout: génération trop longue');
}

/**
 * Type pour les modèles image WaveSpeed
 */
export type WaveSpeedImageModelInstance = {
  modelId: string;
  generate: (params: {
    prompt: string;
    seed?: number;
    width?: number;
    height?: number;
    negativePrompt?: string;
  }) => Promise<string>;
};

/**
 * Crée un modèle image WaveSpeed
 */
function createWaveSpeedImageModel(modelId: WaveSpeedImageModel): WaveSpeedImageModelInstance {
  return {
    modelId,
    generate: async ({ prompt, seed, width, height, negativePrompt }) => {
      const input: Omit<WaveSpeedImageRequest, 'model'> = {
        prompt,
        seed,
        negative_prompt: negativePrompt,
        width: width || 1024,
        height: height || 1024,
        num_images: 1,
      };

      return callWaveSpeedImageApi(modelId, input);
    },
  };
}

/**
 * Export des modèles image WaveSpeed
 */
export const wavespeedImage = {
  // Nano Banana Pro - Ultra rapide
  nanoBananaPro: (): WaveSpeedImageModelInstance => 
    createWaveSpeedImageModel('nano-banana-pro'),

  // Seedream 3.0
  seedream: (): WaveSpeedImageModelInstance => 
    createWaveSpeedImageModel('seedream-3.0'),

  // Flux via WaveSpeed
  fluxDev: (): WaveSpeedImageModelInstance => 
    createWaveSpeedImageModel('flux-dev'),
  fluxSchnell: (): WaveSpeedImageModelInstance => 
    createWaveSpeedImageModel('flux-schnell'),

  // SDXL Turbo
  sdxlTurbo: (): WaveSpeedImageModelInstance => 
    createWaveSpeedImageModel('sdxl-turbo'),
};

