/**
 * Creative Plan Settings - Configuration EXHAUSTIVE et PRÉCISE
 * 
 * Structure :
 * - TEST : génération rapide, petites dimensions fixes, modèles économiques
 *          → NE PAS TOUCHER - reste avec les dimensions en pixels
 * - PROD : génération haute qualité avec WaveSpeed
 *          → Utilise aspect_ratio + resolution (4k/8k) directement
 * 
 * IMPORTANT: WaveSpeed Nano Banana Pro accepte:
 * - aspect_ratio: '1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'
 * - resolution: '4k' ou '8k'
 */

// ========== TYPES ==========

/** Dimensions en pixels (pour TEST uniquement) */
export interface Dimensions {
  width: number;
  height: number;
}

/** Aspect ratios supportés par WaveSpeed */
export type WaveSpeedAspectRatio = '1:1' | '3:2' | '2:3' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9';

/** Résolutions supportées par WaveSpeed */
export type WaveSpeedResolution = '4k' | '8k';

/** Mode de génération de frames pour les vidéos */
export type FrameMode = 'first-last' | 'first-only';

/** Specs pour le mode TEST (dimensions en pixels) - NE PAS MODIFIER */
export interface TestModeSpecs {
  // === MODÈLES ===
  textToImageModel: string;
  editModel: string;
  videoModel: string;
  videoDuration: number;
  
  // === MODE FRAME (first-last ou first-only) ===
  frameMode: FrameMode;

  // === DIMENSIONS PERSONNAGES (en pixels) ===
  characterPrimary: Dimensions;
  characterFace: Dimensions;
  characterProfile: Dimensions;
  characterBack: Dimensions;

  // === DIMENSIONS DÉCORS (en pixels) ===
  decorPrimary: Dimensions;
  decorAngle2: Dimensions;
  decorPlongee: Dimensions;
  decorContrePlongee: Dimensions;

  // === DIMENSIONS PLANS (en pixels) ===
  planFirst: Dimensions;
  planLast: Dimensions;

  // === DIMENSIONS VIDÉO (en pixels) ===
  videoDimensions: Dimensions;
}

/** Specs pour le mode PROD (aspect_ratio + resolution pour WaveSpeed) */
export interface ProdModeSpecs {
  // === MODÈLES (fixes pour PROD) ===
  // Text-to-Image: Google Nano Banana Pro Text To Image Ultra
  // Edit: Google Nano Banana Pro Edit Ultra
  textToImageModel: string;
  editModel: string;
  videoModel: string;
  videoDuration: number;
  
  // === MODE FRAME (first-last ou first-only) ===
  frameMode: FrameMode;

  // === RÉSOLUTION GLOBALE ===
  resolution: WaveSpeedResolution;

  // === ASPECT RATIOS PERSONNAGES ===
  characterPrimaryRatio: WaveSpeedAspectRatio;
  characterFaceRatio: WaveSpeedAspectRatio;
  characterProfileRatio: WaveSpeedAspectRatio;
  characterBackRatio: WaveSpeedAspectRatio;

  // === ASPECT RATIOS DÉCORS ===
  decorPrimaryRatio: WaveSpeedAspectRatio;
  decorAngle2Ratio: WaveSpeedAspectRatio;
  decorPlongeeRatio: WaveSpeedAspectRatio;
  decorContrePlongeeRatio: WaveSpeedAspectRatio;

  // === ASPECT RATIOS PLANS ===
  planFirstRatio: WaveSpeedAspectRatio;
  planLastRatio: WaveSpeedAspectRatio;

  // === ASPECT RATIO VIDÉO ===
  videoRatio: WaveSpeedAspectRatio;
}

// Alias pour compatibilité (utiliser TestModeSpecs pour test, ProdModeSpecs pour prod)
export type ModeSpecs = TestModeSpecs;

export interface CreativePlanSettings {
  test: TestModeSpecs;
  prod: ProdModeSpecs;
}

// ========== VALEURS PAR DÉFAUT ==========

export const DEFAULT_CREATIVE_PLAN_SETTINGS: CreativePlanSettings = {
  // ============================================
  // MODE TEST - Rapide, économique, petites images
  // NE PAS MODIFIER - gardé tel quel avec dimensions en pixels
  // ============================================
  test: {
    // Modèles économiques
    textToImageModel: 'google/nano-banana/text-to-image',
    editModel: 'google/nano-banana/edit',
    videoModel: 'kwaivgi/kling-v2.6-pro/image-to-video',
    videoDuration: 5,
    
    // Mode frame: first-only (kling-v2.6-pro ne supporte pas last_image)
    frameMode: 'first-only',

    // Personnages - petites dimensions
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
  // MODE PROD - Haute qualité avec WaveSpeed
  // Utilise aspect_ratio + resolution (pas de dimensions)
  // ============================================
  prod: {
    // Modèles FIXES pour PROD (affichés mais non modifiables)
    // → Google Nano Banana Pro Text To Image Ultra
    // → Google Nano Banana Pro Edit Ultra
    textToImageModel: 'google/nano-banana-pro/text-to-image-ultra',
    editModel: 'google/nano-banana-pro/edit-ultra',
    videoModel: 'kwaivgi/kling-v2.5-turbo-pro/image-to-video',
    videoDuration: 10,
    
    // Mode frame par défaut: first+last (utilise last_image)
    frameMode: 'first-last',

    // Résolution globale (4k par défaut, 8k disponible)
    resolution: '4k',

    // Aspect ratios personnages
    characterPrimaryRatio: '9:16',    // Portrait (plein corps)
    characterFaceRatio: '1:1',        // Carré (visage)
    characterProfileRatio: '1:1',     // Carré (profil)
    characterBackRatio: '9:16',       // Portrait (dos)

    // Aspect ratios décors
    decorPrimaryRatio: '16:9',        // Paysage
    decorAngle2Ratio: '16:9',
    decorPlongeeRatio: '16:9',
    decorContrePlongeeRatio: '16:9',

    // Aspect ratios plans (first/last frame pour vidéo)
    planFirstRatio: '21:9',           // Cinémascope
    planLastRatio: '21:9',            // Cinémascope

    // Aspect ratio vidéo
    videoRatio: '16:9',
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

/** Retourne les specs TEST */
export function getTestModeSpecs(): TestModeSpecs {
  const settings = loadCreativePlanSettings();
  return settings.test;
}

/** Retourne les specs PROD */
export function getProdModeSpecs(): ProdModeSpecs {
  const settings = loadCreativePlanSettings();
  return settings.prod;
}

/** Retourne les specs pour le mode choisi (compatibilité) */
export function getModeSpecs(quality: 'elevee' | 'normal'): TestModeSpecs {
  // Note: retourne toujours TestModeSpecs pour compatibilité
  // Pour PROD, utiliser getProdModeSpecs() directement
  const settings = loadCreativePlanSettings();
  return settings.test;
}

// ========== FONCTIONS DE COMPATIBILITÉ (pour brief-defaults.ts) ==========

/**
 * Retourne les settings image pour le mode choisi
 */
export function getImageSettings(quality: 'elevee' | 'normal') {
  const settings = loadCreativePlanSettings();
  
  if (quality === 'elevee') {
    const prod = settings.prod;
    return {
      textToImage: {
        model: prod.textToImageModel,
        resolution: prod.resolution,
      },
      edit: {
        model: prod.editModel,
        resolution: prod.resolution,
      },
    };
  } else {
    const test = settings.test;
    return {
      textToImage: {
        model: test.textToImageModel,
        resolution: '', // Pas de résolution pour TEST
      },
      edit: {
        model: test.editModel,
        resolution: '',
      },
    };
  }
}

/**
 * Retourne les aspect ratios configurés pour PROD
 * Utilisé par brief-defaults.ts et brief-canvas-generator.ts
 */
export function getAspectRatios() {
  const settings = loadCreativePlanSettings();
  const prod = settings.prod;
  
  return {
    character: {
      primary: prod.characterPrimaryRatio,
      face: prod.characterFaceRatio,
      profile: prod.characterProfileRatio,
      back: prod.characterBackRatio,
    },
    decor: {
      primary: prod.decorPrimaryRatio,
      angle2: prod.decorAngle2Ratio,
      plongee: prod.decorPlongeeRatio,
      contrePlongee: prod.decorContrePlongeeRatio,
    },
    plan: {
      depart: prod.planFirstRatio,
      fin: prod.planLastRatio,
    },
  };
}

/** Calcule l'aspect ratio depuis les dimensions (pour TEST uniquement) */
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

// ========== ASPECT RATIOS DISPONIBLES (WaveSpeed) ==========

export const AVAILABLE_ASPECT_RATIOS: { id: WaveSpeedAspectRatio; label: string; usage: string }[] = [
  { id: '1:1', label: '1:1 (Carré)', usage: 'Visages, profils' },
  { id: '9:16', label: '9:16 (Portrait)', usage: 'Personnages plein corps' },
  { id: '16:9', label: '16:9 (Paysage)', usage: 'Décors' },
  { id: '21:9', label: '21:9 (Cinémascope)', usage: 'First/Last frames' },
  { id: '3:2', label: '3:2', usage: 'Photo classique' },
  { id: '2:3', label: '2:3', usage: 'Portrait photo' },
  { id: '4:3', label: '4:3', usage: 'TV classique' },
  { id: '3:4', label: '3:4', usage: 'Portrait TV' },
  { id: '4:5', label: '4:5', usage: 'Instagram' },
  { id: '5:4', label: '5:4', usage: 'Paysage Instagram' },
];

// ========== RÉSOLUTIONS DISPONIBLES (WaveSpeed) ==========

export const AVAILABLE_RESOLUTIONS: { id: WaveSpeedResolution; label: string; description: string }[] = [
  { id: '4k', label: '4K', description: 'Haute qualité (recommandé) - $0.15/image' },
  { id: '8k', label: '8K', description: 'Ultra haute qualité - $0.18/image' },
];

// ========== MODÈLES DISPONIBLES ==========

// Pour mode TEST uniquement
export const AVAILABLE_TEXT_TO_IMAGE_MODELS = [
  { id: 'google/nano-banana/text-to-image', name: 'Nano Banana', tier: 'test', costPer1k: 0.01 },
  { id: 'google/nano-banana-pro/text-to-image', name: 'Nano Banana Pro', tier: 'standard', costPer1k: 0.015 },
  { id: 'google/nano-banana-pro/text-to-image-ultra', name: 'Nano Banana Pro Ultra', tier: 'premium', costPer1k: 0.02 },
];

// Pour mode TEST uniquement
export const AVAILABLE_EDIT_MODELS = [
  { id: 'google/nano-banana/edit', name: 'Nano Banana Edit', tier: 'test', costPer1k: 0.012 },
  { id: 'google/nano-banana-pro/edit', name: 'Nano Banana Pro Edit', tier: 'standard', costPer1k: 0.018 },
  { id: 'google/nano-banana-pro/edit-ultra', name: 'Nano Banana Pro Edit Ultra', tier: 'premium', costPer1k: 0.025 },
];

export const AVAILABLE_VIDEO_MODELS = [
  // ========== MODE FIRST FRAME ONLY (1 image input) ==========
  // IDs = vrais endpoints WaveSpeed
  { 
    id: 'kwaivgi/kling-v2.6-pro/image-to-video', 
    name: 'Kling v2.6 Pro (First Only)', 
    tier: 'pro', 
    costPerSec: 0.08, 
    supportsFirstLast: false,  // PAS de last_image
    supportsFirstOnly: true,
  },
  
  // ========== MODE FIRST + LAST FRAMES (2 images input) ==========
  { 
    id: 'kwaivgi/kling-v2.5-turbo-pro/image-to-video', 
    name: 'Kling v2.5 Turbo Pro (First+Last)', 
    tier: 'pro', 
    costPerSec: 0.03, 
    supportsFirstLast: true,   // SUPPORTE last_image
    supportsFirstOnly: true,   // Peut aussi fonctionner avec 1 image
  },
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
