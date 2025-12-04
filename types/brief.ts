// Types pour le système de briefs

export type BriefStatus = 'draft' | 'ready' | 'generating' | 'completed';
export type ReasoningLevel = 'low' | 'medium' | 'high';
export type DocumentType = 'text' | 'pdf' | 'image' | 'video' | 'audio';
export type QualityLevel = 'normal' | 'elevee';

export interface Brief {
  id: string;
  name: string;
  description?: string;
  userId: string;
  totalTokens: number;
  estimatedCost?: string;
  status: BriefStatus;
  createdAt: Date;
  updatedAt?: Date;
  documents?: BriefDocument[];
}

export interface BriefDocument {
  id: string;
  briefId: string;
  name: string;
  type: DocumentType;
  mimeType?: string;
  size: number;
  storagePath: string;
  url: string;
  content?: string;
  tokens: number;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    pages?: number;
    [key: string]: any;
  };
  createdAt: Date;
}

// Configuration des prompts pour la génération d'images
export interface CharacterPromptConfig {
  // System prompt pour guider l'IA dans la création des prompts de personnages
  systemPrompt: string;
  // Prompts fixes pour les variantes (utilisés après l'image primaire)
  variantPrompts: {
    face: string;      // Visage de face (1:1)
    profile: string;   // Visage de profil (1:1)
    back: string;      // Vue de dos (9:16)
  };
}

export interface DecorPromptConfig {
  // System prompt pour guider l'IA dans la création des prompts de décors
  systemPrompt: string;
  // Prompts fixes pour les variantes (utilisés après l'image primaire)
  variantPrompts: {
    angle2: string;    // Nouvel angle 1 (16:9)
    plongee: string;   // Vue plongée top down (16:9)
    contrePlongee: string; // Vue contre-plongée (16:9)
  };
}

// Configuration des modèles selon la qualité
export interface QualityModelConfig {
  // Modèles pour génération text-to-image (image primaire)
  textToImage: {
    normal: string;      // google/nano-banana/text-to-image
    elevee: string;      // google/nano-banana-pro/text-to-image-ultra
  };
  // Modèles pour génération edit (variantes)
  edit: {
    normal: string;      // google/nano-banana/edit
    elevee: string;      // google/nano-banana-pro/edit-ultra
  };
  // Paramètres additionnels pour qualité élevée
  eleveeParams: {
    resolution: string;  // '4K'
  };
}

export interface ProjectGenerationConfig {
  id: string;
  briefId: string;
  projectId?: string;
  aiModel: string;
  reasoningLevel: ReasoningLevel;
  generateMediaDirectly: boolean;
  systemPrompt: string;
  customInstructions?: string;
  // Niveau de qualité pour les images
  quality: QualityLevel;
  settings?: {
    videoModel?: string; // 'kling-o1', 'seedream', etc.
    imageModel?: string; // 'nanobanana-pro', 'flux', etc.
    videoCopies?: number; // DEPRECATED: utiliser couplesPerPlan × videosPerCouple
    couplesPerPlan?: number; // N = Nombre de couples (first/last frame) par plan (défaut: 1)
    videosPerCouple?: number; // M = Nombre de vidéos à générer par couple (défaut: 4)
    videoDuration?: number;
    videoAspectRatio?: string;
    testMode?: boolean;
    [key: string]: any;
  };
  // Configuration avancée des prompts
  advancedPromptConfig?: {
    characterConfig: CharacterPromptConfig;
    decorConfig: DecorPromptConfig;
    modelConfig: QualityModelConfig;
  };
  createdAt: Date;
}

// Types pour la génération de scénario
export interface ScenarioScene {
  sceneNumber: number;
  title: string;
  description: string;
  plans: ScenarioPlan[];
}

export interface ScenarioPlan {
  planNumber: number;
  sceneNumber: number;
  prompt: string;
  characters: string[]; // Noms des personnages impliqués
  locations: string[]; // Noms des lieux impliqués
  duration?: number; // Durée estimée en secondes
  type: 'shot' | 'character' | 'location'; // Type de plan
}

export interface Character {
  name: string;
  description: string;
  referenceCode: string; // Ex: [PERSO:Jean]
  prompts: {
    face: string;
    profile: string;
    fullBody: string;
    back: string;
  };
}

export interface Location {
  name: string;
  description: string;
  referenceCode: string; // Ex: [DECOR:Cuisine]
  prompt: string; // Prompt pour générer plusieurs angles
}

// Alias pour la migration vers "Décor"
export type Decor = Location;

export interface GeneratedScenario {
  briefId: string;
  title: string;
  synopsis: string;
  characters: Character[];
  locations: Location[];
  scenes: ScenarioScene[];
  totalPlans: number;
  estimatedDuration: number; // En secondes
  reasoning?: string; // Raisonnement de l'IA (GPT-5.1)
}

