/**
 * Configuration des paramètres pour chaque modèle WaveSpeed Video
 * EXTRAIT DIRECTEMENT DU HTML DE LA DOCUMENTATION API WAVESPEED
 * 
 * Chaque modèle a ses propres paramètres supportés.
 * Cette configuration permet d'afficher uniquement les paramètres pertinents
 * dans l'UI et d'envoyer uniquement les paramètres valides à l'API.
 */

export type WaveSpeedVideoParam =
  | 'prompt'
  | 'image'         // Singulier pour certains modèles (Sora, Kling, WAN) - First frame
  | 'last_image'    // Last frame pour Kling (paramètre officiel WaveSpeed)
  | 'images'        // Pluriel pour d'autres (Veo reference)
  | 'video'         // Pour video edit
  | 'audio'         // Pour speech-to-video
  | 'aspect_ratio'
  | 'duration'
  | 'resolution'
  | 'seed'
  | 'negative_prompt'
  | 'guidance_scale'
  | 'fps';

export interface WaveSpeedVideoModelConfig {
  supportedParams: WaveSpeedVideoParam[];
  aspectRatioOptions?: string[];
  durationOptions?: number[];
  resolutionOptions?: string[];
  defaults?: Partial<Record<string, string | number>>;
}

// =============================================================================
// CONFIGURATIONS EXTRAITES DU HTML DE LA DOC API WAVESPEED
// =============================================================================

export const WAVESPEED_VIDEO_MODEL_CONFIGS: Record<string, WaveSpeedVideoModelConfig> = {
  // ============================================================================
  // GOOGLE VEO 3.1
  // ============================================================================

  // https://wavespeed.ai/docs/docs-api/google/google-veo3.1-image-to-video
  // Params: prompt (required), aspect_ratio (16:9, 9:16), duration (8), resolution (720p, 1080p),
  //         negative_prompt, seed (-1 ~ 2147483647)
  'google/veo3.1-image-to-video': {
    supportedParams: ['prompt', 'image', 'aspect_ratio', 'duration', 'resolution', 'negative_prompt', 'seed'],
    aspectRatioOptions: ['16:9', '9:16'],
    durationOptions: [8],
    resolutionOptions: ['720p', '1080p'],
    defaults: {
      aspect_ratio: '16:9',
      duration: 8,
      resolution: '1080p',
    },
  },

  // https://wavespeed.ai/docs/docs-api/google/google-veo3.1-reference-to-video
  // Params: prompt (required), images (required, 1-3), resolution (720p, 1080p),
  //         negative_prompt, seed (-1 ~ 2147483647)
  // PAS de aspect_ratio ni duration !
  'google/veo3.1-reference-to-video': {
    supportedParams: ['prompt', 'images', 'resolution', 'negative_prompt', 'seed'],
    resolutionOptions: ['720p', '1080p'],
    defaults: {
      resolution: '1080p',
    },
  },

  // https://wavespeed.ai/docs/docs-api/google/google-veo3.1-text-to-video
  // Params: prompt (required), aspect_ratio (16:9, 9:16), duration (4, 6, 8),
  //         resolution (720p, 1080p), negative_prompt, seed (-1 ~ 2147483647)
  'google/veo3.1-text-to-video': {
    supportedParams: ['prompt', 'aspect_ratio', 'duration', 'resolution', 'negative_prompt', 'seed'],
    aspectRatioOptions: ['16:9', '9:16'],
    durationOptions: [4, 6, 8],
    resolutionOptions: ['720p', '1080p'],
    defaults: {
      aspect_ratio: '16:9',
      duration: 8,
      resolution: '1080p',
    },
  },

  // ============================================================================
  // OPENAI SORA 2
  // ============================================================================

  // https://wavespeed.ai/docs/docs-api/openai/openai-sora-2-image-to-video-pro
  // Params: prompt (required), image (required), resolution (720p, 1080p), duration (4, 10, 20)
  'openai/sora-2-image-to-video-pro': {
    supportedParams: ['prompt', 'image', 'resolution', 'duration'],
    durationOptions: [4, 10, 20],
    resolutionOptions: ['720p', '1080p'],
    defaults: {
      resolution: '720p',
      duration: 4,
    },
  },

  // https://wavespeed.ai/docs/docs-api/openai/openai-sora-2-text-to-video-pro
  // Params: prompt (required), duration (4, 10, 20)
  'openai/sora-2-text-to-video-pro': {
    supportedParams: ['prompt', 'duration'],
    durationOptions: [4, 10, 20],
    defaults: {
      duration: 4,
    },
  },

  // ============================================================================
  // WAN 2.2 (Video)
  // ============================================================================

  // https://wavespeed.ai/docs/docs-api/wavespeed-ai/wan-2.2-video-edit
  // Params: video (required), prompt (required), resolution (480p, 720p), seed
  'wavespeed-ai/wan-2.2-video-edit': {
    supportedParams: ['video', 'prompt', 'resolution', 'seed'],
    resolutionOptions: ['480p', '720p'],
    defaults: {
      resolution: '480p',
      seed: -1,
    },
  },

  // https://wavespeed.ai/docs/docs-api/wavespeed-ai/wan-2.2-speech-to-video
  // Params: image (required), audio (required), prompt (optional), resolution (480p, 720p), seed
  'wavespeed-ai/wan-2.2-speech-to-video': {
    supportedParams: ['image', 'audio', 'prompt', 'resolution', 'seed'],
    resolutionOptions: ['480p', '720p'],
    defaults: {
      resolution: '480p',
      seed: -1,
    },
  },

  // ============================================================================
  // KWAIVGI KLING v2.5 TURBO PRO
  // ============================================================================

  // https://wavespeed.ai/docs/docs-api/kwaivgi/kwaivgi-kling-v2.5-turbo-pro-image-to-video
  // Params: image (required), last_image (optional), prompt (required), negative_prompt, guidance_scale, duration (5, 10)
  'kwaivgi/kling-v2.5-turbo-pro-image-to-video': {
    supportedParams: ['image', 'last_image', 'prompt', 'negative_prompt', 'guidance_scale', 'duration'],
    durationOptions: [5, 10],
    defaults: {
      duration: 5,
    },
  },

  // https://wavespeed.ai/docs/docs-api/kwaivgi/kwaivgi-kling-v2.5-turbo-pro-text-to-video
  // Params: prompt (required), negative_prompt, aspect_ratio (1:1, 16:9, 9:16), duration (5, 10)
  'kwaivgi/kling-v2.5-turbo-pro-text-to-video': {
    supportedParams: ['prompt', 'negative_prompt', 'aspect_ratio', 'duration'],
    aspectRatioOptions: ['1:1', '16:9', '9:16'],
    durationOptions: [5, 10],
    defaults: {
      aspect_ratio: '16:9',
      duration: 5,
    },
  },

  // ============================================================================
  // ALIAS POUR LES MODELES AVEC modelId COURT
  // ============================================================================

  // Alias pour Kling (utilisé avec modelId court) - supporte last_image
  'kling-v2.5-turbo': {
    supportedParams: ['image', 'last_image', 'prompt', 'negative_prompt', 'guidance_scale', 'aspect_ratio', 'duration'],
    aspectRatioOptions: ['1:1', '16:9', '9:16'],
    durationOptions: [5, 10],
    defaults: {
      aspect_ratio: '16:9',
      duration: 5,
    },
  },
  
  'kling-v2.5-standard': {
    supportedParams: ['image', 'last_image', 'prompt', 'negative_prompt', 'guidance_scale', 'aspect_ratio', 'duration'],
    aspectRatioOptions: ['1:1', '16:9', '9:16'],
    durationOptions: [5, 10],
    defaults: {
      aspect_ratio: '16:9',
      duration: 5,
    },
  },
  
  'kling-v2.5-pro': {
    supportedParams: ['image', 'last_image', 'prompt', 'negative_prompt', 'guidance_scale', 'aspect_ratio', 'duration'],
    aspectRatioOptions: ['1:1', '16:9', '9:16'],
    durationOptions: [5, 10],
    defaults: {
      aspect_ratio: '16:9',
      duration: 5,
    },
  },

  // Alias pour Seedream
  'seedream-v1': {
    supportedParams: ['prompt', 'aspect_ratio', 'duration', 'seed'],
    aspectRatioOptions: ['16:9', '9:16', '1:1'],
    durationOptions: [5, 10],
    defaults: {
      aspect_ratio: '16:9',
      duration: 5,
    },
  },

  // Alias pour WAN 2.1
  'wan-2.1': {
    supportedParams: ['prompt', 'image', 'resolution', 'seed'],
    resolutionOptions: ['480p', '720p'],
    defaults: {
      resolution: '480p',
    },
  },

  'wan-2.1-pro': {
    supportedParams: ['prompt', 'image', 'resolution', 'seed'],
    resolutionOptions: ['480p', '720p', '1080p'],
    defaults: {
      resolution: '720p',
    },
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Récupère la configuration d'un modèle vidéo
 */
export function getVideoModelConfig(modelPath: string): WaveSpeedVideoModelConfig | null {
  return WAVESPEED_VIDEO_MODEL_CONFIGS[modelPath] || null;
}

/**
 * Vérifie si un paramètre est supporté par un modèle vidéo
 */
export function isVideoParamSupported(modelPath: string, param: WaveSpeedVideoParam): boolean {
  const config = getVideoModelConfig(modelPath);
  return config ? config.supportedParams.includes(param) : false;
}

/**
 * Construit le body de requête avec uniquement les paramètres supportés pour vidéo
 */
export function buildVideoRequestBody(
  modelPath: string,
  params: {
    prompt?: string;
    image?: string;
    last_image?: string;
    images?: string[];
    video?: string;
    audio?: string;
    aspect_ratio?: string;
    duration?: number;
    resolution?: string;
    seed?: number;
    negative_prompt?: string;
    guidance_scale?: number;
    fps?: number;
  }
): Record<string, unknown> {
  const config = getVideoModelConfig(modelPath);
  
  // Si pas de config, envoyer tous les paramètres (fallback)
  if (!config) {
    console.warn(`[WaveSpeed Video] No config found for model: ${modelPath}, using all params`);
    return {
      ...(params.prompt && { prompt: params.prompt }),
      ...(params.image && { image: params.image }),
      ...(params.last_image && { last_image: params.last_image }),
      ...(params.images && { images: params.images }),
      ...(params.video && { video: params.video }),
      ...(params.audio && { audio: params.audio }),
      ...(params.aspect_ratio && { aspect_ratio: params.aspect_ratio }),
      ...(params.duration !== undefined && { duration: params.duration }),
      ...(params.resolution && { resolution: params.resolution }),
      ...(params.seed !== undefined && { seed: params.seed }),
      ...(params.negative_prompt && { negative_prompt: params.negative_prompt }),
      ...(params.guidance_scale !== undefined && { guidance_scale: params.guidance_scale }),
      ...(params.fps !== undefined && { fps: params.fps }),
      enable_base64_output: false,
      enable_sync_mode: false,
    };
  }

  // Construire le body avec uniquement les paramètres supportés
  const body: Record<string, unknown> = {
    enable_base64_output: false,
    enable_sync_mode: false,
  };

  const supported = config.supportedParams;

  if (supported.includes('prompt') && params.prompt) {
    body.prompt = params.prompt;
  }

  if (supported.includes('image') && params.image) {
    body.image = params.image;
  }

  if (supported.includes('last_image') && params.last_image) {
    body.last_image = params.last_image;
  }

  if (supported.includes('images') && params.images?.length) {
    body.images = params.images;
  }

  if (supported.includes('video') && params.video) {
    body.video = params.video;
  }

  if (supported.includes('audio') && params.audio) {
    body.audio = params.audio;
  }

  if (supported.includes('aspect_ratio')) {
    body.aspect_ratio = params.aspect_ratio || config.defaults?.aspect_ratio;
  }

  if (supported.includes('duration')) {
    body.duration = params.duration ?? config.defaults?.duration;
  }

  if (supported.includes('resolution')) {
    body.resolution = params.resolution || config.defaults?.resolution;
  }

  if (supported.includes('seed') && params.seed !== undefined) {
    body.seed = params.seed;
  }

  if (supported.includes('negative_prompt') && params.negative_prompt) {
    body.negative_prompt = params.negative_prompt;
  }

  if (supported.includes('guidance_scale') && params.guidance_scale !== undefined) {
    body.guidance_scale = params.guidance_scale;
  }

  if (supported.includes('fps') && params.fps !== undefined) {
    body.fps = params.fps;
  }

  return body;
}
