/**
 * Provider WaveSpeed pour les modèles image
 * Documentation: https://wavespeed.ai/docs/docs
 * API Version: v3
 */

// Types pour l'API WaveSpeed Image v3
// Format basé sur la documentation: https://wavespeed.ai/docs/docs-api/
// Exemple: google/nano-banana-pro/edit-ultra
export type WaveSpeedImageModelId =
  // Nano Banana (Google) - Text to Image
  | 'google/nano-banana/text-to-image'
  | 'google/nano-banana-pro/text-to-image'
  | 'google/nano-banana-pro/text-to-image-multi'
  | 'google/nano-banana-pro/text-to-image-ultra'
  // Nano Banana (Google) - Edit
  | 'google/nano-banana/edit'
  | 'google/nano-banana-pro/edit'
  | 'google/nano-banana-pro/edit-multi'
  | 'google/nano-banana-pro/edit-ultra'
  // Nano Banana (Google) - Effects
  | 'google/nano-banana/effects'
  // Imagen (Google)
  | 'google/imagen3'
  | 'google/imagen3-fast'
  | 'google/imagen4'
  | 'google/imagen4-fast'
  | 'google/imagen4-ultra'
  // Gemini (Google)
  | 'google/gemini-2.5-flash-image/text-to-image'
  | 'google/gemini-2.5-flash-image/edit'
  | 'google/gemini-3-pro-image/text-to-image'
  | 'google/gemini-3-pro-image/edit'
  // Flux (WaveSpeed)
  | 'wavespeed-ai/flux-dev'
  | 'wavespeed-ai/flux-dev/ultra-fast'
  | 'wavespeed-ai/flux-schnell'
  | 'wavespeed-ai/flux-1.1-pro'
  | 'wavespeed-ai/flux-1.1-pro-ultra'
  | 'wavespeed-ai/flux-kontext-dev'
  | 'wavespeed-ai/flux-kontext-dev/multi-ultra-fast'
  | 'wavespeed-ai/flux-kontext-pro'
  | 'wavespeed-ai/flux-kontext-max'
  | 'wavespeed-ai/flux-2-dev/text-to-image'
  | 'wavespeed-ai/flux-2-pro/text-to-image'
  // Qwen Image
  | 'wavespeed-ai/qwen-image/text-to-image'
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

// Résolutions supportées
export type WaveSpeedResolution = '1k' | '2k' | '4k';

// Aspect ratios supportés - réexport depuis aspect-ratio.ts
import { AspectRatio, getAspectRatioSize } from './aspect-ratio';
export type WaveSpeedAspectRatio = AspectRatio;
export { getAspectRatioSize };

// Paramètres pour la génération d'images (Text to Image)
export type WaveSpeedTextToImageParams = {
  prompt: string;
  negative_prompt?: string;
  aspect_ratio?: WaveSpeedAspectRatio;
  resolution?: WaveSpeedResolution;
  seed?: number;
  guidance_scale?: number;
  num_inference_steps?: number;
  output_format?: 'png' | 'jpeg' | 'webp';
  enable_base64_output?: boolean;
  enable_sync_mode?: boolean;
};

// Paramètres pour l'édition d'images (Edit)
export type WaveSpeedEditParams = {
  prompt: string;
  images: string[]; // URLs des images sources
  negative_prompt?: string;
  resolution?: WaveSpeedResolution;
  seed?: number;
  guidance_scale?: number;
  strength?: number;
  output_format?: 'png' | 'jpeg' | 'webp';
  enable_base64_output?: boolean;
  enable_sync_mode?: boolean;
};

type WaveSpeedResponse = {
  code?: number;
  message?: string;
  data?: {
    id?: string;
    model?: string;
    outputs?: string[]; // URLs des images générées
    urls?: {
      get?: string; // URL pour polling
    };
    status?: string; // created, processing, completed, failed
    error?: string;
    // Anciennes structures pour compatibilité
    images?: Array<{ url: string }>;
    image?: { url: string };
    output?: string | string[];
  };
  id?: string;
  status?: string;
  error?: string;
};

/**
 * Appelle l'API WaveSpeed v3 pour la génération d'images
 */
async function callWaveSpeedApi(
  modelPath: string,
  params: WaveSpeedTextToImageParams | WaveSpeedEditParams
): Promise<string> {
  const apiKey = process.env.WAVESPEED_API_KEY;
  
  if (!apiKey) {
    throw new Error('WAVESPEED_API_KEY non configuré');
  }

  const baseUrl = 'https://api.wavespeed.ai/api/v3';

  console.log(`[WaveSpeed] Appel API: ${baseUrl}/${modelPath}`);

  // Soumettre la requête de génération
  const submitResponse = await fetch(`${baseUrl}/${modelPath}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...params,
      enable_base64_output: false,
      enable_sync_mode: false,
    }),
  });

  if (!submitResponse.ok) {
    const error = await submitResponse.text();
    console.error(`[WaveSpeed] Erreur API:`, error);
    throw new Error(`Erreur WaveSpeed API: ${error}`);
  }

  const responseData: WaveSpeedResponse = await submitResponse.json();
  console.log(`[WaveSpeed] Réponse:`, JSON.stringify(responseData).slice(0, 300));
  
  // Vérifier si la génération a réussi immédiatement
  if (responseData.data?.outputs && responseData.data.outputs.length > 0) {
    console.log(`[WaveSpeed] Image générée immédiatement:`, responseData.data.outputs[0]);
    return responseData.data.outputs[0];
  }
  
  // Anciennes structures pour compatibilité
  if (responseData.data?.images?.[0]?.url) {
    return responseData.data.images[0].url;
  }
  if (responseData.data?.image?.url) {
    return responseData.data.image.url;
  }

  // Sinon, on a un ID et on doit faire du polling
  const requestId = responseData.data?.id || responseData.id;
  const pollingUrl = responseData.data?.urls?.get;
  
  if (!requestId && !pollingUrl) {
    console.error(`[WaveSpeed] Réponse complète:`, JSON.stringify(responseData));
    throw new Error('Pas d\'ID de requête retourné');
  }

  console.log(`[WaveSpeed] Polling pour requestId: ${requestId}`);
  console.log(`[WaveSpeed] URL de polling: ${pollingUrl || `${baseUrl}/predictions/${requestId}/result`}`);

  // Polling pour le résultat (intervalle de 2 secondes)
  let attempts = 0;
  const maxAttempts = 360; // 12 minutes max (360 * 2s)

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 2000));

    const pollUrl = pollingUrl || `${baseUrl}/predictions/${requestId}/result`;
    
    try {
      const statusResponse = await fetch(pollUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!statusResponse.ok) {
        console.log(`[WaveSpeed] Polling attempt ${attempts + 1}: HTTP ${statusResponse.status}`);
        attempts++;
        continue;
      }

      const statusData: WaveSpeedResponse = await statusResponse.json();
      console.log(`[WaveSpeed] Polling attempt ${attempts + 1}:`, JSON.stringify(statusData).slice(0, 200));

      // Vérifier outputs (format WaveSpeed v3)
      if (statusData.data?.outputs && statusData.data.outputs.length > 0) {
        console.log(`[WaveSpeed] Image générée:`, statusData.data.outputs[0]);
        return statusData.data.outputs[0];
      }
      
      // Anciennes structures
      if (statusData.data?.images?.[0]?.url) {
        return statusData.data.images[0].url;
      }
      if (statusData.data?.image?.url) {
        return statusData.data.image.url;
      }

      // Vérifier le statut
      const status = statusData.data?.status || statusData.status;
      if (status === 'failed') {
        throw new Error(statusData.data?.error || statusData.error || 'Génération échouée');
      }
      
      if (status === 'completed' && (!statusData.data?.outputs || statusData.data.outputs.length === 0)) {
        console.error(`[WaveSpeed] Complété mais pas d'outputs:`, JSON.stringify(statusData));
        throw new Error('Génération complétée mais aucune image retournée');
      }

    } catch (fetchError) {
      console.error(`[WaveSpeed] Erreur polling:`, fetchError);
    }

    attempts++;
  }

  throw new Error('Timeout: génération trop longue (12 minutes)');
}

/**
 * Type pour les modèles image WaveSpeed
 */
export type WaveSpeedImageModelInstance = {
  modelId: WaveSpeedImageModelId;
  isEdit: boolean;
  generate: (params: WaveSpeedTextToImageParams | WaveSpeedEditParams) => Promise<string>;
};

/**
 * Crée un modèle Text-to-Image WaveSpeed
 */
function createTextToImageModel(modelPath: WaveSpeedImageModelId): WaveSpeedImageModelInstance {
  return {
    modelId: modelPath,
    isEdit: false,
    generate: async (params) => {
      return callWaveSpeedApi(modelPath, params);
    },
  };
}

/**
 * Crée un modèle Edit WaveSpeed
 */
function createEditModel(modelPath: WaveSpeedImageModelId): WaveSpeedImageModelInstance {
  return {
    modelId: modelPath,
    isEdit: true,
    generate: async (params) => {
      return callWaveSpeedApi(modelPath, params);
    },
  };
}

/**
 * Export des modèles image WaveSpeed
 */
export const wavespeedImage = {
  // ========================================
  // NANO BANANA (Google) - Text to Image
  // Docs: https://wavespeed.ai/docs/docs-api/google/
  // ========================================
  nanoBanana: () => createTextToImageModel('google/nano-banana/text-to-image'),
  nanoBananaPro: () => createTextToImageModel('google/nano-banana-pro/text-to-image'),
  nanoBananaProMulti: () => createTextToImageModel('google/nano-banana-pro/text-to-image-multi'),
  nanoBananaProUltra: () => createTextToImageModel('google/nano-banana-pro/text-to-image-ultra'),
  
  // ========================================
  // NANO BANANA (Google) - Edit
  // ========================================
  nanoBananaEdit: () => createEditModel('google/nano-banana/edit'),
  nanoBananaProEdit: () => createEditModel('google/nano-banana-pro/edit'),
  nanoBananaProEditMulti: () => createEditModel('google/nano-banana-pro/edit-multi'),
  nanoBananaProEditUltra: () => createEditModel('google/nano-banana-pro/edit-ultra'),
  
  // Effects
  nanoBananaEffects: () => createEditModel('google/nano-banana/effects'),

  // ========================================
  // IMAGEN (Google)
  // ========================================
  imagen3: () => createTextToImageModel('google/imagen3'),
  imagen3Fast: () => createTextToImageModel('google/imagen3-fast'),
  imagen4: () => createTextToImageModel('google/imagen4'),
  imagen4Fast: () => createTextToImageModel('google/imagen4-fast'),
  imagen4Ultra: () => createTextToImageModel('google/imagen4-ultra'),

  // ========================================
  // GEMINI (Google)
  // ========================================
  gemini25FlashText2Img: () => createTextToImageModel('google/gemini-2.5-flash-image/text-to-image'),
  gemini25FlashEdit: () => createEditModel('google/gemini-2.5-flash-image/edit'),
  gemini3ProText2Img: () => createTextToImageModel('google/gemini-3-pro-image/text-to-image'),
  gemini3ProEdit: () => createEditModel('google/gemini-3-pro-image/edit'),

  // ========================================
  // FLUX (WaveSpeed)
  // ========================================
  fluxDev: () => createTextToImageModel('wavespeed-ai/flux-dev'),
  fluxDevUltraFast: () => createTextToImageModel('wavespeed-ai/flux-dev/ultra-fast'),
  fluxSchnell: () => createTextToImageModel('wavespeed-ai/flux-schnell'),
  flux11Pro: () => createTextToImageModel('wavespeed-ai/flux-1.1-pro'),
  flux11ProUltra: () => createTextToImageModel('wavespeed-ai/flux-1.1-pro-ultra'),
  fluxKontextDev: () => createEditModel('wavespeed-ai/flux-kontext-dev'),
  fluxKontextDevMultiUltraFast: () => createEditModel('wavespeed-ai/flux-kontext-dev/multi-ultra-fast'),
  fluxKontextPro: () => createEditModel('wavespeed-ai/flux-kontext-pro'),
  fluxKontextMax: () => createEditModel('wavespeed-ai/flux-kontext-max'),
  flux2DevText2Img: () => createTextToImageModel('wavespeed-ai/flux-2-dev/text-to-image'),
  flux2ProText2Img: () => createTextToImageModel('wavespeed-ai/flux-2-pro/text-to-image'),

  // ========================================
  // QWEN IMAGE
  // ========================================
  qwenText2Img: () => createTextToImageModel('wavespeed-ai/qwen-image/text-to-image'),
  qwenEdit: () => createEditModel('wavespeed-ai/qwen-image-edit'),
  qwenEditPlus: () => createEditModel('wavespeed-ai/qwen-image-edit-plus'),

  // ========================================
  // HUNYUAN
  // ========================================
  hunyuan21: () => createTextToImageModel('wavespeed-ai/hunyuan-image-2.1'),
  hunyuan3: () => createTextToImageModel('wavespeed-ai/hunyuan-image-3'),

  // ========================================
  // STABILITY AI
  // ========================================
  sdxl: () => createTextToImageModel('stability-ai/sdxl'),
  sd3: () => createTextToImageModel('stability-ai/stable-diffusion-3'),
  sd35Large: () => createTextToImageModel('stability-ai/stable-diffusion-3.5-large'),
  sd35LargeTurbo: () => createTextToImageModel('stability-ai/stable-diffusion-3.5-large-turbo'),
};

// Export des constantes
export const WAVESPEED_ASPECT_RATIOS: WaveSpeedAspectRatio[] = [
  '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9', '9:21'
];

export const WAVESPEED_RESOLUTIONS: WaveSpeedResolution[] = ['1k', '2k', '4k'];

export const WAVESPEED_QUALITIES = ['standard', 'hd', 'ultra'] as const;
