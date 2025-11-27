/**
 * Définit les capacités des modèles d'image
 * Ce fichier peut être importé côté client
 */

export type ModelCapabilities = {
  supportsAspectRatio: boolean;
  supportsGuidanceScale: boolean;
  supportsInferenceSteps: boolean;
  supportsSeed: boolean;
  supportsNegativePrompt: boolean;
  supportsQuality: boolean;
  supportsStyle: boolean;
  supportsStrength: boolean; // Pour edit/img2img
  defaultGuidanceScale?: number;
  defaultInferenceSteps?: number;
  minGuidanceScale?: number;
  maxGuidanceScale?: number;
  minInferenceSteps?: number;
  maxInferenceSteps?: number;
};

// Capacités par défaut (tous les paramètres supportés)
const DEFAULT_CAPABILITIES: ModelCapabilities = {
  supportsAspectRatio: true,
  supportsGuidanceScale: true,
  supportsInferenceSteps: true,
  supportsSeed: true,
  supportsNegativePrompt: true,
  supportsQuality: true,
  supportsStyle: true,
  supportsStrength: true,
  defaultGuidanceScale: 7.5,
  defaultInferenceSteps: 30,
  minGuidanceScale: 1,
  maxGuidanceScale: 20,
  minInferenceSteps: 10,
  maxInferenceSteps: 100,
};

// Capacités par modèle/provider
const MODEL_CAPABILITIES: Record<string, Partial<ModelCapabilities>> = {
  // OpenAI DALL-E - très limité
  'dall-e-3': {
    supportsGuidanceScale: false,
    supportsInferenceSteps: false,
    supportsSeed: false,
    supportsNegativePrompt: false,
    supportsStrength: false,
  },
  'dall-e-2': {
    supportsGuidanceScale: false,
    supportsInferenceSteps: false,
    supportsSeed: false,
    supportsNegativePrompt: false,
    supportsStrength: false,
    supportsStyle: false,
  },
  'gpt-image-1': {
    supportsGuidanceScale: false,
    supportsInferenceSteps: false,
    supportsSeed: false,
    supportsNegativePrompt: false,
    supportsStrength: false,
  },
  
  // xAI Grok - limité
  'grok-2-image': {
    supportsAspectRatio: false,
    supportsGuidanceScale: false,
    supportsInferenceSteps: false,
    supportsSeed: false,
    supportsNegativePrompt: false,
    supportsQuality: false,
    supportsStyle: false,
    supportsStrength: false,
  },
  
  // WaveSpeed Nano Banana - tous paramètres
  'wavespeed-nano-banana': {
    defaultGuidanceScale: 7.5,
    defaultInferenceSteps: 30,
  },
  'wavespeed-nano-banana-pro': {
    defaultGuidanceScale: 7.5,
    defaultInferenceSteps: 30,
  },
  
  // Flux models - guidance scale et steps
  'wavespeed-flux': {
    supportsQuality: false,
    supportsStyle: false,
    defaultGuidanceScale: 3.5,
    defaultInferenceSteps: 28,
    minGuidanceScale: 1,
    maxGuidanceScale: 10,
  },
  'fal-flux': {
    supportsQuality: false,
    supportsStyle: false,
    defaultGuidanceScale: 3.5,
    defaultInferenceSteps: 28,
    minGuidanceScale: 1,
    maxGuidanceScale: 10,
  },
  
  // Stability AI - complet
  'stability-ai': {
    defaultGuidanceScale: 7,
    defaultInferenceSteps: 50,
  },
  
  // Imagen - limité
  'google-imagen': {
    supportsGuidanceScale: false,
    supportsInferenceSteps: false,
    supportsStrength: false,
  },
  
  // Gemini Image - limité  
  'google-gemini': {
    supportsGuidanceScale: false,
    supportsInferenceSteps: false,
    supportsStrength: false,
  },
};

/**
 * Obtient les capacités d'un modèle par son ID
 */
export function getModelCapabilities(modelId: string): ModelCapabilities {
  // Chercher une correspondance partielle dans les clés
  for (const [key, capabilities] of Object.entries(MODEL_CAPABILITIES)) {
    if (modelId.toLowerCase().includes(key.toLowerCase().replace('wavespeed-', '').replace('fal-', ''))) {
      return { ...DEFAULT_CAPABILITIES, ...capabilities };
    }
  }
  
  // Vérifier des patterns spécifiques
  if (modelId.includes('dall-e') || modelId.includes('gpt-image')) {
    return { ...DEFAULT_CAPABILITIES, ...MODEL_CAPABILITIES['dall-e-3'] };
  }
  if (modelId.includes('grok')) {
    return { ...DEFAULT_CAPABILITIES, ...MODEL_CAPABILITIES['grok-2-image'] };
  }
  if (modelId.includes('flux')) {
    return { ...DEFAULT_CAPABILITIES, ...MODEL_CAPABILITIES['wavespeed-flux'] };
  }
  if (modelId.includes('imagen')) {
    return { ...DEFAULT_CAPABILITIES, ...MODEL_CAPABILITIES['google-imagen'] };
  }
  if (modelId.includes('gemini')) {
    return { ...DEFAULT_CAPABILITIES, ...MODEL_CAPABILITIES['google-gemini'] };
  }
  if (modelId.includes('stability') || modelId.includes('sdxl') || modelId.includes('stable-diffusion')) {
    return { ...DEFAULT_CAPABILITIES, ...MODEL_CAPABILITIES['stability-ai'] };
  }
  
  // Par défaut, tous les paramètres supportés (WaveSpeed, etc.)
  return DEFAULT_CAPABILITIES;
}

