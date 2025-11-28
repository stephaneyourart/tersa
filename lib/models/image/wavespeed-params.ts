/**
 * Configuration des paramètres pour chaque modèle WaveSpeed Image
 * EXTRAIT DIRECTEMENT DU HTML DE LA DOCUMENTATION API WAVESPEED
 * 
 * Chaque modèle a ses propres paramètres supportés.
 * Cette configuration permet d'afficher uniquement les paramètres pertinents
 * dans l'UI et d'envoyer uniquement les paramètres valides à l'API.
 */

export type WaveSpeedParam =
  | 'prompt'
  | 'images'
  | 'aspect_ratio'
  | 'resolution'
  | 'output_format'
  | 'seed'
  | 'guidance_scale'
  | 'num_inference_steps'
  | 'negative_prompt'
  | 'width'
  | 'height'
  | 'num_images'
  | 'strength';

export interface WaveSpeedModelConfig {
  supportedParams: WaveSpeedParam[];
  aspectRatioOptions?: string[];
  resolutionOptions?: string[];
  outputFormatOptions?: string[];
  defaults?: Partial<Record<string, string | number>>;
}

// =============================================================================
// CONFIGURATIONS EXTRAITES DU HTML DE LA DOC API WAVESPEED
// =============================================================================

export const WAVESPEED_MODEL_CONFIGS: Record<string, WaveSpeedModelConfig> = {
  // ============================================================================
  // NANO BANANA (non-Pro) - Google
  // ============================================================================
  
  // https://wavespeed.ai/docs/docs-api/google/google-nano-banana-text-to-image
  // Params: prompt (required), aspect_ratio, output_format
  'google/nano-banana/text-to-image': {
    supportedParams: ['prompt', 'aspect_ratio', 'output_format'],
    aspectRatioOptions: ['1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
    outputFormatOptions: ['jpeg', 'png'],
    defaults: {
      output_format: 'jpeg',
    },
  },

  // https://wavespeed.ai/docs/docs-api/google/google-nano-banana-edit
  // Params: prompt (required), images (required), output_format
  'google/nano-banana/edit': {
    supportedParams: ['prompt', 'images', 'output_format'],
    outputFormatOptions: ['jpeg', 'png'],
    defaults: {
      output_format: 'jpeg',
    },
  },

  // https://wavespeed.ai/docs/docs-api/google/google-nano-banana-effects
  'google/nano-banana/effects': {
    supportedParams: ['prompt', 'images', 'output_format'],
    outputFormatOptions: ['jpeg', 'png'],
    defaults: {
      output_format: 'jpeg',
    },
  },

  // ============================================================================
  // NANO BANANA PRO - Google
  // ============================================================================

  // https://wavespeed.ai/docs/docs-api/google/google-nano-banana-pro-text-to-image
  // Params: prompt (required), aspect_ratio, resolution (1k, 4k), output_format (jpeg, png)
  'google/nano-banana-pro/text-to-image': {
    supportedParams: ['prompt', 'aspect_ratio', 'resolution', 'output_format'],
    aspectRatioOptions: ['1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
    resolutionOptions: ['1k', '4k'],
    outputFormatOptions: ['jpeg', 'png'],
    defaults: {
      resolution: '1k',
      output_format: 'jpeg',
    },
  },

  // https://wavespeed.ai/docs/docs-api/google/google-nano-banana-pro-text-to-image-multi
  // Params: prompt (required), aspect_ratio (REQUIRED!), num_images (default: 2), output_format
  // PAS DE resolution !
  'google/nano-banana-pro/text-to-image-multi': {
    supportedParams: ['prompt', 'aspect_ratio', 'num_images', 'output_format'],
    aspectRatioOptions: ['3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9', '1:1'],
    outputFormatOptions: ['png', 'jpeg'],
    defaults: {
      aspect_ratio: '3:2',
      num_images: 2,
      output_format: 'jpeg',
    },
  },

  // https://wavespeed.ai/docs/docs-api/google/google-nano-banana-pro-text-to-image-ultra
  // Params: prompt (required), aspect_ratio, resolution (4k, 8k), output_format
  'google/nano-banana-pro/text-to-image-ultra': {
    supportedParams: ['prompt', 'aspect_ratio', 'resolution', 'output_format'],
    aspectRatioOptions: ['1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
    resolutionOptions: ['4k', '8k'],
    outputFormatOptions: ['png', 'jpeg'],
    defaults: {
      resolution: '4k',
      output_format: 'jpeg',
    },
  },

  // https://wavespeed.ai/docs/docs-api/google/google-nano-banana-pro-edit
  // Params: prompt (required), images (required, 1-14), aspect_ratio, resolution (1k, 2k, 4k), output_format
  'google/nano-banana-pro/edit': {
    supportedParams: ['prompt', 'images', 'aspect_ratio', 'resolution', 'output_format'],
    aspectRatioOptions: ['1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
    resolutionOptions: ['1k', '2k', '4k'],
    outputFormatOptions: ['png', 'jpeg'],
    defaults: {
      resolution: '1k',
      output_format: 'png',
    },
  },

  // https://wavespeed.ai/docs/docs-api/google/google-nano-banana-pro-edit-multi
  // Params: prompt (required), images (required, 1-14), aspect_ratio, num_images (default: 2), output_format
  // PAS DE resolution !
  'google/nano-banana-pro/edit-multi': {
    supportedParams: ['prompt', 'images', 'aspect_ratio', 'num_images', 'output_format'],
    aspectRatioOptions: ['3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9', '1:1'],
    outputFormatOptions: ['png', 'jpeg'],
    defaults: {
      num_images: 2,
      output_format: 'jpeg',
    },
  },

  // https://wavespeed.ai/docs/docs-api/google/google-nano-banana-pro-edit-ultra
  // Params: prompt (required), images (required), aspect_ratio, resolution (4k, 8k), output_format
  'google/nano-banana-pro/edit-ultra': {
    supportedParams: ['prompt', 'images', 'aspect_ratio', 'resolution', 'output_format'],
    aspectRatioOptions: ['1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
    resolutionOptions: ['4k', '8k'],
    outputFormatOptions: ['jpeg', 'png'],
    defaults: {
      resolution: '4k',
      output_format: 'jpeg',
    },
  },

  // ============================================================================
  // FLUX 2 PRO - WaveSpeed AI
  // ============================================================================

  // https://wavespeed.ai/docs/docs-api/wavespeed-ai/flux-2-pro-edit
  // Params: prompt (required), images (required, 1-3), seed
  'wavespeed-ai/flux-2-pro/edit': {
    supportedParams: ['prompt', 'images', 'seed'],
    defaults: {
      seed: -1,
    },
  },

  // https://wavespeed.ai/docs/docs-api/wavespeed-ai/flux-2-pro-text-to-image
  // Params: prompt (required), seed
  'wavespeed-ai/flux-2-pro/text-to-image': {
    supportedParams: ['prompt', 'seed'],
    defaults: {
      seed: -1,
    },
  },

  // https://wavespeed.ai/docs/docs-api/wavespeed-ai/flux-controlnet-union-pro-2.0
  // Params: prompt (required), num_inference_steps (1-50, default: 28), 
  //         guidance_scale (0-20, default: 3.5), seed, num_images (1-4), output_format
  'wavespeed-ai/flux-controlnet-union-pro-2.0': {
    supportedParams: ['prompt', 'num_inference_steps', 'guidance_scale', 'seed', 'num_images', 'output_format'],
    outputFormatOptions: ['jpeg', 'png'],
    defaults: {
      num_inference_steps: 28,
      guidance_scale: 3.5,
      num_images: 1,
      output_format: 'jpeg',
    },
  },

  // ============================================================================
  // WAN 2.2 - WaveSpeed AI (Image)
  // ============================================================================

  // https://wavespeed.ai/docs/docs-api/wavespeed-ai/wan-2.2-text-to-image-realism
  // Params: prompt (required), seed, output_format
  'wavespeed-ai/wan-2.2-text-to-image-realism': {
    supportedParams: ['prompt', 'seed', 'output_format'],
    outputFormatOptions: ['jpeg', 'png'],
    defaults: {
      seed: -1,
      output_format: 'jpeg',
    },
  },

  // ============================================================================
  // GOOGLE IMAGEN
  // ============================================================================

  'google/imagen3': {
    supportedParams: ['prompt', 'aspect_ratio', 'output_format'],
    aspectRatioOptions: ['1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9'],
    outputFormatOptions: ['jpeg', 'png'],
    defaults: {
      output_format: 'jpeg',
    },
  },

  'google/imagen3-fast': {
    supportedParams: ['prompt', 'aspect_ratio', 'output_format'],
    aspectRatioOptions: ['1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9'],
    outputFormatOptions: ['jpeg', 'png'],
    defaults: {
      output_format: 'jpeg',
    },
  },

  'google/imagen4': {
    supportedParams: ['prompt', 'aspect_ratio', 'output_format'],
    aspectRatioOptions: ['1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9'],
    outputFormatOptions: ['jpeg', 'png'],
    defaults: {
      output_format: 'jpeg',
    },
  },

  'google/imagen4-fast': {
    supportedParams: ['prompt', 'aspect_ratio', 'output_format'],
    aspectRatioOptions: ['1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9'],
    outputFormatOptions: ['jpeg', 'png'],
    defaults: {
      output_format: 'jpeg',
    },
  },

  'google/imagen4-ultra': {
    supportedParams: ['prompt', 'aspect_ratio', 'output_format'],
    aspectRatioOptions: ['1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9'],
    outputFormatOptions: ['jpeg', 'png'],
    defaults: {
      output_format: 'jpeg',
    },
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

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
    num_images?: number;
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
      ...(params.seed !== undefined && { seed: params.seed }),
      ...(params.guidance_scale !== undefined && { guidance_scale: params.guidance_scale }),
      ...(params.num_inference_steps !== undefined && { num_inference_steps: params.num_inference_steps }),
      ...(params.negative_prompt && { negative_prompt: params.negative_prompt }),
      ...(params.num_images !== undefined && { num_images: params.num_images }),
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
    body.resolution = params.resolution || config.defaults?.resolution;
  }

  if (supported.includes('output_format')) {
    body.output_format = params.output_format || config.defaults?.output_format || 'jpeg';
  }

  if (supported.includes('seed') && params.seed !== undefined) {
    body.seed = params.seed;
  }

  if (supported.includes('guidance_scale')) {
    body.guidance_scale = params.guidance_scale ?? config.defaults?.guidance_scale;
  }

  if (supported.includes('num_inference_steps')) {
    body.num_inference_steps = params.num_inference_steps ?? config.defaults?.num_inference_steps;
  }

  if (supported.includes('negative_prompt') && params.negative_prompt) {
    body.negative_prompt = params.negative_prompt;
  }

  if (supported.includes('num_images')) {
    body.num_images = params.num_images ?? config.defaults?.num_images;
  }

  if (supported.includes('width') && params.width !== undefined) {
    body.width = params.width;
  }

  if (supported.includes('height') && params.height !== undefined) {
    body.height = params.height;
  }

  return body;
}
