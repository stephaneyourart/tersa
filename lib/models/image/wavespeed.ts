/**
 * Provider WaveSpeed pour les modèles image
 * Documentation: https://wavespeed.ai/docs/docs
 * 
 * Inclut tous les modèles Nano Banana et autres modèles populaires
 */

// Types pour l'API WaveSpeed Image
export type WaveSpeedImageModelId =
  // Nano Banana (Google)
  | 'google/nano-banana-text-to-image'
  | 'google/nano-banana-edit'
  | 'google/nano-banana-effects'
  | 'google/nano-banana-pro-text-to-image'
  | 'google/nano-banana-pro-text-to-image-multi'
  | 'google/nano-banana-pro-text-to-image-ultra'
  | 'google/nano-banana-pro-edit'
  | 'google/nano-banana-pro-edit-multi'
  | 'google/nano-banana-pro-edit-ultra'
  // Imagen (Google)
  | 'google/imagen3'
  | 'google/imagen3-fast'
  | 'google/imagen4'
  | 'google/imagen4-fast'
  | 'google/imagen4-ultra'
  // Gemini (Google)
  | 'google/gemini-2.5-flash-image-text-to-image'
  | 'google/gemini-2.5-flash-image-edit'
  | 'google/gemini-3-pro-image-text-to-image'
  | 'google/gemini-3-pro-image-edit'
  // Flux (WaveSpeed)
  | 'wavespeed-ai/flux-dev'
  | 'wavespeed-ai/flux-dev-ultra-fast'
  | 'wavespeed-ai/flux-schnell'
  | 'wavespeed-ai/flux-1.1-pro'
  | 'wavespeed-ai/flux-1.1-pro-ultra'
  | 'wavespeed-ai/flux-kontext-dev'
  | 'wavespeed-ai/flux-kontext-pro'
  | 'wavespeed-ai/flux-kontext-max'
  | 'wavespeed-ai/flux-2-dev-text-to-image'
  | 'wavespeed-ai/flux-2-pro-text-to-image'
  // Qwen Image
  | 'wavespeed-ai/qwen-image-text-to-image'
  | 'wavespeed-ai/qwen-image-edit'
  | 'wavespeed-ai/qwen-image-edit-plus'
  // Hunyuan
  | 'wavespeed-ai/hunyuan-image-2.1'
  | 'wavespeed-ai/hunyuan-image-3'
  // Stability AI
  | 'stability-ai/sdxl'
  | 'stability-ai/stable-diffusion-3'
  | 'stability-ai/stable-diffusion-3.5-large'
  | 'stability-ai/stable-diffusion-3.5-large-turbo';

// Aspect ratios supportés
export type WaveSpeedAspectRatio = 
  | '1:1' | '16:9' | '9:16' | '4:3' | '3:4' 
  | '3:2' | '2:3' | '21:9' | '9:21';

// Paramètres pour la génération d'images
export type WaveSpeedImageParams = {
  prompt: string;
  negative_prompt?: string;
  image?: string; // URL pour edit/img2img
  images?: string[]; // Pour multi-image
  width?: number;
  height?: number;
  aspect_ratio?: WaveSpeedAspectRatio;
  num_images?: number;
  seed?: number;
  guidance_scale?: number;
  num_inference_steps?: number;
  strength?: number; // Pour edit/img2img
  style?: string;
  quality?: 'standard' | 'hd' | 'ultra';
};

type WaveSpeedResponse = {
  data?: {
    id?: string;
    images?: Array<{ url: string; width: number; height: number }>;
    image?: { url: string };
  };
  id?: string;
  status?: string;
  error?: string;
};

/**
 * Appelle l'API WaveSpeed pour la génération d'images
 */
async function callWaveSpeedApi(
  modelPath: string,
  params: WaveSpeedImageParams
): Promise<string> {
  const apiKey = process.env.WAVESPEED_API_KEY;
  
  if (!apiKey) {
    throw new Error('WAVESPEED_API_KEY non configuré');
  }

  const baseUrl = 'https://api.wavespeed.ai/api/v2';

  // Soumettre la requête de génération
  const submitResponse = await fetch(`${baseUrl}/${modelPath}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...params,
      enable_safety_checker: false,
    }),
  });

  if (!submitResponse.ok) {
    const error = await submitResponse.text();
    throw new Error(`Erreur WaveSpeed API: ${error}`);
  }

  const responseData: WaveSpeedResponse = await submitResponse.json();
  
  // Si la réponse contient directement les images
  if (responseData.data?.images?.[0]?.url) {
    return responseData.data.images[0].url;
  }
  if (responseData.data?.image?.url) {
    return responseData.data.image.url;
  }

  // Sinon, on a un ID et on doit faire du polling
  const requestId = responseData.data?.id || responseData.id;
  
  if (!requestId) {
    throw new Error('Pas d\'ID de requête retourné');
  }

  // Polling pour le résultat
  let attempts = 0;
  const maxAttempts = 120; // 10 minutes max

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000));

    const statusResponse = await fetch(`${baseUrl}/predictions/${requestId}/result`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!statusResponse.ok) {
      attempts++;
      continue;
    }

    const statusData: WaveSpeedResponse = await statusResponse.json();

    if (statusData.data?.images?.[0]?.url) {
      return statusData.data.images[0].url;
    }
    if (statusData.data?.image?.url) {
      return statusData.data.image.url;
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
  modelId: WaveSpeedImageModelId;
  generate: (params: WaveSpeedImageParams) => Promise<string>;
};

/**
 * Crée un modèle image WaveSpeed
 */
function createModel(modelId: WaveSpeedImageModelId): WaveSpeedImageModelInstance {
  return {
    modelId,
    generate: async (params) => {
      // Convertir aspect_ratio en width/height si nécessaire
      if (params.aspect_ratio && !params.width && !params.height) {
        const sizes = getAspectRatioSize(params.aspect_ratio);
        params.width = sizes.width;
        params.height = sizes.height;
      }
      
      // Valeurs par défaut
      if (!params.width) params.width = 1024;
      if (!params.height) params.height = 1024;
      if (!params.num_images) params.num_images = 1;

      return callWaveSpeedApi(modelId, params);
    },
  };
}

/**
 * Convertit un aspect ratio en dimensions
 */
function getAspectRatioSize(ratio: WaveSpeedAspectRatio): { width: number; height: number } {
  const sizes: Record<WaveSpeedAspectRatio, { width: number; height: number }> = {
    '1:1': { width: 1024, height: 1024 },
    '16:9': { width: 1344, height: 768 },
    '9:16': { width: 768, height: 1344 },
    '4:3': { width: 1152, height: 896 },
    '3:4': { width: 896, height: 1152 },
    '3:2': { width: 1216, height: 832 },
    '2:3': { width: 832, height: 1216 },
    '21:9': { width: 1536, height: 640 },
    '9:21': { width: 640, height: 1536 },
  };
  return sizes[ratio] || sizes['1:1'];
}

/**
 * Export des modèles image WaveSpeed
 */
export const wavespeedImage = {
  // ========================================
  // NANO BANANA (Google) - Les plus rapides
  // ========================================
  
  // Text to Image
  nanoBanana: () => createModel('google/nano-banana-text-to-image'),
  nanoBananaPro: () => createModel('google/nano-banana-pro-text-to-image'),
  nanoBananaProMulti: () => createModel('google/nano-banana-pro-text-to-image-multi'),
  nanoBananaProUltra: () => createModel('google/nano-banana-pro-text-to-image-ultra'),
  
  // Edit (img2img)
  nanoBananaEdit: () => createModel('google/nano-banana-edit'),
  nanoBananaProEdit: () => createModel('google/nano-banana-pro-edit'),
  nanoBananaProEditMulti: () => createModel('google/nano-banana-pro-edit-multi'),
  nanoBananaProEditUltra: () => createModel('google/nano-banana-pro-edit-ultra'),
  
  // Effects
  nanoBananaEffects: () => createModel('google/nano-banana-effects'),

  // ========================================
  // IMAGEN (Google)
  // ========================================
  imagen3: () => createModel('google/imagen3'),
  imagen3Fast: () => createModel('google/imagen3-fast'),
  imagen4: () => createModel('google/imagen4'),
  imagen4Fast: () => createModel('google/imagen4-fast'),
  imagen4Ultra: () => createModel('google/imagen4-ultra'),

  // ========================================
  // GEMINI (Google)
  // ========================================
  gemini25FlashText2Img: () => createModel('google/gemini-2.5-flash-image-text-to-image'),
  gemini25FlashEdit: () => createModel('google/gemini-2.5-flash-image-edit'),
  gemini3ProText2Img: () => createModel('google/gemini-3-pro-image-text-to-image'),
  gemini3ProEdit: () => createModel('google/gemini-3-pro-image-edit'),

  // ========================================
  // FLUX (WaveSpeed)
  // ========================================
  fluxDev: () => createModel('wavespeed-ai/flux-dev'),
  fluxDevUltraFast: () => createModel('wavespeed-ai/flux-dev-ultra-fast'),
  fluxSchnell: () => createModel('wavespeed-ai/flux-schnell'),
  flux11Pro: () => createModel('wavespeed-ai/flux-1.1-pro'),
  flux11ProUltra: () => createModel('wavespeed-ai/flux-1.1-pro-ultra'),
  fluxKontextDev: () => createModel('wavespeed-ai/flux-kontext-dev'),
  fluxKontextPro: () => createModel('wavespeed-ai/flux-kontext-pro'),
  fluxKontextMax: () => createModel('wavespeed-ai/flux-kontext-max'),
  flux2DevText2Img: () => createModel('wavespeed-ai/flux-2-dev-text-to-image'),
  flux2ProText2Img: () => createModel('wavespeed-ai/flux-2-pro-text-to-image'),

  // ========================================
  // QWEN IMAGE
  // ========================================
  qwenText2Img: () => createModel('wavespeed-ai/qwen-image-text-to-image'),
  qwenEdit: () => createModel('wavespeed-ai/qwen-image-edit'),
  qwenEditPlus: () => createModel('wavespeed-ai/qwen-image-edit-plus'),

  // ========================================
  // HUNYUAN
  // ========================================
  hunyuan21: () => createModel('wavespeed-ai/hunyuan-image-2.1'),
  hunyuan3: () => createModel('wavespeed-ai/hunyuan-image-3'),

  // ========================================
  // STABILITY AI
  // ========================================
  sdxl: () => createModel('stability-ai/sdxl'),
  sd3: () => createModel('stability-ai/stable-diffusion-3'),
  sd35Large: () => createModel('stability-ai/stable-diffusion-3.5-large'),
  sd35LargeTurbo: () => createModel('stability-ai/stable-diffusion-3.5-large-turbo'),
};

// Export des aspect ratios disponibles
export const WAVESPEED_ASPECT_RATIOS: WaveSpeedAspectRatio[] = [
  '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9', '9:21'
];

// Export des qualités disponibles
export const WAVESPEED_QUALITIES = ['standard', 'hd', 'ultra'] as const;
