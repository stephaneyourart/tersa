// Types pour le système de briefs

export type BriefStatus = 'draft' | 'ready' | 'generating' | 'completed';
export type ReasoningLevel = 'low' | 'medium' | 'high';
export type DocumentType = 'text' | 'pdf' | 'image' | 'video' | 'audio';

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

export interface ProjectGenerationConfig {
  id: string;
  briefId: string;
  projectId?: string;
  aiModel: string;
  reasoningLevel: ReasoningLevel;
  generateMediaDirectly: boolean;
  systemPrompt: string;
  customInstructions?: string;
  settings?: {
    videoModel?: string; // 'kling-o1', 'seedream', etc.
    imageModel?: string; // 'nanobanana-pro', 'flux', etc.
    videoCopies?: number; // Nombre de copies à générer (défaut: 4)
    [key: string]: any;
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
  referenceCode: string; // Ex: [LIEU:Cuisine]
  prompt: string; // Prompt pour générer plusieurs angles
}

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

