/**
 * Creative Plan Settings - Configuration EXHAUSTIVE et PRÉCISE
 * 
 * Structure :
 * - TEST : génération rapide, petites dimensions, modèles économiques
 * - PROD : génération haute qualité, grandes dimensions, modèles premium
 * 
 * Chaque mode contient :
 * - 1 seul modèle Text-to-Image
 * - 1 seul modèle Edit (variantes)
 * - 1 seul modèle Vidéo
 * - Dimensions EXACTES en pixels pour chaque type d'image
 */

// ========== TYPES ==========

/** Dimensions en pixels */
export interface Dimensions {
  width: number;
  height: number;
}

/** Specs pour un mode (TEST ou PROD) */
export interface ModeSpecs {
  // === MODÈLES ===
  /** Modèle Text-to-Image pour les images primaires */
  textToImageModel: string;
  /** Modèle Edit pour les variantes et compositions */
  editModel: string;
  /** Modèle Vidéo */
  videoModel: string;
  /** Durée vidéo en secondes */
  videoDuration: number;

  // === DIMENSIONS PERSONNAGES ===
  /** Image primaire personnage (full body) */
  characterPrimary: Dimensions;
  /** Visage de face */
  characterFace: Dimensions;
  /** Visage de profil */
  characterProfile: Dimensions;
  /** Vue de dos */
  characterBack: Dimensions;

  // === DIMENSIONS DÉCORS ===
  /** Vue principale du décor */
  decorPrimary: Dimensions;
  /** Angle alternatif */
  decorAngle2: Dimensions;
  /** Vue plongée (top-down) */
  decorPlongee: Dimensions;
  /** Vue contre-plongée */
  decorContrePlongee: Dimensions;

  // === DIMENSIONS PLANS ===
  /** First frame (image de départ) */
  planFirst: Dimensions;
  /** Last frame (image de fin) */
  planLast: Dimensions;

  // === DIMENSIONS VIDÉO ===
  /** Résolution vidéo */
  videoDimensions: Dimensions;
}

export interface CreativePlanSettings {
  test: ModeSpecs;
  prod: ModeSpecs;
}

// ========== VALEURS PAR DÉFAUT ==========

export const DEFAULT_CREATIVE_PLAN_SETTINGS: CreativePlanSettings = {
  // ============================================
  // MODE TEST - Rapide, économique, petites images
  // ============================================
  test: {
    // Modèles économiques
    textToImageModel: 'google/nano-banana/text-to-image',
    editModel: 'google/nano-banana/edit',
    videoModel: 'kling-v2.5-turbo',
    videoDuration: 5,

    // Personnages - petites dimensions carrées
    characterPrimary: { width: 256, height: 384 },   // Portrait
    characterFace: { width: 256, height: 256 },      // Carré
    characterProfile: { width: 256, height: 256 },   // Carré
    characterBack: { width: 256, height: 384 },      // Portrait

    // Décors - petites dimensions paysage
    decorPrimary: { width: 384, height: 256 },       // Paysage
    decorAngle2: { width: 384, height: 256 },
    decorPlongee: { width: 384, height: 256 },
    decorContrePlongee: { width: 384, height: 256 },

    // Plans - cinémascope petit
    planFirst: { width: 512, height: 220 },          // ~21:9
    planLast: { width: 512, height: 220 },

    // Vidéo - basse résolution
    videoDimensions: { width: 512, height: 288 },    // 16:9 petit
  },

  // ============================================
  // MODE PROD - Haute qualité, grandes dimensions
  // ============================================
  prod: {
    // Modèles premium
    textToImageModel: 'google/nano-banana-pro/text-to-image-ultra',
    editModel: 'google/nano-banana-pro/edit-ultra',
    videoModel: 'kling-v2.1-start-end',
    videoDuration: 10,

    // Personnages - haute résolution
    characterPrimary: { width: 768, height: 1344 },  // 9:16 (portrait)
    characterFace: { width: 1024, height: 1024 },    // 1:1 (carré)
    characterProfile: { width: 1024, height: 1024 }, // 1:1 (carré)
    characterBack: { width: 768, height: 1344 },     // 9:16 (portrait)

    // Décors - haute résolution paysage
    decorPrimary: { width: 1344, height: 768 },      // 16:9
    decorAngle2: { width: 1344, height: 768 },
    decorPlongee: { width: 1344, height: 768 },
    decorContrePlongee: { width: 1344, height: 768 },

    // Plans - cinémascope haute résolution
    planFirst: { width: 1536, height: 640 },         // ~21:9 (cinémascope)
    planLast: { width: 1536, height: 640 },

    // Vidéo - haute résolution
    videoDimensions: { width: 1920, height: 1080 },  // Full HD
  },
};

// ========== STORAGE ==========

const STORAGE_KEY = 'tersa_creative_plan_settings_v2'; // v2 pour la nouvelle structure

export function loadCreativePlanSettings(): CreativePlanSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_CREATIVE_PLAN_SETTINGS;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<CreativePlanSettings>;
      return deepMerge(DEFAULT_CREATIVE_PLAN_SETTINGS, parsed);
    }
  } catch (error) {
    console.error('[CreativePlanSettings] Erreur lecture:', error);
  }

  return DEFAULT_CREATIVE_PLAN_SETTINGS;
}

export function saveCreativePlanSettings(settings: CreativePlanSettings): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    console.log('[CreativePlanSettings] Sauvegardé');
  } catch (error) {
    console.error('[CreativePlanSettings] Erreur sauvegarde:', error);
  }
}

export function resetCreativePlanSettings(): CreativePlanSettings {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
  return DEFAULT_CREATIVE_PLAN_SETTINGS;
}

// ========== HELPERS ==========

function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const output = { ...target };

  for (const key in source) {
    if (source[key] !== undefined) {
      if (
        typeof source[key] === 'object' &&
        source[key] !== null &&
        !Array.isArray(source[key])
      ) {
        output[key] = deepMerge(
          target[key] as Record<string, any>,
          source[key] as Record<string, any>
        ) as T[Extract<keyof T, string>];
      } else {
        output[key] = source[key] as T[Extract<keyof T, string>];
      }
    }
  }

  return output;
}

/** Retourne les specs pour le mode choisi */
export function getModeSpecs(quality: 'elevee' | 'normal'): ModeSpecs {
  const settings = loadCreativePlanSettings();
  return quality === 'elevee' ? settings.prod : settings.test;
}

// ========== FONCTIONS DE COMPATIBILITÉ (pour brief-defaults.ts) ==========

/**
 * Retourne les settings image pour le mode choisi
 * Compatible avec l'ancienne API
 */
export function getImageSettings(quality: 'elevee' | 'normal') {
  const specs = getModeSpecs(quality);
  return {
    textToImage: {
      model: specs.textToImageModel,
      resolution: quality === 'elevee' ? '4K' : '',
    },
    edit: {
      model: specs.editModel,
      resolution: quality === 'elevee' ? '4K' : '',
    },
  };
}

/**
 * Retourne les aspect ratios configurés
 * Compatible avec l'ancienne API - calcule depuis les dimensions
 */
export function getAspectRatios() {
  const settings = loadCreativePlanSettings();
  // Utiliser les dimensions PROD pour calculer les ratios
  const prod = settings.prod;
  
  return {
    character: {
      primary: getAspectRatioFromDimensions(prod.characterPrimary),
      face: getAspectRatioFromDimensions(prod.characterFace),
      profile: getAspectRatioFromDimensions(prod.characterProfile),
      back: getAspectRatioFromDimensions(prod.characterBack),
    },
    decor: {
      primary: getAspectRatioFromDimensions(prod.decorPrimary),
      angle2: getAspectRatioFromDimensions(prod.decorAngle2),
      plongee: getAspectRatioFromDimensions(prod.decorPlongee),
      contrePlongee: getAspectRatioFromDimensions(prod.decorContrePlongee),
    },
    plan: {
      depart: getAspectRatioFromDimensions(prod.planFirst),
      fin: getAspectRatioFromDimensions(prod.planLast),
    },
  };
}

/** Calcule l'aspect ratio depuis les dimensions */
export function getAspectRatioFromDimensions(dims: Dimensions): string {
  const ratio = dims.width / dims.height;
  if (Math.abs(ratio - 1) < 0.1) return '1:1';
  if (Math.abs(ratio - 16 / 9) < 0.1) return '16:9';
  if (Math.abs(ratio - 9 / 16) < 0.1) return '9:16';
  if (Math.abs(ratio - 21 / 9) < 0.15) return '21:9';
  if (Math.abs(ratio - 4 / 3) < 0.1) return '4:3';
  if (Math.abs(ratio - 3 / 4) < 0.1) return '3:4';
  return `${dims.width}:${dims.height}`;
}

// ========== MODÈLES DISPONIBLES ==========

export const AVAILABLE_TEXT_TO_IMAGE_MODELS = [
  { id: 'google/nano-banana/text-to-image', name: 'Nano Banana', tier: 'test', costPer1k: 0.01 },
  { id: 'google/nano-banana-pro/text-to-image', name: 'Nano Banana Pro', tier: 'standard', costPer1k: 0.015 },
  { id: 'google/nano-banana-pro/text-to-image-ultra', name: 'Nano Banana Pro Ultra', tier: 'premium', costPer1k: 0.02 },
  { id: 'google/imagen3-fast', name: 'Imagen 3 Fast', tier: 'standard', costPer1k: 0.02 },
  { id: 'google/imagen3', name: 'Imagen 3', tier: 'premium', costPer1k: 0.04 },
  { id: 'google/imagen4-fast', name: 'Imagen 4 Fast', tier: 'standard', costPer1k: 0.03 },
  { id: 'google/imagen4', name: 'Imagen 4', tier: 'premium', costPer1k: 0.05 },
  { id: 'google/imagen4-ultra', name: 'Imagen 4 Ultra', tier: 'ultra', costPer1k: 0.08 },
];

export const AVAILABLE_EDIT_MODELS = [
  { id: 'google/nano-banana/edit', name: 'Nano Banana Edit', tier: 'test', costPer1k: 0.012 },
  { id: 'google/nano-banana-pro/edit', name: 'Nano Banana Pro Edit', tier: 'standard', costPer1k: 0.018 },
  { id: 'google/nano-banana-pro/edit-ultra', name: 'Nano Banana Pro Edit Ultra', tier: 'premium', costPer1k: 0.025 },
];

export const AVAILABLE_VIDEO_MODELS = [
  { id: 'kling-v2.5-turbo', name: 'Kling v2.5 Turbo', tier: 'test', costPerSec: 0.02, supportsStartEnd: false },
  { id: 'kling-v2.5-pro', name: 'Kling v2.5 Pro', tier: 'standard', costPerSec: 0.05, supportsStartEnd: false },
  { id: 'kling-v2.1-start-end', name: 'Kling v2.1 Start-End', tier: 'premium', costPerSec: 0.08, supportsStartEnd: true },
  { id: 'kling-v2.6-pro-i2v', name: 'Kling v2.6 Pro I2V', tier: 'ultra', costPerSec: 0.10, supportsStartEnd: false },
  { id: 'wan-2.1', name: 'WAN 2.1', tier: 'test', costPerSec: 0.03, supportsStartEnd: false },
  { id: 'wan-2.1-pro', name: 'WAN 2.1 Pro', tier: 'standard', costPerSec: 0.06, supportsStartEnd: false },
];

// ========== PRESETS DE DIMENSIONS ==========

export const DIMENSION_PRESETS = {
  // Carrés
  square_small: { width: 256, height: 256, label: '256×256 (carré petit)' },
  square_medium: { width: 512, height: 512, label: '512×512 (carré moyen)' },
  square_large: { width: 1024, height: 1024, label: '1024×1024 (carré grand)' },
  
  // Portrait (9:16)
  portrait_small: { width: 256, height: 456, label: '256×456 (portrait petit)' },
  portrait_medium: { width: 576, height: 1024, label: '576×1024 (portrait moyen)' },
  portrait_large: { width: 768, height: 1344, label: '768×1344 (portrait grand)' },
  
  // Paysage (16:9)
  landscape_small: { width: 456, height: 256, label: '456×256 (paysage petit)' },
  landscape_medium: { width: 1024, height: 576, label: '1024×576 (paysage moyen)' },
  landscape_large: { width: 1344, height: 768, label: '1344×768 (paysage grand)' },
  landscape_hd: { width: 1920, height: 1080, label: '1920×1080 (Full HD)' },
  
  // Cinémascope (21:9)
  cinema_small: { width: 512, height: 220, label: '512×220 (ciné petit)' },
  cinema_medium: { width: 1024, height: 439, label: '1024×439 (ciné moyen)' },
  cinema_large: { width: 1536, height: 640, label: '1536×640 (ciné grand)' },
  cinema_ultra: { width: 2560, height: 1080, label: '2560×1080 (ciné ultra)' },
};
