/**
 * REGISTRE DES MODÈLES - SOURCE DE VÉRITÉ UNIQUE
 * 
 * RÈGLE D'OR : Tous les noms affichés sont les VRAIS noms/endpoints API.
 * Pas d'alias, pas de noms "user-friendly" qui créent de la confusion.
 * 
 * Ce fichier centralise TOUS les modèles disponibles :
 * - LLM (OpenAI, Mistral)
 * - Image Text-to-Image (WaveSpeed)
 * - Image Image-to-Image / Edit (WaveSpeed)
 * - Vidéo (WaveSpeed / Kling)
 */

// ============================================================
// TYPES
// ============================================================

export interface LLMModel {
  /** ID réel du modèle (utilisé dans les appels API) */
  id: string;
  /** Nom affiché = ID (règle d'or) */
  displayName: string;
  /** Supporte le niveau de raisonnement (reasoning_effort) */
  supportsReasoning: boolean;
  /** Description courte */
  description: string;
  /** Coût estimé par 1M tokens input */
  costPer1MInput: number;
  /** Coût estimé par 1M tokens output */
  costPer1MOutput: number;
}

export interface ImageModel {
  /** ID réel = endpoint WaveSpeed */
  id: string;
  /** Nom affiché = ID (règle d'or) */
  displayName: string;
  /** Type de modèle */
  type: 'text-to-image' | 'image-to-image';
  /** Aspect ratios supportés */
  supportedAspectRatios: string[];
  /** Résolutions supportées */
  supportedResolutions: ('4k' | '8k')[];
  /** Coût par image */
  costPerImage: number;
  /** Description */
  description: string;
  
  // Support des dimensions personnalisées (width/height libres)
  /** Si true, le modèle accepte des dimensions personnalisées au lieu d'aspect ratios fixes */
  supportsCustomDimensions?: boolean;
  /** Dimension minimum en pixels (ex: 1024) */
  minDimension?: number;
  /** Dimension maximum en pixels (ex: 4096) */
  maxDimension?: number;
}

export interface VideoModel {
  /** ID réel = endpoint WaveSpeed */
  id: string;
  /** Nom affiché = ID (règle d'or) */
  displayName: string;
  /** Supporte le mode IMAGE FIRST (1 image input) */
  supportsImageFirst: boolean;
  /** Supporte le mode IMAGES FIRST AND LAST (2 images input) */
  supportsImagesFirstLast: boolean;
  /** Durées supportées en secondes */
  supportedDurations: number[];
  /** Nom du champ pour le guidance/cfg */
  guidanceField: 'cfg_scale' | 'guidance_scale';
  /** Valeur par défaut du guidance */
  guidanceDefault: number;
  /** Range du guidance [min, max] */
  guidanceRange: [number, number];
  /** Nom du champ pour last_image (si supporté) */
  lastImageField: string | null;
  /** Coût par seconde de vidéo */
  costPerSecond: number;
  /** Description */
  description: string;
}

// ============================================================
// LLM MODELS
// ============================================================

export const LLM_PROVIDERS = ['openai', 'mistral'] as const;
export type LLMProvider = typeof LLM_PROVIDERS[number];

export const LLM_MODELS: Record<LLMProvider, LLMModel[]> = {
  openai: [
    {
      id: 'o3-2025-04-16',
      displayName: 'o3-2025-04-16',
      supportsReasoning: true,
      description: 'Modèle de raisonnement avancé',
      costPer1MInput: 10.0,
      costPer1MOutput: 40.0,
    },
    {
      id: 'gpt-4o',
      displayName: 'gpt-4o',
      supportsReasoning: false,
      description: 'Rapide et polyvalent',
      costPer1MInput: 2.5,
      costPer1MOutput: 10.0,
    },
    {
      id: 'gpt-4o-mini',
      displayName: 'gpt-4o-mini',
      supportsReasoning: false,
      description: 'Économique',
      costPer1MInput: 0.15,
      costPer1MOutput: 0.60,
    },
  ],
  mistral: [
    {
      id: 'mistral-large-latest',
      displayName: 'mistral-large-latest',
      supportsReasoning: false,
      description: 'Le plus créatif',
      costPer1MInput: 2.0,
      costPer1MOutput: 6.0,
    },
    {
      id: 'mistral-medium-latest',
      displayName: 'mistral-medium-latest',
      supportsReasoning: false,
      description: 'Équilibré',
      costPer1MInput: 1.0,
      costPer1MOutput: 3.0,
    },
    {
      id: 'mistral-small-latest',
      displayName: 'mistral-small-latest',
      supportsReasoning: false,
      description: 'Rapide et économique',
      costPer1MInput: 0.2,
      costPer1MOutput: 0.6,
    },
  ],
};

// ============================================================
// IMAGE MODELS - TEXT TO IMAGE (T2I)
// Pour les images primaires (personnages, décors)
// ============================================================

export const T2I_MODELS: ImageModel[] = [
  {
    // Bytedance Seedream V4.5 - Typography optimized
    id: 'seedream-v4.5-wavespeed',
    displayName: 'Seedream V4.5 (WaveSpeed)',
    type: 'text-to-image',
    // Supporte des dimensions personnalisées de 1024 à 4096 par dimension
    supportedAspectRatios: ['1:1', '7:3', '3:2', '16:9', '21:9'],
    supportedResolutions: ['4k'],
    costPerImage: 0.04,
    description: 'Typography-optimized, dimensions libres 1024-4096px (Bytedance)',
    // DIMENSIONS PERSONNALISÉES
    supportsCustomDimensions: true,
    minDimension: 1024,
    maxDimension: 4096,
  },
  {
    // ID doit correspondre à lib/models/image/index.ts
    id: 'nano-banana-pro-ultra-wavespeed',
    displayName: 'Nano Banana Pro Ultra (WaveSpeed)',
    type: 'text-to-image',
    supportedAspectRatios: ['1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
    supportedResolutions: ['4k', '8k'],
    costPerImage: 0.02,
    description: 'Haute qualité, résolution 4K/8K',
  },
  {
    id: 'nano-banana-pro-wavespeed',
    displayName: 'Nano Banana Pro (WaveSpeed)',
    type: 'text-to-image',
    supportedAspectRatios: ['1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
    supportedResolutions: ['4k'],
    costPerImage: 0.015,
    description: 'Qualité standard',
  },
  {
    id: 'nano-banana-wavespeed',
    displayName: 'Nano Banana (WaveSpeed)',
    type: 'text-to-image',
    supportedAspectRatios: ['1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9'],
    supportedResolutions: ['4k'],
    costPerImage: 0.01,
    description: 'Économique (test)',
  },
];

// ============================================================
// IMAGE MODELS - IMAGE TO IMAGE (I2I)
// Pour les first/last frames des plans
// ============================================================

export const I2I_MODELS: ImageModel[] = [
  {
    // ID doit correspondre à lib/models/image/index.ts
    id: 'nano-banana-pro-edit-ultra-wavespeed',
    displayName: 'Nano Banana Pro Edit Ultra (WaveSpeed)',
    type: 'image-to-image',
    supportedAspectRatios: ['1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
    supportedResolutions: ['4k', '8k'],
    costPerImage: 0.025,
    description: 'Haute qualité, résolution 4K/8K',
  },
  {
    id: 'nano-banana-pro-edit-wavespeed',
    displayName: 'Nano Banana Pro Edit (WaveSpeed)',
    type: 'image-to-image',
    supportedAspectRatios: ['1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
    supportedResolutions: ['4k'],
    costPerImage: 0.018,
    description: 'Qualité standard',
  },
  {
    id: 'nano-banana-edit-wavespeed',
    displayName: 'Nano Banana Edit (WaveSpeed)',
    type: 'image-to-image',
    supportedAspectRatios: ['1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9'],
    supportedResolutions: ['4k'],
    costPerImage: 0.012,
    description: 'Économique (test)',
  },
];

// ============================================================
// VIDEO MODELS
// ============================================================

export const VIDEO_MODELS: VideoModel[] = [
  // ----------------------------------------------------------
  // KLING v2.6 Pro - IMAGE FIRST ONLY
  // Ne supporte PAS last_image
  // ----------------------------------------------------------
  {
    id: 'kwaivgi/kling-v2.6-pro/image-to-video',
    displayName: 'kwaivgi/kling-v2.6-pro/image-to-video',
    supportsImageFirst: true,
    supportsImagesFirstLast: false, // PAS de last_image !
    supportedDurations: [5, 10],
    guidanceField: 'cfg_scale',
    guidanceDefault: 0.5,
    guidanceRange: [0, 1],
    lastImageField: null,
    costPerSecond: 0.08,
    description: 'Haute qualité, 1 image input uniquement',
  },
  // ----------------------------------------------------------
  // KLING v2.5 Turbo Pro - IMAGE FIRST + IMAGES FIRST AND LAST
  // Supporte last_image
  // ----------------------------------------------------------
  {
    id: 'kwaivgi/kling-v2.5-turbo-pro/image-to-video',
    displayName: 'kwaivgi/kling-v2.5-turbo-pro/image-to-video',
    supportsImageFirst: true,
    supportsImagesFirstLast: true, // Supporte last_image
    supportedDurations: [5, 10],
    guidanceField: 'guidance_scale',
    guidanceDefault: 0.5,
    guidanceRange: [0, 1],
    lastImageField: 'last_image',
    costPerSecond: 0.03,
    description: 'Rapide, supporte first+last frames',
  },
];

// ============================================================
// ASPECT RATIOS DISPONIBLES
// ============================================================

export const ASPECT_RATIOS = [
  { id: '1:1', label: '1:1', description: 'Carré' },
  { id: '3:2', label: '3:2', description: 'Photo classique' },
  { id: '2:3', label: '2:3', description: 'Portrait photo' },
  { id: '3:4', label: '3:4', description: 'Portrait TV' },
  { id: '4:3', label: '4:3', description: 'TV classique' },
  { id: '4:5', label: '4:5', description: 'Instagram' },
  { id: '5:4', label: '5:4', description: 'Paysage Instagram' },
  { id: '9:16', label: '9:16', description: 'Portrait mobile' },
  { id: '16:9', label: '16:9', description: 'Paysage HD' },
  { id: '21:9', label: '21:9', description: 'Cinémascope' },
] as const;

export type AspectRatio = typeof ASPECT_RATIOS[number]['id'];

// ============================================================
// RESOLUTIONS DISPONIBLES
// ============================================================

export const RESOLUTIONS = [
  { id: '4k', label: '4K', description: '~3840px' },
  { id: '8k', label: '8K', description: '~7680px' },
] as const;

export type Resolution = typeof RESOLUTIONS[number]['id'];

// ============================================================
// REASONING LEVELS (pour OpenAI o3)
// ============================================================

export const REASONING_LEVELS = [
  { id: 'low', label: 'low', description: 'Rapide' },
  { id: 'medium', label: 'medium', description: 'Équilibré' },
  { id: 'high', label: 'high', description: 'Précis' },
] as const;

export type ReasoningLevel = typeof REASONING_LEVELS[number]['id'];

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Récupère un modèle LLM par son ID
 */
export function getLLMModel(provider: LLMProvider, modelId: string): LLMModel | undefined {
  return LLM_MODELS[provider].find(m => m.id === modelId);
}

/**
 * Récupère un modèle T2I par son ID
 */
export function getT2IModel(modelId: string): ImageModel | undefined {
  return T2I_MODELS.find(m => m.id === modelId);
}

/**
 * Vérifie si un modèle T2I supporte les dimensions personnalisées
 */
export function t2iSupportsCustomDimensions(modelId: string): boolean {
  const model = getT2IModel(modelId);
  return model?.supportsCustomDimensions ?? false;
}

/**
 * Retourne les contraintes de dimensions pour un modèle T2I
 */
export function getT2IDimensionConstraints(modelId: string): { min: number; max: number } | null {
  const model = getT2IModel(modelId);
  if (!model?.supportsCustomDimensions) return null;
  return {
    min: model.minDimension ?? 1024,
    max: model.maxDimension ?? 4096,
  };
}

/**
 * Récupère un modèle I2I par son ID
 */
export function getI2IModel(modelId: string): ImageModel | undefined {
  return I2I_MODELS.find(m => m.id === modelId);
}

/**
 * Récupère un modèle vidéo par son ID
 */
export function getVideoModel(modelId: string): VideoModel | undefined {
  return VIDEO_MODELS.find(m => m.id === modelId);
}

/**
 * Filtre les modèles vidéo selon le mode
 */
export function getVideoModelsForMode(mode: 'image-first' | 'images-first-last'): VideoModel[] {
  if (mode === 'image-first') {
    return VIDEO_MODELS.filter(m => m.supportsImageFirst);
  }
  return VIDEO_MODELS.filter(m => m.supportsImagesFirstLast);
}

/**
 * Vérifie si un modèle LLM supporte le raisonnement
 */
export function modelSupportsReasoning(provider: LLMProvider, modelId: string): boolean {
  const model = getLLMModel(provider, modelId);
  return model?.supportsReasoning ?? false;
}

/**
 * Retourne le modèle par défaut pour chaque catégorie
 */
export const DEFAULT_MODELS = {
  llm: {
    provider: 'mistral' as LLMProvider,
    model: 'mistral-large-latest',
  },
  t2i: 'nano-banana-pro-ultra-wavespeed',
  i2i: 'nano-banana-pro-edit-ultra-wavespeed',
  video: 'kwaivgi/kling-v2.5-turbo-pro/image-to-video',
};
