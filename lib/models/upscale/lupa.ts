/**
 * Provider Lupa AI pour l'upscaling d'images
 * Documentation: https://lupaupscaler.gitbook.io/lupaupscaler-docs/api
 * 
 * ⚠️ Requiert un abonnement BUSINESS et une clé API
 * Obtenir la clé: https://app.lupaupscaler.com/profile
 */

import type { UpscaleModel } from '.';

// Types
type LupaModel = 'standard' | 'precision';

type LupaRequest = {
  image: string;           // URL de l'image (doit être accessible publiquement)
  creativity: number;      // -10 à 10
  Resolution: number;      // 2, 4, ou 6
};

type LupaResponse = {
  status: 'success' | 'error';
  response?: {
    upscale_id: string;
  };
  message?: string;
};

type LupaStatusResponse = {
  status: 'success' | 'error';
  response?: {
    process_status: 'processing' | 'completed' | 'failed';
    final_image_url?: string;
    error_type?: string;
    message?: string;
  };
  message?: string;
};

const BASE_URL = 'https://app.lupaupscaler.com/api/1.1/wf';

/**
 * Appelle l'API Lupa pour démarrer un upscale
 */
async function startLupaUpscale(
  model: LupaModel,
  input: LupaRequest
): Promise<string> {
  const apiKey = process.env.LUPA_API_KEY;
  
  if (!apiKey) {
    throw new Error('LUPA_API_KEY non configuré. Obtenez votre clé sur https://app.lupaupscaler.com/profile (requiert plan BUSINESS)');
  }

  const endpoint = `${BASE_URL}/${model}`;

  console.log('[Lupa] Starting upscale with:', { endpoint, model, imageUrl: input.image.substring(0, 100) + '...' });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(input),
  });

  const responseText = await response.text();
  console.log('[Lupa] Start response:', response.status, responseText);

  if (!response.ok) {
    throw new Error(`Erreur Lupa API (${response.status}): ${responseText}`);
  }

  let data: LupaResponse;
  try {
    data = JSON.parse(responseText) as LupaResponse;
  } catch {
    throw new Error(`Réponse Lupa invalide: ${responseText}`);
  }

  console.log('[Lupa] Parsed response:', data);

  if (data.status !== 'success' || !data.response?.upscale_id) {
    throw new Error(data.message || 'Erreur lors du démarrage de l\'upscale');
  }

  return data.response.upscale_id;
}

/**
 * Vérifie le statut d'un upscale et récupère l'URL finale
 * Documentation: https://lupaupscaler.gitbook.io/lupaupscaler-docs/api/apis-endpoints/images-and-media
 */
async function checkLupaStatus(upscaleId: string): Promise<string> {
  const apiKey = process.env.LUPA_API_KEY;
  
  if (!apiKey) {
    throw new Error('LUPA_API_KEY non configuré');
  }

  // L'endpoint de statut est un GET avec upscale_id en query parameter
  const endpoint = `${BASE_URL}/check-upscale-status?upscale_id=${encodeURIComponent(upscaleId)}`;

  console.log('[Lupa] Checking status for upscale_id:', upscaleId);

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      'x-api-key': apiKey,
    },
  });

  const responseText = await response.text();
  console.log('[Lupa] Check status response:', response.status, responseText);

  if (!response.ok) {
    // Essayer de parser l'erreur
    try {
      const errorData = JSON.parse(responseText);
      throw new Error(`Lupa API error: ${errorData.message || errorData.error || response.status}`);
    } catch {
      throw new Error(`Erreur lors de la vérification du statut (HTTP ${response.status}): ${responseText}`);
    }
  }

  let data: LupaStatusResponse;
  try {
    data = JSON.parse(responseText) as LupaStatusResponse;
  } catch {
    throw new Error(`Réponse Lupa invalide: ${responseText}`);
  }

  console.log('[Lupa] Status data:', data);

  // Vérifier le process_status dans la réponse
  if (data.status === 'success' && data.response) {
    if (data.response.process_status === 'completed' && data.response.final_image_url) {
      return data.response.final_image_url;
    }

    if (data.response.process_status === 'failed') {
      throw new Error(data.response.message || `Upscale échoué: ${data.response.error_type || 'erreur inconnue'}`);
    }

    if (data.response.process_status === 'processing') {
      // Encore en cours
      throw new Error('PROCESSING');
    }
  }

  if (data.status === 'error') {
    throw new Error(data.message || 'Erreur lors de l\'upscale');
  }

  // Encore en cours par défaut
  throw new Error('PROCESSING');
}

/**
 * Attend la fin du traitement et retourne l'URL
 */
async function waitForCompletion(upscaleId: string): Promise<string> {
  const maxAttempts = 144; // 12 minutes max (5s * 144)
  let attempts = 0;

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // 5 secondes

    try {
      const url = await checkLupaStatus(upscaleId);
      return url;
    } catch (error) {
      if (error instanceof Error && error.message === 'PROCESSING') {
        attempts++;
        continue;
      }
      throw error;
    }
  }

  throw new Error('Timeout: upscaling trop long');
}

/**
 * Crée un modèle Lupa Standard
 * - Rapide et efficace
 * - Bon pour la plupart des cas
 */
function createLupaStandardModel(): UpscaleModel {
  return {
    modelId: 'lupa-standard',
    generate: async ({ imageUrl, scale, creativity }) => {
      if (!imageUrl) {
        throw new Error('imageUrl requis');
      }

      // Mapper scale vers Resolution Lupa (2, 4, 6)
      let resolution = 2;
      if (scale && scale >= 4) resolution = 4;
      if (scale && scale >= 6) resolution = 6;

      // Utiliser creativity de l'UI ou valeur par défaut (5 = équilibré)
      const finalCreativity = creativity !== undefined ? creativity : 5;

      const upscaleId = await startLupaUpscale('standard', {
        image: imageUrl,
        creativity: finalCreativity,
        Resolution: resolution,
      });

      return waitForCompletion(upscaleId);
    },
  };
}

/**
 * Crée un modèle Lupa Precision
 * - Plus de détails et contrôle
 * - Meilleur pour les portraits et détails fins
 */
function createLupaPrecisionModel(): UpscaleModel {
  return {
    modelId: 'lupa-precision',
    generate: async ({ imageUrl, scale, creativity }) => {
      if (!imageUrl) {
        throw new Error('imageUrl requis');
      }

      let resolution = 2;
      if (scale && scale >= 4) resolution = 4;
      if (scale && scale >= 6) resolution = 6;

      // Utiliser creativity de l'UI ou valeur par défaut (3 = plus conservateur)
      const finalCreativity = creativity !== undefined ? creativity : 3;

      const upscaleId = await startLupaUpscale('precision', {
        image: imageUrl,
        creativity: finalCreativity,
        Resolution: resolution,
      });

      return waitForCompletion(upscaleId);
    },
  };
}

/**
 * Export des modèles Lupa
 */
export const lupa = {
  standard: (): UpscaleModel => createLupaStandardModel(),
  precision: (): UpscaleModel => createLupaPrecisionModel(),
};

/**
 * Fonction utilitaire pour upscaler avec paramètres personnalisés
 */
export async function lupaUpscale(params: {
  imageUrl: string;
  model?: 'standard' | 'precision';
  creativity?: number;
  resolution?: 2 | 4 | 6;
}): Promise<string> {
  const {
    imageUrl,
    model = 'standard',
    creativity = 5,
    resolution = 2,
  } = params;

  const upscaleId = await startLupaUpscale(model, {
    image: imageUrl,
    creativity: Math.max(-10, Math.min(10, creativity)),
    Resolution: resolution,
  });

  return waitForCompletion(upscaleId);
}

