/**
 * Provider WaveSpeed pour les modèles vidéo
 * Supporte: Kling, Seedream, WAN et autres modèles via WaveSpeed API v3
 */

import type { VideoModel } from '.';

// ============================================================
// MODÈLES VIDÉO WAVESPEED
// Les IDs sont maintenant les vrais endpoints WaveSpeed
// ============================================================

// Mapping des modelId vers les chemins API
// Si l'ID est déjà un chemin complet (contient "/"), on l'utilise directement
const MODEL_PATH_MAP: Record<string, string> = {
  // === VRAIS ENDPOINTS (ID = endpoint) ===
  'kwaivgi/kling-v2.6-pro/image-to-video': 'kwaivgi/kling-v2.6-pro/image-to-video',
  'kwaivgi/kling-v2.5-turbo-pro/image-to-video': 'kwaivgi/kling-v2.5-turbo-pro/image-to-video',
  
  // === ANCIENS ALIAS (pour compatibilité) ===
  'kling-o1': 'kwaivgi/kling-video-o1/text-to-video',
  'kling-o1-i2v': 'kwaivgi/kling-video-o1/image-to-video',
  'kling-o1-ref': 'kwaivgi/kling-video-o1/reference-to-video',
  'kling-v2.6-pro-t2v': 'kwaivgi/kling-v2.6-pro/text-to-video',
  'kling-v2.6-pro-i2v': 'kwaivgi/kling-v2.6-pro/image-to-video',
  'kling-v2.1-start-end': 'kwaivgi/kling-v2.1-i2v-pro/start-end-frame',
  'kling-v2.5-turbo-pro-first-last': 'kwaivgi/kling-v2.5-turbo-pro/image-to-video',
  'kling-v2.5-turbo': 'kwaivgi/kling-v2.5-turbo-pro/image-to-video',
  'kling-v2.5-standard': 'kwaivgi/kling-v2.5-std/image-to-video',
  'kling-v2.5-pro': 'kwaivgi/kling-v2.5-pro/image-to-video',
  'seedream-v1': 'wavespeed-ai/seedream-3.0/image-to-video',
  'wan-2.1': 'wavespeed-ai/wan-2.1/image-to-video',
  'wan-2.1-pro': 'wavespeed-ai/wan-2.1-pro/image-to-video',
  'veo3.1-i2v': 'google/veo3.1-image-to-video',
  'veo3.1-t2v': 'google/veo3.1-text-to-video',
  'sora-2-i2v': 'openai/sora-2-image-to-video-pro',
  'sora-2-t2v': 'openai/sora-2-text-to-video-pro',
};

// Configuration des champs API par modèle
// IMPORTANT: cfg_scale pour v2.6, guidance_scale pour v2.5
const MODEL_API_CONFIG: Record<string, { guidanceField: string; supportsLastImage: boolean }> = {
  'kwaivgi/kling-v2.6-pro/image-to-video': { guidanceField: 'cfg_scale', supportsLastImage: false },
  'kwaivgi/kling-v2.5-turbo-pro/image-to-video': { guidanceField: 'guidance_scale', supportsLastImage: true },
};

// Types pour l'API WaveSpeed
// Accepte les vrais endpoints ET les anciens alias
type WaveSpeedVideoModel =
  // === VRAIS ENDPOINTS (recommandés) ===
  | 'kwaivgi/kling-v2.6-pro/image-to-video'
  | 'kwaivgi/kling-v2.5-turbo-pro/image-to-video'
  // === ANCIENS ALIAS (compatibilité) ===
  | 'kling-o1'
  | 'kling-o1-i2v'
  | 'kling-o1-ref'
  | 'kling-v2.6-pro-t2v'
  | 'kling-v2.6-pro-i2v'
  | 'kling-v2.1-start-end'
  | 'kling-v2.5-turbo-pro-first-last'
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
  last_image?: string;  // Ancien nom (certains modèles)
  end_image?: string;   // Nom officiel pour kling-v2.1-i2v-pro/start-end-frame
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

// Type pour la réponse WaveSpeed - supporte les deux formats
// Format 1 (ancien): { data: { status, outputs, urls } }
// Format 2 (nouveau): { status, outputs, urls } directement
type WaveSpeedResponse = {
  // Format nouveau (champs au niveau racine)
  id?: string;
  status?: string;
  outputs?: string[];
  urls?: {
    get: string;
  };
  error?: string;
  // Format ancien (champs dans data)
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

  // LOG DE VÉRITÉ ABSOLUE
  console.log(`[WaveSpeed Video] 🚀 EXECUTION MODEL: ${model}`);
  console.log(`[WaveSpeed Video] 🎯 MAPPED ENDPOINT: ${modelPath}`);
  console.log(`[WaveSpeed Video] 📦 FULL URL: ${baseUrl}/${modelPath}`);

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

  // SUPPORT DES DEUX FORMATS DE RÉPONSE :
  // Format 1 (ancien): { data: { status, outputs, urls } }
  // Format 2 (nouveau): { status, outputs, urls } directement au niveau racine

  // Extraire les données (format nouveau ou ancien)
  const outputs = responseData.outputs || responseData.data?.outputs;
  const urls = responseData.urls || responseData.data?.urls;
  const status = responseData.status || responseData.data?.status;

  // Vérifier si on a directement le résultat
  if (outputs?.[0]) {
    console.log(`[WaveSpeed Video] ✓ Direct result: ${outputs[0].substring(0, 60)}...`);
    return outputs[0];
  }

  // Sinon, polling pour le résultat
  const pollUrl = urls?.get;
  if (!pollUrl) {
    console.error(`[WaveSpeed Video] ❌ No poll URL in response:`, responseData);
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

    // SUPPORT DES DEUX FORMATS (nouveau: niveau racine, ancien: dans data)
    const pollStatus = statusData.status || statusData.data?.status;
    const pollOutputs = statusData.outputs || statusData.data?.outputs;
    const pollError = statusData.error || statusData.message;

    if (pollStatus === 'completed' && pollOutputs?.[0]) {
      console.log(`[WaveSpeed Video] ✓ Completed after ${attempts * 2}s: ${pollOutputs[0].substring(0, 60)}...`);
      return pollOutputs[0];
    }

    if (pollStatus === 'failed') {
      console.error(`[WaveSpeed Video] ❌ Failed:`, statusData);
      throw new Error(pollError || 'Génération vidéo échouée');
    }

    attempts++;
    if (attempts % 15 === 0) {
      console.log(`[WaveSpeed Video] Still processing... (${attempts * 2}s)`);
    }
  }

  throw new Error('Timeout: génération vidéo trop longue');
}

/**
 * Crée un modèle vidéo WaveSpeed
 * Utilise la config MODEL_API_CONFIG pour les bons champs API
 */
function createWaveSpeedModel(modelId: WaveSpeedVideoModel): VideoModel {
  return {
    modelId,
    generate: async ({ prompt, imagePrompt, lastFrameImage, duration, aspectRatio }) => {
      // Récupérer la config API pour ce modèle
      const modelPath = MODEL_PATH_MAP[modelId] || modelId;
      const apiConfig = MODEL_API_CONFIG[modelPath];
      
      const input: WaveSpeedRequest = {
        prompt,
        duration: duration || 5,
      };

      // Ajouter first frame (image) si fournie
      if (imagePrompt) {
        input.image = imagePrompt;
      }

      // Ajouter le bon champ guidance selon le modèle
      if (apiConfig?.guidanceField === 'cfg_scale') {
        // kling-v2.6-pro utilise cfg_scale
        (input as Record<string, unknown>).cfg_scale = 0.5;
        (input as Record<string, unknown>).sound = true;
        console.log(`[WaveSpeed Video] Using cfg_scale for ${modelId}`);
      } else {
        // kling-v2.5-turbo-pro utilise guidance_scale
        input.guidance_scale = 0.5;
        console.log(`[WaveSpeed Video] Using guidance_scale for ${modelId}`);
      }

      // Ajouter last frame SEULEMENT si le modèle le supporte
      if (lastFrameImage && apiConfig?.supportsLastImage) {
        input.last_image = lastFrameImage;
        console.log(`[WaveSpeed Video] Adding last_image for first-last frame animation`);
      } else if (lastFrameImage && !apiConfig?.supportsLastImage) {
        console.warn(`[WaveSpeed Video] ⚠️ Model ${modelId} does NOT support last_image - ignoring`);
      }

      return callWaveSpeedApi(modelId, input);
    },
  };
}

/**
 * Crée un modèle vidéo KLING optimisé pour first+last frame
 * 
 * IMPORTANT : Le SEUL modèle qui supporte first+last frame est :
 * kwaivgi/kling-v2.1-i2v-pro/start-end-frame
 * 
 * Paramètres :
 * - image : first frame (REQUIRED)
 * - end_image : last frame (REQUIRED) - PAS "last_image" !
 * - prompt, duration, guidance_scale
 */
function createKlingStartEndModel_LEGACY(): VideoModel {
  const modelId: WaveSpeedVideoModel = 'kling-v2.1-start-end';
  
  return {
    modelId,
    generate: async ({ prompt, imagePrompt, lastFrameImage, duration }) => {
      const input: WaveSpeedRequest = {
        prompt,
        duration: duration || 5,
        guidance_scale: 0.5, // Valeur par défaut recommandée
        // PAS de aspect_ratio - déduit des images d'entrée
      };

      // First frame (image de départ) - REQUIRED
      if (imagePrompt) {
        input.image = imagePrompt;
        console.log(`[WaveSpeed KLING Start-End] First frame: ${imagePrompt.substring(0, 50)}...`);
      }

      // Last frame (image de fin) - REQUIRED - PARAMÈTRE = end_image !
      if (lastFrameImage) {
        input.end_image = lastFrameImage;  // PAS last_image !
        console.log(`[WaveSpeed KLING Start-End] End frame: ${lastFrameImage.substring(0, 50)}...`);
      }

      if (!imagePrompt || !lastFrameImage) {
        console.error(`[WaveSpeed KLING Start-End] ❌ ERREUR: first ET last frame sont OBLIGATOIRES !`);
        throw new Error('ERREUR V2.1 LEGACY: Le modèle start-end-frame requiert image ET end_image');
      }

      return callWaveSpeedApi(modelId, input);
    },
  };
}

/**
 * Crée un modèle vidéo KLING 2.5 Turbo Pro optimisé pour first+last frame
 * 
 * NOUVEAU : Kling 2.5 Turbo Pro supporte first+last frame via:
 * - image : first frame (REQUIRED)
 * - last_image : last frame (OPTIONAL mais recommandé pour first+last)
 * 
 * Endpoint: kwaivgi/kling-v2.5-turbo-pro/image-to-video
 */
function createKling25TurboProFirstLastModel(): VideoModel {
  // Utiliser l'ID alias pour faire le mapping correct
  const modelId: WaveSpeedVideoModel = 'kling-v2.5-turbo-pro-first-last';
  
  return {
    modelId,
    generate: async ({ prompt, imagePrompt, lastFrameImage, duration, aspectRatio }) => {
      const input: WaveSpeedRequest = {
        prompt,
        duration: duration || 5,
        guidance_scale: 0.5, // Valeur par défaut recommandée
      };

      // First frame (image de départ) - REQUIRED
      if (imagePrompt) {
        input.image = imagePrompt;
        console.log(`[WaveSpeed KLING 2.5 Turbo Pro First-Last] First frame set`);
      }

      // Last frame (image de fin) - OPTIONAL mais recommandé
      // Kling 2.5 Turbo Pro utilise "last_image" (PAS end_image !)
      if (lastFrameImage) {
        input.last_image = lastFrameImage;
        console.log(`[WaveSpeed KLING 2.5 Turbo Pro First-Last] Last frame set`);
      }

      if (!imagePrompt) {
        console.error(`[WaveSpeed KLING 2.5 Turbo Pro First-Last] ❌ ERREUR: first frame (image) est OBLIGATOIRE !`);
        throw new Error('Kling 2.5 Turbo Pro requiert au minimum une image (first frame)');
      }

      console.log(`[WaveSpeed KLING 2.5 Turbo Pro First-Last] Generating with first+last=${!!lastFrameImage}`);
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

  // Kling 2.6 Pro (PAS de support first+last frame !)
  kling26ProT2V: (): VideoModel => createWaveSpeedModel('kling-v2.6-pro-t2v'),
  kling26ProI2V: (): VideoModel => createWaveSpeedModel('kling-v2.6-pro-i2v'),
  
  // Kling 2.1 Pro Start-End Frame - Ancien modèle first+last (utilise end_image)
  klingStartEnd: (): VideoModel => createKlingStartEndModel_LEGACY(),
  
  // DEPRECATED: Ancien nom, redirige vers le bon modèle
  kling26ProFirstLast: (): VideoModel => createKlingStartEndModel_LEGACY(),

  // ⭐ NOUVEAU: Kling 2.5 Turbo Pro avec first+last frame (utilise last_image)
  // C'est le modèle RECOMMANDÉ pour first+last frame !
  kling25TurboProFirstLast: (): VideoModel => createKling25TurboProFirstLastModel(),

  // Kling 2.5 via WaveSpeed (sans first+last)
  kling25Turbo: (): VideoModel => createWaveSpeedModel('kling-v2.5-turbo'),
  kling25Standard: (): VideoModel => createWaveSpeedModel('kling-v2.5-standard'),
  kling25Pro: (): VideoModel => createWaveSpeedModel('kling-v2.5-pro'),

  // Seedream
  seedream: (): VideoModel => createWaveSpeedModel('seedream-v1'),

  // Wan
  wan21: (): VideoModel => createWaveSpeedModel('wan-2.1'),
  wan21Pro: (): VideoModel => createWaveSpeedModel('wan-2.1-pro'),
};
