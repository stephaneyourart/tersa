/**
 * CONFIGURATION DE GÉNÉRATION DE PROJET
 * 
 * Types et interfaces pour la configuration complète de génération.
 * Utilisé par la page de génération et les presets.
 */

import type { 
  LLMProvider, 
  AspectRatio, 
  Resolution, 
  ReasoningLevel 
} from './models-registry';

// ============================================================
// TYPES PRINCIPAUX
// ============================================================

/**
 * Configuration LLM
 */
export interface LLMConfig {
  /** Provider: openai ou mistral */
  provider: LLMProvider;
  /** ID du modèle (nom réel) */
  model: string;
  /** Niveau de raisonnement (uniquement pour les modèles qui le supportent) */
  reasoningLevel?: ReasoningLevel;
}

/**
 * Configuration Text-to-Image pour un type d'entité (personnages ou décors)
 */
export interface T2IEntityConfig {
  /** Aspect ratio */
  aspectRatio: AspectRatio;
  /** Résolution */
  resolution: Resolution;
}

/**
 * Configuration Text-to-Image (images primaires)
 * Séparée entre personnages et décors pour permettre des ratios différents
 */
export interface T2IConfig {
  /** ID du modèle (endpoint WaveSpeed réel) - commun aux personnages et décors */
  model: string;
  /** Configuration pour les personnages */
  character: T2IEntityConfig;
  /** Configuration pour les décors */
  decor: T2IEntityConfig;
}

/**
 * Configuration Image-to-Image (first/last frames)
 */
export interface I2IConfig {
  /** ID du modèle (endpoint WaveSpeed réel) */
  model: string;
  /** Aspect ratio */
  aspectRatio: AspectRatio;
  /** Résolution */
  resolution: Resolution;
}

/**
 * Mode de génération vidéo
 */
export type VideoMode = 'image-first' | 'images-first-last';

/**
 * Configuration Vidéo
 */
export interface VideoConfig {
  /** Mode: 1 image ou 2 images en input */
  mode: VideoMode;
  /** ID du modèle (endpoint WaveSpeed réel) */
  model: string;
  /** Durée en secondes */
  duration: 5 | 10;
  /** Valeur du guidance/cfg_scale */
  guidanceValue: number;
}

/**
 * Configuration des quantités
 */
export interface QuantitiesConfig {
  /** Nombre de plans à générer */
  plansCount: number;
  /** Générer les images secondaires (I2I) ? */
  generateSecondaryImages: boolean;
  /** Utiliser l'image primaire comme first frame (skip I2I pour first frame) */
  firstFrameIsPrimary: boolean;
  /** Nombre de jeux d'images input par plan */
  imageSetsPerPlan: number;
  /** Nombre de vidéos par jeu d'images */
  videosPerImageSet: number;
}

/**
 * Configuration complète de génération
 */
export interface GenerationConfig {
  /** Configuration LLM */
  llm: LLMConfig;
  /** Configuration Text-to-Image */
  t2i: T2IConfig;
  /** Configuration Image-to-Image */
  i2i: I2IConfig;
  /** Configuration Vidéo */
  video: VideoConfig;
  /** Configuration des quantités */
  quantities: QuantitiesConfig;
  /** System prompt personnalisé */
  systemPrompt?: string;
  /** Instructions supplémentaires */
  customInstructions?: string;
}

// ============================================================
// VALEURS PAR DÉFAUT
// ============================================================

export const DEFAULT_LLM_CONFIG: LLMConfig = {
  provider: 'mistral',
  model: 'mistral-large-latest',
  reasoningLevel: undefined,
};

export const DEFAULT_T2I_CONFIG: T2IConfig = {
  model: 'nano-banana-pro-ultra-wavespeed',
  character: {
    aspectRatio: '9:16',  // Portrait pour personnages (pied à la tête)
    resolution: '4k',
  },
  decor: {
    aspectRatio: '16:9',  // Paysage pour décors
    resolution: '4k',
  },
};

export const DEFAULT_I2I_CONFIG: I2IConfig = {
  model: 'nano-banana-pro-edit-ultra-wavespeed',
  aspectRatio: '21:9',
  resolution: '4k',
};

export const DEFAULT_VIDEO_CONFIG: VideoConfig = {
  mode: 'images-first-last',
  model: 'kwaivgi/kling-v2.5-turbo-pro/image-to-video',
  duration: 10,
  guidanceValue: 0.5,
};

export const DEFAULT_QUANTITIES_CONFIG: QuantitiesConfig = {
  plansCount: 6,
  generateSecondaryImages: true,
  firstFrameIsPrimary: false,
  imageSetsPerPlan: 1,
  videosPerImageSet: 2,
};

export const DEFAULT_GENERATION_CONFIG: GenerationConfig = {
  llm: DEFAULT_LLM_CONFIG,
  t2i: DEFAULT_T2I_CONFIG,
  i2i: DEFAULT_I2I_CONFIG,
  video: DEFAULT_VIDEO_CONFIG,
  quantities: DEFAULT_QUANTITIES_CONFIG,
  systemPrompt: undefined,
  customInstructions: undefined,
};

// ============================================================
// STORAGE
// ============================================================

const STORAGE_KEY = 'tersa_generation_config_v1';

/**
 * Charge la configuration depuis localStorage
 */
export function loadGenerationConfig(): GenerationConfig {
  if (typeof window === 'undefined') {
    return DEFAULT_GENERATION_CONFIG;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<GenerationConfig>;
      return mergeConfig(DEFAULT_GENERATION_CONFIG, parsed);
    }
  } catch (error) {
    console.error('[GenerationConfig] Erreur lecture:', error);
  }

  return DEFAULT_GENERATION_CONFIG;
}

/**
 * Sauvegarde la configuration dans localStorage
 */
export function saveGenerationConfig(config: GenerationConfig): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    console.log('[GenerationConfig] Sauvegardé');
  } catch (error) {
    console.error('[GenerationConfig] Erreur sauvegarde:', error);
  }
}

/**
 * Réinitialise la configuration aux valeurs par défaut
 */
export function resetGenerationConfig(): GenerationConfig {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
  return DEFAULT_GENERATION_CONFIG;
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Fusionne une configuration partielle avec les valeurs par défaut
 */
function mergeConfig(
  defaults: GenerationConfig, 
  partial: Partial<GenerationConfig>
): GenerationConfig {
  return {
    llm: { ...defaults.llm, ...partial.llm },
    t2i: { 
      model: partial.t2i?.model ?? defaults.t2i.model,
      character: { ...defaults.t2i.character, ...partial.t2i?.character },
      decor: { ...defaults.t2i.decor, ...partial.t2i?.decor },
    },
    i2i: { ...defaults.i2i, ...partial.i2i },
    video: { ...defaults.video, ...partial.video },
    quantities: { ...defaults.quantities, ...partial.quantities },
    systemPrompt: partial.systemPrompt ?? defaults.systemPrompt,
    customInstructions: partial.customInstructions ?? defaults.customInstructions,
  };
}

/**
 * Valide une configuration complète
 */
export function validateConfig(config: GenerationConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validation LLM
  if (!config.llm.provider) {
    errors.push('Provider LLM requis');
  }
  if (!config.llm.model) {
    errors.push('Modèle LLM requis');
  }

  // Validation T2I
  if (!config.t2i.model) {
    errors.push('Modèle T2I requis');
  }
  if (!config.t2i.character?.aspectRatio) {
    errors.push('Aspect ratio T2I personnages requis');
  }
  if (!config.t2i.decor?.aspectRatio) {
    errors.push('Aspect ratio T2I décors requis');
  }

  // Validation I2I
  if (!config.i2i.model) {
    errors.push('Modèle I2I requis');
  }

  // Validation Vidéo
  if (!config.video.model) {
    errors.push('Modèle vidéo requis');
  }
  if (![5, 10].includes(config.video.duration)) {
    errors.push('Durée vidéo doit être 5 ou 10 secondes');
  }

  // Validation Quantités
  if (config.quantities.plansCount < 1 || config.quantities.plansCount > 50) {
    errors.push('Nombre de plans doit être entre 1 et 50');
  }
  if (config.quantities.imageSetsPerPlan < 1 || config.quantities.imageSetsPerPlan > 10) {
    errors.push('Nombre de jeux d\'images doit être entre 1 et 10');
  }
  if (config.quantities.videosPerImageSet < 1 || config.quantities.videosPerImageSet > 10) {
    errors.push('Nombre de vidéos par jeu doit être entre 1 et 10');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Convertit la config vers le format legacy utilisé par l'API
 */
export function configToLegacyFormat(config: GenerationConfig): Record<string, unknown> {
  return {
    aiModel: config.llm.model,
    llmProvider: config.llm.provider,
    reasoningLevel: config.llm.reasoningLevel || 'medium',
    systemPrompt: config.systemPrompt,
    customInstructions: config.customInstructions,
    quality: 'elevee', // Toujours élevée avec le nouveau système
    settings: {
      testMode: false,
      frameMode: config.video.mode === 'image-first' ? 'first-only' : 'first-last',
      videoModel: config.video.model,
      imageModel: config.t2i.model,
      editModel: config.i2i.model,
      videoDuration: config.video.duration,
      videoAspectRatio: config.i2i.aspectRatio, // Vidéo hérite du ratio I2I
      couplesPerPlan: config.quantities.imageSetsPerPlan,
      videosPerCouple: config.quantities.videosPerImageSet,
      resolution: config.t2i.character.resolution, // Utilise la résolution personnage par défaut
      // NOUVEAU: Ratios T2I par type d'entité
      t2iCharacterAspectRatio: config.t2i.character.aspectRatio,
      t2iCharacterResolution: config.t2i.character.resolution,
      t2iDecorAspectRatio: config.t2i.decor.aspectRatio,
      t2iDecorResolution: config.t2i.decor.resolution,
      // Nouvelles options
      generateSecondaryImages: config.quantities.generateSecondaryImages,
      firstFrameIsPrimary: config.quantities.firstFrameIsPrimary,
    },
  };
}
