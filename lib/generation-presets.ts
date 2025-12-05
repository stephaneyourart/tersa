/**
 * GESTION DES PRESETS DE GÉNÉRATION
 * 
 * CRUD complet pour les presets.
 * Stockage HYBRIDE: localStorage + API serveur (fichier local)
 * Un preset = une configuration complète de génération nommée.
 */

import type { GenerationConfig } from './generation-config';
import { DEFAULT_GENERATION_CONFIG } from './generation-config';

// ============================================================
// TYPES
// ============================================================

export interface GenerationPreset {
  /** ID unique du preset */
  id: string;
  /** Nom du preset (affiché dans l'UI) */
  name: string;
  /** Description optionnelle */
  description?: string;
  /** Configuration complète */
  config: GenerationConfig;
  /** Date de création */
  createdAt: string;
  /** Date de dernière modification */
  updatedAt: string;
  /** Est-ce un preset par défaut (non supprimable) */
  isBuiltIn: boolean;
}

// ============================================================
// PRESETS PAR DÉFAUT
// ============================================================

const BUILT_IN_PRESETS: GenerationPreset[] = [
  {
    id: 'default-production',
    name: 'Production 4K',
    description: 'Configuration haute qualité pour la production',
    config: {
      ...DEFAULT_GENERATION_CONFIG,
      llm: {
        provider: 'mistral',
        model: 'mistral-large-latest',
      },
      t2i: {
        model: 'wavespeed/google/nano-banana-pro/text-to-image-ultra',
        aspectRatio: '16:9',
        resolution: '4k',
      },
      i2i: {
        model: 'wavespeed/google/nano-banana-pro/edit-ultra',
        aspectRatio: '21:9',
        resolution: '4k',
      },
      video: {
        mode: 'images-first-last',
        model: 'kwaivgi/kling-v2.5-turbo-pro/image-to-video',
        duration: 10,
        guidanceValue: 0.5,
      },
      quantities: {
        ...DEFAULT_GENERATION_CONFIG.quantities,
        plansCount: 6,
        imageSetsPerPlan: 1,
        videosPerImageSet: 2,
      },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isBuiltIn: true,
  },
  {
    id: 'default-test',
    name: 'Test Rapide',
    description: 'Configuration économique pour les tests',
    config: {
      ...DEFAULT_GENERATION_CONFIG,
      llm: {
        provider: 'mistral',
        model: 'mistral-small-latest',
      },
      t2i: {
        model: 'wavespeed/google/nano-banana/text-to-image',
        aspectRatio: '16:9',
        resolution: '4k',
      },
      i2i: {
        model: 'wavespeed/google/nano-banana/edit',
        aspectRatio: '21:9',
        resolution: '4k',
      },
      video: {
        mode: 'image-first',
        model: 'kwaivgi/kling-v2.6-pro/image-to-video',
        duration: 5,
        guidanceValue: 0.5,
      },
      quantities: {
        ...DEFAULT_GENERATION_CONFIG.quantities,
        plansCount: 2,
        imageSetsPerPlan: 1,
        videosPerImageSet: 1,
      },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isBuiltIn: true,
  },
  {
    id: 'default-video-first-last',
    name: 'Vidéo First+Last (Kling 2.5)',
    description: 'Mode 2 images pour interpolation vidéo',
    config: {
      ...DEFAULT_GENERATION_CONFIG,
      video: {
        mode: 'images-first-last',
        model: 'kwaivgi/kling-v2.5-turbo-pro/image-to-video',
        duration: 10,
        guidanceValue: 0.5,
      },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isBuiltIn: true,
  },
];

// ============================================================
// STORAGE KEYS
// ============================================================

const STORAGE_KEY = 'tersa_generation_presets_v1';
const CURRENT_PRESET_KEY = 'tersa_current_preset_id';

// Cache mémoire pour les presets chargés depuis l'API
let cachedServerPresets: GenerationPreset[] | null = null;
let cachedCurrentPresetId: string | null = null;

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Génère un ID unique pour un nouveau preset
 */
function generatePresetId(): string {
  return `preset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Fusionne un config de preset avec les valeurs par défaut
 * pour s'assurer que tous les champs existent (migrations)
 */
function mergeWithDefaults(config: GenerationConfig): GenerationConfig {
  return {
    ...DEFAULT_GENERATION_CONFIG,
    ...config,
    llm: { ...DEFAULT_GENERATION_CONFIG.llm, ...config.llm },
    t2i: { ...DEFAULT_GENERATION_CONFIG.t2i, ...config.t2i },
    i2i: { ...DEFAULT_GENERATION_CONFIG.i2i, ...config.i2i },
    video: { ...DEFAULT_GENERATION_CONFIG.video, ...config.video },
    quantities: { ...DEFAULT_GENERATION_CONFIG.quantities, ...config.quantities },
  };
}

// ============================================================
// API FUNCTIONS (ASYNC)
// ============================================================

/**
 * Charge les presets depuis l'API serveur (fichier local)
 */
export async function loadPresetsFromServer(): Promise<{ presets: GenerationPreset[], currentPresetId: string | null }> {
  try {
    const response = await fetch('/api/presets');
    if (response.ok) {
      const data = await response.json();
      cachedServerPresets = data.presets || [];
      cachedCurrentPresetId = data.currentPresetId || null;
      
      // Synchroniser avec localStorage comme backup
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedServerPresets));
        if (cachedCurrentPresetId) {
          localStorage.setItem(CURRENT_PRESET_KEY, cachedCurrentPresetId);
        }
      }
      
      console.log('[Presets] Chargés depuis serveur:', cachedServerPresets.length, 'presets personnalisés');
      return { 
        presets: [...BUILT_IN_PRESETS, ...cachedServerPresets], 
        currentPresetId: cachedCurrentPresetId 
      };
    }
  } catch (error) {
    console.warn('[Presets] Erreur chargement serveur, fallback localStorage:', error);
  }
  
  // Fallback: localStorage
  return { 
    presets: loadPresets(), 
    currentPresetId: getCurrentPresetId() 
  };
}

/**
 * Sauvegarde un preset sur le serveur
 */
async function savePresetToServer(action: 'create' | 'update' | 'delete', preset: GenerationPreset): Promise<boolean> {
  try {
    const response = await fetch('/api/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, preset }),
    });
    return response.ok;
  } catch (error) {
    console.warn('[Presets] Erreur sauvegarde serveur:', error);
    return false;
  }
}

/**
 * Sauvegarde l'ID du preset courant sur le serveur
 */
async function saveCurrentPresetIdToServer(currentPresetId: string | null): Promise<boolean> {
  try {
    const response = await fetch('/api/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'setCurrentPreset', currentPresetId }),
    });
    return response.ok;
  } catch (error) {
    console.warn('[Presets] Erreur sauvegarde currentPresetId serveur:', error);
    return false;
  }
}

// ============================================================
// SYNC FUNCTIONS (SYNCHRONOUS - localStorage)
// ============================================================

/**
 * Charge tous les presets depuis localStorage (synchrone)
 */
export function loadPresets(): GenerationPreset[] {
  if (typeof window === 'undefined') {
    return [...BUILT_IN_PRESETS];
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const userPresets = JSON.parse(stored) as GenerationPreset[];
      // Combiner presets intégrés + presets utilisateur
      return [...BUILT_IN_PRESETS, ...userPresets.filter(p => !p.isBuiltIn)];
    }
  } catch (error) {
    console.error('[Presets] Erreur lecture localStorage:', error);
  }

  return [...BUILT_IN_PRESETS];
}

/**
 * Sauvegarde les presets utilisateur dans localStorage
 */
function savePresetsToLocalStorage(presets: GenerationPreset[]): void {
  if (typeof window === 'undefined') return;

  try {
    // Ne sauvegarder que les presets utilisateur (pas les built-in)
    const userPresets = presets.filter(p => !p.isBuiltIn);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userPresets));
    console.log('[Presets] Sauvegardé localStorage:', userPresets.length, 'presets');
  } catch (error) {
    console.error('[Presets] Erreur sauvegarde localStorage:', error);
  }
}

// ============================================================
// CRUD OPERATIONS (HYBRIDE)
// ============================================================

/**
 * Récupère un preset par son ID
 */
export function getPreset(id: string): GenerationPreset | undefined {
  const presets = loadPresets();
  const preset = presets.find(p => p.id === id);
  if (preset) {
    // Fusionner avec les valeurs par défaut pour gérer les migrations
    return {
      ...preset,
      config: mergeWithDefaults(preset.config),
    };
  }
  return undefined;
}

/**
 * Crée un nouveau preset (sauvegarde hybride)
 */
export function createPreset(
  name: string, 
  config: GenerationConfig, 
  description?: string
): GenerationPreset {
  const presets = loadPresets();
  
  const newPreset: GenerationPreset = {
    id: generatePresetId(),
    name,
    description,
    config,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isBuiltIn: false,
  };
  
  presets.push(newPreset);
  
  // Sauvegarde localStorage (synchrone)
  savePresetsToLocalStorage(presets);
  
  // Sauvegarde serveur (async, non-bloquant)
  savePresetToServer('create', newPreset).then(success => {
    if (success) console.log('[Presets] Synchronisé serveur:', newPreset.name);
  });
  
  console.log('[Presets] Créé:', newPreset.name);
  return newPreset;
}

/**
 * Met à jour un preset existant
 */
export function updatePreset(
  id: string, 
  updates: Partial<Pick<GenerationPreset, 'name' | 'description' | 'config'>>
): GenerationPreset | undefined {
  const presets = loadPresets();
  const index = presets.findIndex(p => p.id === id);
  
  if (index === -1) {
    console.error('[Presets] Preset non trouvé:', id);
    return undefined;
  }
  
  const preset = presets[index];
  
  // Ne pas modifier les presets intégrés
  if (preset.isBuiltIn) {
    // Pour les built-in, créer une copie modifiée
    const copy = createPreset(
      updates.name || `${preset.name} (copie)`,
      updates.config || preset.config,
      updates.description || preset.description
    );
    return copy;
  }
  
  // Mise à jour du preset utilisateur
  const updated: GenerationPreset = {
    ...preset,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  presets[index] = updated;
  
  // Sauvegarde localStorage
  savePresetsToLocalStorage(presets);
  
  // Sauvegarde serveur (async)
  savePresetToServer('update', updated).then(success => {
    if (success) console.log('[Presets] Mis à jour serveur:', updated.name);
  });
  
  console.log('[Presets] Mis à jour:', updated.name);
  return updated;
}

/**
 * Supprime un preset
 */
export function deletePreset(id: string): boolean {
  const presets = loadPresets();
  const preset = presets.find(p => p.id === id);
  
  if (!preset) {
    console.error('[Presets] Preset non trouvé:', id);
    return false;
  }
  
  if (preset.isBuiltIn) {
    console.error('[Presets] Impossible de supprimer un preset intégré');
    return false;
  }
  
  const filtered = presets.filter(p => p.id !== id);
  
  // Sauvegarde localStorage
  savePresetsToLocalStorage(filtered);
  
  // Sauvegarde serveur (async)
  savePresetToServer('delete', preset).then(success => {
    if (success) console.log('[Presets] Supprimé serveur:', preset.name);
  });
  
  console.log('[Presets] Supprimé:', preset.name);
  return true;
}

/**
 * Duplique un preset
 */
export function duplicatePreset(id: string, newName?: string): GenerationPreset | undefined {
  const preset = getPreset(id);
  
  if (!preset) {
    console.error('[Presets] Preset non trouvé:', id);
    return undefined;
  }
  
  return createPreset(
    newName || `${preset.name} (copie)`,
    { ...preset.config },
    preset.description
  );
}

// ============================================================
// PRESET COURANT (HYBRIDE)
// ============================================================

/**
 * Récupère l'ID du preset actuellement sélectionné
 */
export function getCurrentPresetId(): string | null {
  if (typeof window === 'undefined') return null;
  
  try {
    return localStorage.getItem(CURRENT_PRESET_KEY);
  } catch {
    return null;
  }
}

/**
 * Définit le preset courant (sauvegarde hybride)
 */
export function setCurrentPresetId(id: string | null): void {
  if (typeof window === 'undefined') return;
  
  try {
    if (id) {
      localStorage.setItem(CURRENT_PRESET_KEY, id);
    } else {
      localStorage.removeItem(CURRENT_PRESET_KEY);
    }
    
    // Sauvegarde serveur (async)
    saveCurrentPresetIdToServer(id);
  } catch (error) {
    console.error('[Presets] Erreur setCurrentPresetId:', error);
  }
}

/**
 * Récupère le preset courant complet
 */
export function getCurrentPreset(): GenerationPreset | undefined {
  const id = getCurrentPresetId();
  if (!id) return undefined;
  return getPreset(id);
}

// ============================================================
// IMPORT / EXPORT
// ============================================================

/**
 * Exporte un preset en JSON
 */
export function exportPreset(id: string): string | undefined {
  const preset = getPreset(id);
  if (!preset) return undefined;
  
  // Créer une version exportable (sans isBuiltIn)
  const exportable = {
    name: preset.name,
    description: preset.description,
    config: preset.config,
    exportedAt: new Date().toISOString(),
  };
  
  return JSON.stringify(exportable, null, 2);
}

/**
 * Importe un preset depuis JSON
 */
export function importPreset(json: string): GenerationPreset | undefined {
  try {
    const data = JSON.parse(json);
    
    if (!data.name || !data.config) {
      console.error('[Presets] Format invalide');
      return undefined;
    }
    
    return createPreset(
      data.name,
      data.config,
      data.description
    );
  } catch (error) {
    console.error('[Presets] Erreur import:', error);
    return undefined;
  }
}
