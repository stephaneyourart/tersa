/**
 * Provider Fal.ai pour les modèles image
 * Supporte: Nano Banana Pro, Seedream, Flux via Fal, etc.
 */

import type { ImageModelV1 } from '@ai-sdk/provider';

// Types pour l'API Fal
type FalImageModel =
  | 'fal-ai/flux-pro'
  | 'fal-ai/flux-dev'
  | 'fal-ai/flux-schnell'
  | 'fal-ai/flux-realism'
  | 'fal-ai/flux-pro/kontext'
  | 'fal-ai/flux-pro/kontext/max'
  | 'fal-ai/stable-diffusion-v35-large'
  | 'fal-ai/stable-diffusion-v35-medium'
  | 'fal-ai/aura-flow'
  | 'fal-ai/seedream'
  | 'fal-ai/nano-banana-pro'
  | 'fal-ai/ideogram/v2'
  | 'fal-ai/ideogram/v2/turbo'
  | 'fal-ai/recraft-v3'
  | 'fal-ai/kolors';

type FalImageRequest = {
  prompt: string;
  image_size?: string | { width: number; height: number };
  num_inference_steps?: number;
  seed?: number;
  guidance_scale?: number;
  num_images?: number;
  negative_prompt?: string;
  image_url?: string; // Pour l'image-to-image
};

type FalImageResponse = {
  images: Array<{
    url: string;
    width: number;
    height: number;
    content_type: string;
  }>;
  timings?: {
    inference: number;
  };
  seed?: number;
  has_nsfw_concepts?: boolean[];
  prompt?: string;
};

/**
 * Appelle l'API Fal.ai pour la génération d'images
 */
async function callFalImageApi(
  modelId: FalImageModel,
  input: FalImageRequest
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
    body: JSON.stringify({
      ...input,
      num_images: 1,
    }),
  });

  if (!submitResponse.ok) {
    const error = await submitResponse.text();
    throw new Error(`Erreur Fal API: ${error}`);
  }

  const { request_id, status_url, response_url } = await submitResponse.json();

  // Mode sync rapide - certains modèles retournent directement
  if (response_url) {
    const directResponse = await fetch(response_url, {
      headers: { 'Authorization': `Key ${apiKey}` },
    });
    if (directResponse.ok) {
      const result = await directResponse.json() as FalImageResponse;
      if (result.images?.[0]?.url) {
        return result.images[0].url;
      }
    }
  }

  // Polling pour le résultat
  let attempts = 0;
  const maxAttempts = 144; // 12 minutes max
  
  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000));

    const statusResponse = await fetch(status_url, {
      headers: { 'Authorization': `Key ${apiKey}` },
    });

    if (!statusResponse.ok) {
      throw new Error('Erreur lors de la vérification du statut');
    }

    const statusData = await statusResponse.json();

    if (statusData.status === 'COMPLETED') {
      const result = statusData.result as FalImageResponse;
      if (result.images?.[0]?.url) {
        return result.images[0].url;
      }
      throw new Error('Aucune image générée');
    }

    if (statusData.status === 'FAILED') {
      throw new Error(statusData.error || 'Génération échouée');
    }

    attempts++;
  }

  throw new Error('Timeout: génération trop longue');
}

/**
 * Type pour les modèles image custom
 */
export type FalImageModelInstance = {
  modelId: string;
  generate: (params: {
    prompt: string;
    seed?: number;
    width?: number;
    height?: number;
    negativePrompt?: string;
    imageUrl?: string;
  }) => Promise<string>;
};

/**
 * Crée un modèle image Fal
 */
function createFalImageModel(modelId: FalImageModel): FalImageModelInstance {
  return {
    modelId,
    generate: async ({ prompt, seed, width, height, negativePrompt, imageUrl }) => {
      const input: FalImageRequest = {
        prompt,
        seed,
        negative_prompt: negativePrompt,
      };

      if (width && height) {
        input.image_size = { width, height };
      }

      if (imageUrl) {
        input.image_url = imageUrl;
      }

      return callFalImageApi(modelId, input);
    },
  };
}

/**
 * Export des modèles image Fal
 */
export const falImage = {
  // Nano Banana Pro - Ultra rapide
  nanoBananaPro: (): FalImageModelInstance => 
    createFalImageModel('fal-ai/nano-banana-pro'),

  // Seedream
  seedream: (): FalImageModelInstance => 
    createFalImageModel('fal-ai/seedream'),

  // Flux via Fal
  fluxPro: (): FalImageModelInstance => 
    createFalImageModel('fal-ai/flux-pro'),
  fluxDev: (): FalImageModelInstance => 
    createFalImageModel('fal-ai/flux-dev'),
  fluxSchnell: (): FalImageModelInstance => 
    createFalImageModel('fal-ai/flux-schnell'),
  fluxRealism: (): FalImageModelInstance => 
    createFalImageModel('fal-ai/flux-realism'),
    
  // Flux Kontext (Context) via Fal - Édition d'images contextuelle
  fluxKontext: (): FalImageModelInstance => 
    createFalImageModel('fal-ai/flux-pro/kontext'),
  fluxKontextMax: (): FalImageModelInstance => 
    createFalImageModel('fal-ai/flux-pro/kontext/max'),

  // Stable Diffusion 3.5
  sd35Large: (): FalImageModelInstance => 
    createFalImageModel('fal-ai/stable-diffusion-v35-large'),
  sd35Medium: (): FalImageModelInstance => 
    createFalImageModel('fal-ai/stable-diffusion-v35-medium'),

  // Autres modèles populaires
  auraFlow: (): FalImageModelInstance => 
    createFalImageModel('fal-ai/aura-flow'),
  ideogramV2: (): FalImageModelInstance => 
    createFalImageModel('fal-ai/ideogram/v2'),
  ideogramV2Turbo: (): FalImageModelInstance => 
    createFalImageModel('fal-ai/ideogram/v2/turbo'),
  recraftV3: (): FalImageModelInstance => 
    createFalImageModel('fal-ai/recraft-v3'),
  kolors: (): FalImageModelInstance => 
    createFalImageModel('fal-ai/kolors'),
};

