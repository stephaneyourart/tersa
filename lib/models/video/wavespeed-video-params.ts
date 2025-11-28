/**
 * Configuration des paramètres WaveSpeed pour les modèles VIDÉO
 * Chaque modèle a ses propres paramètres supportés selon la documentation officielle
 * https://wavespeed.ai/docs/docs-api/
 */

export type WaveSpeedVideoParam = 
  | 'prompt'
  | 'image'
  | 'images'
  | 'video'
  | 'audio'
  | 'duration'
  | 'aspect_ratio'
  | 'resolution'
  | 'fps'
  | 'seed'
  | 'negative_prompt'
  | 'cfg_scale'
  | 'output_format';

export type WaveSpeedVideoModelConfig = {
  supportedParams: WaveSpeedVideoParam[];
  aspectRatioOptions?: readonly string[];
  resolutionOptions?: readonly string[];
  durationOptions?: readonly number[];
  fpsOptions?: readonly number[];
  outputFormatOptions?: readonly string[];
  defaults?: {
    aspect_ratio?: string;
    resolution?: string;
    duration?: number;
    fps?: number;
    output_format?: string;
  };
};

/**
 * Configuration des modèles vidéo WaveSpeed
 */
export const WAVESPEED_VIDEO_MODEL_CONFIGS: Record<string, WaveSpeedVideoModelConfig> = {
  // ========================================
  // VEO 3.1 (Google)
  // ========================================
  
  // Veo 3.1 Image to Video
  // https://wavespeed.ai/docs/docs-api/google/google-veo3.1-image-to-video
  'google/veo3.1/image-to-video': {
    supportedParams: ['prompt', 'image', 'duration', 'aspect_ratio'],
    aspectRatioOptions: ['16:9', '9:16'],
    durationOptions: [5, 8],
    defaults: {
      duration: 5,
      aspect_ratio: '16:9',
    },
  },

  // Veo 3.1 Reference to Video
  // https://wavespeed.ai/docs/docs-api/google/google-veo3.1-reference-to-video
  'google/veo3.1/reference-to-video': {
    supportedParams: ['prompt', 'image', 'duration', 'aspect_ratio'],
    aspectRatioOptions: ['16:9', '9:16'],
    durationOptions: [5, 8],
    defaults: {
      duration: 5,
      aspect_ratio: '16:9',
    },
  },

  // Veo 3.1 Text to Video
  // https://wavespeed.ai/docs/docs-api/google/google-veo3.1-text-to-video
  'google/veo3.1/text-to-video': {
    supportedParams: ['prompt', 'duration', 'aspect_ratio'],
    aspectRatioOptions: ['16:9', '9:16'],
    durationOptions: [5, 8],
    defaults: {
      duration: 5,
      aspect_ratio: '16:9',
    },
  },

  // ========================================
  // SORA 2 (OpenAI)
  // ========================================
  
  // Sora 2 Image to Video Pro
  // https://wavespeed.ai/docs/docs-api/openai/openai-sora-2-image-to-video-pro
  'openai/sora-2/image-to-video-pro': {
    supportedParams: ['prompt', 'image', 'duration', 'aspect_ratio', 'resolution'],
    aspectRatioOptions: ['16:9', '9:16', '1:1'],
    resolutionOptions: ['480p', '720p', '1080p'],
    durationOptions: [5, 10, 15, 20],
    defaults: {
      duration: 5,
      aspect_ratio: '16:9',
      resolution: '1080p',
    },
  },

  // Sora 2 Text to Video Pro
  // https://wavespeed.ai/docs/docs-api/openai/openai-sora-2-text-to-video-pro
  'openai/sora-2/text-to-video-pro': {
    supportedParams: ['prompt', 'duration', 'aspect_ratio', 'resolution'],
    aspectRatioOptions: ['16:9', '9:16', '1:1'],
    resolutionOptions: ['480p', '720p', '1080p'],
    durationOptions: [5, 10, 15, 20],
    defaults: {
      duration: 5,
      aspect_ratio: '16:9',
      resolution: '1080p',
    },
  },

  // ========================================
  // WAN 2.2 (WaveSpeed AI)
  // ========================================
  
  // WAN 2.2 Video Edit
  // https://wavespeed.ai/docs/docs-api/wavespeed-ai/wan-2.2-video-edit
  'wavespeed-ai/wan-2.2/video-edit': {
    supportedParams: ['prompt', 'video', 'seed'],
    defaults: {},
  },

  // WAN 2.2 Speech to Video
  // https://wavespeed.ai/docs/docs-api/wavespeed-ai/wan-2.2-speech-to-video
  'wavespeed-ai/wan-2.2/speech-to-video': {
    supportedParams: ['prompt', 'image', 'audio', 'seed'],
    defaults: {},
  },

  // ========================================
  // KLING v2.5 (Kwaivgi)
  // ========================================
  
  // Kling v2.5 Turbo Pro Image to Video
  // https://wavespeed.ai/docs/docs-api/kwaivgi/kwaivgi-kling-v2.5-turbo-pro-image-to-video
  'kwaivgi/kling-v2.5-turbo-pro/image-to-video': {
    supportedParams: ['prompt', 'image', 'duration', 'aspect_ratio', 'negative_prompt', 'cfg_scale', 'seed'],
    aspectRatioOptions: ['16:9', '9:16', '1:1'],
    durationOptions: [5, 10],
    defaults: {
      duration: 5,
      aspect_ratio: '16:9',
      cfg_scale: 0.5,
    },
  },

  // Kling v2.5 Turbo Pro Text to Video
  // https://wavespeed.ai/docs/docs-api/kwaivgi/kwaivgi-kling-v2.5-turbo-pro-text-to-video
  'kwaivgi/kling-v2.5-turbo-pro/text-to-video': {
    supportedParams: ['prompt', 'duration', 'aspect_ratio', 'negative_prompt', 'cfg_scale', 'seed'],
    aspectRatioOptions: ['16:9', '9:16', '1:1'],
    durationOptions: [5, 10],
    defaults: {
      duration: 5,
      aspect_ratio: '16:9',
      cfg_scale: 0.5,
    },
  },
};

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
 * Construit le body de requête pour un modèle vidéo
 */
export function buildVideoRequestBody(
  modelPath: string,
  params: {
    prompt: string;
    image?: string;
    images?: string[];
    video?: string;
    audio?: string;
    duration?: number;
    aspect_ratio?: string;
    resolution?: string;
    fps?: number;
    seed?: number;
    negative_prompt?: string;
    cfg_scale?: number;
    output_format?: string;
  }
): Record<string, unknown> {
  const config = getVideoModelConfig(modelPath);
  
  if (!config) {
    console.warn(`[WaveSpeed Video] No config found for model: ${modelPath}, using all params`);
    return {
      prompt: params.prompt,
      ...(params.image && { image: params.image }),
      ...(params.video && { video: params.video }),
      ...(params.audio && { audio: params.audio }),
      ...(params.duration && { duration: params.duration }),
      ...(params.aspect_ratio && { aspect_ratio: params.aspect_ratio }),
      ...(params.resolution && { resolution: params.resolution }),
      ...(params.seed && { seed: params.seed }),
      ...(params.negative_prompt && { negative_prompt: params.negative_prompt }),
      ...(params.cfg_scale && { cfg_scale: params.cfg_scale }),
      enable_base64_output: false,
      enable_sync_mode: false,
    };
  }

  const body: Record<string, unknown> = {
    prompt: params.prompt,
    enable_base64_output: false,
    enable_sync_mode: false,
  };

  const supported = config.supportedParams;

  if (supported.includes('image') && params.image) {
    body.image = params.image;
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

  if (supported.includes('duration')) {
    body.duration = params.duration || config.defaults?.duration || 5;
  }

  if (supported.includes('aspect_ratio')) {
    body.aspect_ratio = params.aspect_ratio || config.defaults?.aspect_ratio || '16:9';
  }

  if (supported.includes('resolution')) {
    body.resolution = params.resolution || config.defaults?.resolution || '1080p';
  }

  if (supported.includes('fps') && params.fps !== undefined) {
    body.fps = params.fps;
  }

  if (supported.includes('seed') && params.seed !== undefined) {
    body.seed = params.seed;
  }

  if (supported.includes('negative_prompt') && params.negative_prompt) {
    body.negative_prompt = params.negative_prompt;
  }

  if (supported.includes('cfg_scale') && params.cfg_scale !== undefined) {
    body.cfg_scale = params.cfg_scale;
  }

  if (supported.includes('output_format')) {
    body.output_format = params.output_format || config.defaults?.output_format || 'mp4';
  }

  return body;
}

