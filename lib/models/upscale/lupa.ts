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
  status: 'processing' | 'completed' | 'error';
  response?: {
    upscaled_image_url?: string;
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

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erreur Lupa API: ${error}`);
  }

  const data = await response.json() as LupaResponse;

  if (data.status !== 'success' || !data.response?.upscale_id) {
    throw new Error(data.message || 'Erreur lors du démarrage de l\'upscale');
  }

  return data.response.upscale_id;
}

/**
 * Vérifie le statut d'un upscale et récupère l'URL finale
 */
async function checkLupaStatus(upscaleId: string): Promise<string> {
  const apiKey = process.env.LUPA_API_KEY;
  
  if (!apiKey) {
    throw new Error('LUPA_API_KEY non configuré');
  }

  // L'endpoint de statut (basé sur la documentation)
  const endpoint = `${BASE_URL}/check_status`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({ upscale_id: upscaleId }),
  });

  if (!response.ok) {
    throw new Error('Erreur lors de la vérification du statut');
  }

  const data = await response.json() as LupaStatusResponse;

  if (data.status === 'completed' && data.response?.upscaled_image_url) {
    return data.response.upscaled_image_url;
  }

  if (data.status === 'error') {
    throw new Error(data.message || 'Erreur lors de l\'upscale');
  }

  // Encore en cours
  throw new Error('PROCESSING');
}

/**
 * Attend la fin du traitement et retourne l'URL
 */
async function waitForCompletion(upscaleId: string): Promise<string> {
  const maxAttempts = 60; // 5 minutes max (5s * 60)
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
    generate: async ({ imageUrl, scale }) => {
      if (!imageUrl) {
        throw new Error('imageUrl requis');
      }

      // Mapper scale vers Resolution Lupa (2, 4, 6)
      let resolution = 2;
      if (scale && scale >= 4) resolution = 4;
      if (scale && scale >= 6) resolution = 6;

      const upscaleId = await startLupaUpscale('standard', {
        image: imageUrl,
        creativity: 5, // Valeur par défaut équilibrée
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
    generate: async ({ imageUrl, scale }) => {
      if (!imageUrl) {
        throw new Error('imageUrl requis');
      }

      let resolution = 2;
      if (scale && scale >= 4) resolution = 4;
      if (scale && scale >= 6) resolution = 6;

      const upscaleId = await startLupaUpscale('precision', {
        image: imageUrl,
        creativity: 3, // Plus conservateur pour la précision
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

