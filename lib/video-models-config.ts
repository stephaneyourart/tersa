/**
 * CONFIGURATION DES MODÈLES VIDÉO WAVESPEED
 * 
 * CE FICHIER EST LA SOURCE DE VÉRITÉ pour tous les modèles vidéo.
 * 
 * Les IDs utilisés sont les VRAIS endpoints WaveSpeed (pas d'alias).
 * 
 * Basé sur la documentation officielle WaveSpeed API v3.
 */

// ============================================================
// TYPES
// ============================================================

export interface VideoModelConfig {
  /** ID = endpoint WaveSpeed (ex: kwaivgi/kling-v2.6-pro/image-to-video) */
  id: string;
  
  /** Nom affiché dans l'UI */
  displayName: string;
  
  /** URL complète de l'API */
  fullApiUrl: string;
  
  /** Supporte le mode First Frame Only (1 image) */
  supportsFirstOnly: boolean;
  
  /** Supporte le mode First + Last Frames (2 images) */
  supportsFirstLast: boolean;
  
  /** Paramètres API */
  apiParams: {
    /** Nom du champ pour l'image de départ */
    firstFrameField: string;
    
    /** Nom du champ pour l'image de fin (si supporté) */
    lastFrameField: string | null;
    
    /** Nom du champ pour le guidance/cfg scale */
    guidanceField: string;
    
    /** Valeur par défaut du guidance */
    guidanceDefault: number;
    
    /** Range du guidance */
    guidanceRange: [number, number];
    
    /** Durées supportées en secondes */
    durations: number[];
    
    /** Durée par défaut */
    durationDefault: number;
    
    /** Champs optionnels supplémentaires */
    optionalFields: string[];
  };
  
  /** Coût estimé par seconde de vidéo (en $) */
  costPerSecond: number;
  
  /** Notes / limitations */
  notes: string;
}

// ============================================================
// MODÈLES DISPONIBLES
// ID = endpoint WaveSpeed exact
// ============================================================

export const VIDEO_MODELS: Record<string, VideoModelConfig> = {
  
  // ----------------------------------------------------------
  // KLING v2.6 Pro - First Frame ONLY
  // ----------------------------------------------------------
  'kwaivgi/kling-v2.6-pro/image-to-video': {
    id: 'kwaivgi/kling-v2.6-pro/image-to-video',
    displayName: 'Kling v2.6 Pro (First Frame Only)',
    fullApiUrl: 'https://api.wavespeed.ai/api/v3/kwaivgi/kling-v2.6-pro/image-to-video',
    
    supportsFirstOnly: true,
    supportsFirstLast: false, // PAS de last_image dans cette API !
    
    apiParams: {
      firstFrameField: 'image',
      lastFrameField: null, // NON SUPPORTÉ
      guidanceField: 'cfg_scale', // ATTENTION: c'est cfg_scale, PAS guidance_scale
      guidanceDefault: 0.5,
      guidanceRange: [0, 1],
      durations: [5, 10],
      durationDefault: 5,
      optionalFields: ['negative_prompt', 'sound'],
    },
    
    costPerSecond: 0.08,
    notes: 'Modèle haute qualité. sound=true par défaut. PAS de support last_image.',
  },
  
  // ----------------------------------------------------------
  // KLING v2.5 Turbo Pro - First + Last Frames
  // ----------------------------------------------------------
  'kwaivgi/kling-v2.5-turbo-pro/image-to-video': {
    id: 'kwaivgi/kling-v2.5-turbo-pro/image-to-video',
    displayName: 'Kling v2.5 Turbo Pro (First + Last Frames)',
    fullApiUrl: 'https://api.wavespeed.ai/api/v3/kwaivgi/kling-v2.5-turbo-pro/image-to-video',
    
    supportsFirstOnly: true, // Peut aussi fonctionner avec 1 seule image
    supportsFirstLast: true, // SUPPORTE last_image !
    
    apiParams: {
      firstFrameField: 'image',
      lastFrameField: 'last_image', // SUPPORTÉ !
      guidanceField: 'guidance_scale', // ATTENTION: c'est guidance_scale, PAS cfg_scale
      guidanceDefault: 0.5,
      guidanceRange: [0, 1],
      durations: [5, 10],
      durationDefault: 5,
      optionalFields: ['negative_prompt'],
    },
    
    costPerSecond: 0.03,
    notes: 'Modèle rapide avec support first+last frame. Utilise guidance_scale.',
  },
};

// ============================================================
// CONFIGURATIONS PAR MODE
// ============================================================

export interface ModeConfig {
  /** Nom du mode */
  name: string;
  
  /** Description */
  description: string;
  
  /** ID du modèle vidéo (= endpoint WaveSpeed) */
  videoModelId: string;
  
  /** Mode de frame */
  frameMode: 'first-only' | 'first-last';
  
  /** Durée vidéo par défaut */
  videoDuration: number;
  
  /** Paramètres API envoyés */
  apiParamsExample: Record<string, unknown>;
}

export const MODE_CONFIGS: Record<string, ModeConfig> = {
  
  // ----------------------------------------------------------
  // MODE TEST - First Frame Only
  // ----------------------------------------------------------
  'test-first-only': {
    name: 'Test - First Frame Only',
    description: 'Mode test rapide avec 1 seule image (first frame)',
    videoModelId: 'kwaivgi/kling-v2.6-pro/image-to-video',
    frameMode: 'first-only',
    videoDuration: 5,
    
    apiParamsExample: {
      // Endpoint: POST https://api.wavespeed.ai/api/v3/kwaivgi/kling-v2.6-pro/image-to-video
      image: '<base64_ou_url_image_first_frame>',
      prompt: '<prompt_video>',
      cfg_scale: 0.5,
      duration: 5,
      sound: true,
    },
  },
  
  // ----------------------------------------------------------
  // MODE PROD - First Frame Only
  // ----------------------------------------------------------
  'prod-first-only': {
    name: 'Prod - First Frame Only',
    description: 'Mode production avec 1 seule image (first frame)',
    videoModelId: 'kwaivgi/kling-v2.6-pro/image-to-video',
    frameMode: 'first-only',
    videoDuration: 10,
    
    apiParamsExample: {
      // Endpoint: POST https://api.wavespeed.ai/api/v3/kwaivgi/kling-v2.6-pro/image-to-video
      image: '<base64_ou_url_image_first_frame>',
      prompt: '<prompt_video>',
      cfg_scale: 0.5,
      duration: 10,
      sound: true,
    },
  },
  
  // ----------------------------------------------------------
  // MODE PROD - First + Last Frames
  // ----------------------------------------------------------
  'prod-first-last': {
    name: 'Prod - First + Last Frames',
    description: 'Mode production avec 2 images (first + last frames)',
    videoModelId: 'kwaivgi/kling-v2.5-turbo-pro/image-to-video',
    frameMode: 'first-last',
    videoDuration: 10,
    
    apiParamsExample: {
      // Endpoint: POST https://api.wavespeed.ai/api/v3/kwaivgi/kling-v2.5-turbo-pro/image-to-video
      image: '<base64_ou_url_image_first_frame>',
      last_image: '<base64_ou_url_image_last_frame>',
      prompt: '<prompt_video>',
      guidance_scale: 0.5,
      duration: 10,
    },
  },
};

// ============================================================
// CONTRAINTES API (DOCUMENTATION WAVESPEED)
// ============================================================

export const API_CONSTRAINTS = {
  image: {
    formats: ['.jpg', '.jpeg', '.png'],
    maxSizeMB: 10,
    minResolution: 300, // px (width et height)
    aspectRatioRange: [1/2.5, 2.5/1], // entre 1:2.5 et 2.5:1
  },
  prompt: {
    maxLength: 2500,
  },
  duration: {
    allowedValues: [5, 10],
  },
  guidanceScale: {
    min: 0,
    max: 1,
    default: 0.5,
  },
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Retourne la config d'un modèle vidéo par son ID
 */
export function getVideoModelConfig(modelId: string): VideoModelConfig | undefined {
  return VIDEO_MODELS[modelId];
}

/**
 * Retourne la config d'un mode
 */
export function getModeConfig(modeId: string): ModeConfig | undefined {
  return MODE_CONFIGS[modeId];
}

/**
 * Retourne le nom du champ pour le guidance selon le modèle
 */
export function getGuidanceFieldName(modelId: string): string {
  const config = VIDEO_MODELS[modelId];
  return config?.apiParams.guidanceField || 'guidance_scale';
}

/**
 * Retourne le nom du champ pour last_image selon le modèle
 */
export function getLastImageFieldName(modelId: string): string | null {
  const config = VIDEO_MODELS[modelId];
  return config?.apiParams.lastFrameField || null;
}

/**
 * Vérifie si un modèle supporte first+last frames
 */
export function supportsFirstLastFrames(modelId: string): boolean {
  const config = VIDEO_MODELS[modelId];
  return config?.supportsFirstLast || false;
}
