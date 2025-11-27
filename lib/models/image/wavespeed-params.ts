/**
 * Configuration des paramètres WaveSpeed par modèle
 * Chaque modèle a ses propres paramètres supportés selon la documentation officielle
 * https://wavespeed.ai/docs/docs-api/
 */

// Types des paramètres possibles
export type WaveSpeedParam = 
  | 'prompt'
  | 'aspect_ratio'
  | 'output_format'
  | 'resolution'
  | 'width'
  | 'height'
  | 'seed'
  | 'guidance_scale'
  | 'num_inference_steps'
  | 'negative_prompt'
  | 'strength'
  | 'images';

// Aspect ratios par modèle (certains ont des options différentes)
export type AspectRatioOptions = readonly string[];

// Configuration d'un modèle
export type WaveSpeedModelConfig = {
  // Paramètres supportés
  supportedParams: WaveSpeedParam[];
  // Options d'aspect ratio (si supporté)
  aspectRatioOptions?: AspectRatioOptions;
  // Options de résolution (si supporté) - ex: '1k', '2k', '4k'
  resolutionOptions?: readonly string[];
  // Options de format de sortie
  outputFormatOptions?: readonly string[];
  // Valeurs par défaut
  defaults?: {
    aspect_ratio?: string;
    output_format?: string;
    resolution?: string;
  };
};

/**
 * Configuration des modèles WaveSpeed
 * Source: https://wavespeed.ai/docs/docs-api/
 */
export const WAVESPEED_MODEL_CONFIGS: Record<string, WaveSpeedModelConfig> = {
  // ========================================
  // NANO BANANA (Google)
  // https://wavespeed.ai/docs/docs-api/google/google-nano-banana-text-to-image
  // ========================================
  'google/nano-banana/text-to-image': {
    supportedParams: ['prompt', 'aspect_ratio', 'output_format'],
    aspectRatioOptions: ['1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
    outputFormatOptions: ['jpeg', 'png'],
    defaults: {
      output_format: 'jpeg',
    },
  },

  // Nano Banana Pro Text To Image
  // https://wavespeed.ai/docs/docs-api/google/google-nano-banana-pro-text-to-image
  'google/nano-banana-pro/text-to-image': {
    supportedParams: ['prompt', 'aspect_ratio', 'output_format'],
    aspectRatioOptions: ['1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
    outputFormatOptions: ['jpeg', 'png'],
    defaults: {
      output_format: 'jpeg',
    },
  },

  // Nano Banana Pro Text To Image Multi
  'google/nano-banana-pro/text-to-image-multi': {
    supportedParams: ['prompt', 'aspect_ratio', 'output_format'],
    aspectRatioOptions: ['1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
    outputFormatOptions: ['jpeg', 'png'],
    defaults: {
      output_format: 'jpeg',
    },
  },

  // Nano Banana Pro Text To Image Ultra
  // https://wavespeed.ai/docs/docs-api/google/google-nano-banana-pro-text-to-image-ultra
  'google/nano-banana-pro/text-to-image-ultra': {
    supportedParams: ['prompt', 'aspect_ratio', 'resolution', 'output_format'],
    aspectRatioOptions: ['1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
    resolutionOptions: ['1k', '2k', '4k'],
    outputFormatOptions: ['jpeg', 'png'],
    defaults: {
      resolution: '2k',
      output_format: 'png',
    },
  },

  // Nano Banana Edit
  'google/nano-banana/edit': {
    supportedParams: ['prompt', 'images', 'output_format'],
    outputFormatOptions: ['jpeg', 'png'],
    defaults: {
      output_format: 'jpeg',
    },
  },

  // Nano Banana Pro Edit
  'google/nano-banana-pro/edit': {
    supportedParams: ['prompt', 'images', 'output_format'],
    outputFormatOptions: ['jpeg', 'png'],
    defaults: {
      output_format: 'jpeg',
    },
  },

  // Nano Banana Pro Edit Multi
  'google/nano-banana-pro/edit-multi': {
    supportedParams: ['prompt', 'images', 'output_format'],
    outputFormatOptions: ['jpeg', 'png'],
    defaults: {
      output_format: 'jpeg',
    },
  },

  // Nano Banana Pro Edit Ultra
  // https://wavespeed.ai/docs/docs-api/google/google-nano-banana-pro-edit-ultra
  // Parameters: prompt (required), images (required), aspect_ratio, resolution (4k/8k), output_format
  'google/nano-banana-pro/edit-ultra': {
    supportedParams: ['prompt', 'images', 'aspect_ratio', 'resolution', 'output_format'],
    aspectRatioOptions: ['1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
    resolutionOptions: ['4k', '8k'], // Correct: 4k et 8k uniquement
    outputFormatOptions: ['jpeg', 'png'],
    defaults: {
      resolution: '4k',
      output_format: 'jpeg',
    },
  },

  // Nano Banana Effects
  'google/nano-banana/effects': {
    supportedParams: ['prompt', 'images', 'output_format'],
    outputFormatOptions: ['jpeg', 'png'],
    defaults: {
      output_format: 'jpeg',
    },
  },

  // ========================================
  // IMAGEN (Google)
  // ========================================
  'google/imagen3': {
    supportedParams: ['prompt', 'aspect_ratio', 'output_format'],
    aspectRatioOptions: ['1:1', '3:4', '4:3', '9:16', '16:9'],
    outputFormatOptions: ['jpeg', 'png'],
    defaults: {
      aspect_ratio: '1:1',
      output_format: 'jpeg',
    },
  },

  'google/imagen3-fast': {
    supportedParams: ['prompt', 'aspect_ratio', 'output_format'],
    aspectRatioOptions: ['1:1', '3:4', '4:3', '9:16', '16:9'],
    outputFormatOptions: ['jpeg', 'png'],
    defaults: {
      aspect_ratio: '1:1',
      output_format: 'jpeg',
    },
  },

  'google/imagen4': {
    supportedParams: ['prompt', 'aspect_ratio', 'output_format'],
    aspectRatioOptions: ['1:1', '3:4', '4:3', '9:16', '16:9'],
    outputFormatOptions: ['jpeg', 'png'],
    defaults: {
      aspect_ratio: '1:1',
      output_format: 'jpeg',
    },
  },

  'google/imagen4-fast': {
    supportedParams: ['prompt', 'aspect_ratio', 'output_format'],
    aspectRatioOptions: ['1:1', '3:4', '4:3', '9:16', '16:9'],
    outputFormatOptions: ['jpeg', 'png'],
    defaults: {
      aspect_ratio: '1:1',
      output_format: 'jpeg',
    },
  },

  'google/imagen4-ultra': {
    supportedParams: ['prompt', 'aspect_ratio', 'resolution', 'output_format'],
    aspectRatioOptions: ['1:1', '3:4', '4:3', '9:16', '16:9'],
    resolutionOptions: ['1k', '2k', '4k'],
    outputFormatOptions: ['jpeg', 'png'],
    defaults: {
      aspect_ratio: '1:1',
      resolution: '2k',
      output_format: 'png',
    },
  },

  // ========================================
  // FLUX (WaveSpeed AI)
  // Ces modèles ont généralement plus de paramètres
  // ========================================
  'wavespeed-ai/flux-dev': {
    supportedParams: ['prompt', 'aspect_ratio', 'seed', 'num_inference_steps', 'guidance_scale', 'output_format'],
    aspectRatioOptions: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9', '9:21'],
    outputFormatOptions: ['jpeg', 'png', 'webp'],
    defaults: {
      aspect_ratio: '1:1',
      num_inference_steps: 28,
      guidance_scale: 3.5,
      output_format: 'jpeg',
    },
  },

  'wavespeed-ai/flux-schnell': {
    supportedParams: ['prompt', 'aspect_ratio', 'seed', 'num_inference_steps', 'output_format'],
    aspectRatioOptions: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9', '9:21'],
    outputFormatOptions: ['jpeg', 'png', 'webp'],
    defaults: {
      aspect_ratio: '1:1',
      num_inference_steps: 4,
      output_format: 'jpeg',
    },
  },
};

/**
 * Récupère la configuration d'un modèle
 */
export function getModelConfig(modelPath: string): WaveSpeedModelConfig | null {
  return WAVESPEED_MODEL_CONFIGS[modelPath] || null;
}

/**
 * Vérifie si un paramètre est supporté par un modèle
 */
export function isParamSupported(modelPath: string, param: WaveSpeedParam): boolean {
  const config = getModelConfig(modelPath);
  return config ? config.supportedParams.includes(param) : false;
}

/**
 * Construit le body de requête avec uniquement les paramètres supportés
 */
export function buildRequestBody(
  modelPath: string,
  params: {
    prompt: string;
    images?: string[];
    aspect_ratio?: string;
    resolution?: string;
    output_format?: string;
    seed?: number;
    guidance_scale?: number;
    num_inference_steps?: number;
    negative_prompt?: string;
    width?: number;
    height?: number;
  }
): Record<string, unknown> {
  const config = getModelConfig(modelPath);
  
  // Si pas de config, envoyer tous les paramètres (fallback)
  if (!config) {
    console.warn(`[WaveSpeed] No config found for model: ${modelPath}, using all params`);
    return {
      prompt: params.prompt,
      ...(params.images && { images: params.images }),
      ...(params.aspect_ratio && { aspect_ratio: params.aspect_ratio }),
      ...(params.resolution && { resolution: params.resolution }),
      ...(params.output_format && { output_format: params.output_format }),
      ...(params.seed && { seed: params.seed }),
      ...(params.guidance_scale && { guidance_scale: params.guidance_scale }),
      ...(params.num_inference_steps && { num_inference_steps: params.num_inference_steps }),
      ...(params.negative_prompt && { negative_prompt: params.negative_prompt }),
      enable_base64_output: false,
      enable_sync_mode: false,
    };
  }

  // Construire le body avec uniquement les paramètres supportés
  const body: Record<string, unknown> = {
    prompt: params.prompt,
    enable_base64_output: false,
    enable_sync_mode: false,
  };

  const supported = config.supportedParams;

  if (supported.includes('images') && params.images?.length) {
    body.images = params.images;
  }

  if (supported.includes('aspect_ratio')) {
    body.aspect_ratio = params.aspect_ratio || config.defaults?.aspect_ratio || '1:1';
  }

  if (supported.includes('resolution')) {
    body.resolution = params.resolution || config.defaults?.resolution || '2k';
  }

  if (supported.includes('output_format')) {
    body.output_format = params.output_format || config.defaults?.output_format || 'jpeg';
  }

  if (supported.includes('seed') && params.seed !== undefined) {
    body.seed = params.seed;
  }

  if (supported.includes('guidance_scale') && params.guidance_scale !== undefined) {
    body.guidance_scale = params.guidance_scale;
  }

  if (supported.includes('num_inference_steps') && params.num_inference_steps !== undefined) {
    body.num_inference_steps = params.num_inference_steps;
  }

  if (supported.includes('negative_prompt') && params.negative_prompt) {
    body.negative_prompt = params.negative_prompt;
  }

  if (supported.includes('width') && params.width !== undefined) {
    body.width = params.width;
  }

  if (supported.includes('height') && params.height !== undefined) {
    body.height = params.height;
  }

  return body;
}

