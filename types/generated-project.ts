/**
 * Types pour le projet généré par l'IA à partir d'un brief
 * Structure complète : personnages, lieux, scènes, plans
 */

// ========== PERSONNAGES ==========
export interface CharacterPrompts {
  face: string;      // Portrait frontal
  profile: string;   // Portrait de profil  
  fullBody: string;  // Photo en pied de face
  back: string;      // Photo de dos
}

export interface GeneratedCharacter {
  id: string;                    // Ex: "perso-jean"
  name: string;                  // Ex: "Jean"
  description: string;           // Description complète
  referenceCode: string;         // Ex: "[PERSO:Jean]"
  prompts: CharacterPrompts;     // 4 prompts pour les images
}

// ========== LIEUX ==========
export interface LocationPrompts {
  angle1: string;   // Vue principale
  angle2: string;   // Vue alternative
  angle3: string;   // Vue détail/ambiance
}

export interface GeneratedLocation {
  id: string;                    // Ex: "lieu-bureau"
  name: string;                  // Ex: "Bureau moderne"
  description: string;           // Description complète
  referenceCode: string;         // Ex: "[LIEU:Bureau]"
  prompts: LocationPrompts;      // 3 prompts pour les angles
}

// ========== PLANS ==========
export interface GeneratedPlan {
  id: string;                    // Ex: "plan-1-1"
  planNumber: number;            // Numéro dans la scène
  prompt: string;                // Prompt pour générer la vidéo
  characterRefs: string[];       // IDs des personnages impliqués
  locationRef: string | null;    // ID du lieu (peut être null)
  duration: number;              // Durée estimée en secondes
  cameraMovement?: string;       // Ex: "Travelling avant lent"
  notes?: string;                // Notes additionnelles
}

// ========== SCÈNES ==========
export interface GeneratedScene {
  id: string;                    // Ex: "scene-1"
  sceneNumber: number;           // Numéro de la scène
  title: string;                 // Titre de la scène
  description: string;           // Description/synopsis de la scène
  plans: GeneratedPlan[];        // Plans de la scène
  color: string;                 // Couleur du rectangle de fond
}

// ========== PROJET COMPLET ==========
export interface GeneratedProjectStructure {
  title: string;                      // Titre du projet
  synopsis: string;                   // Synopsis général
  characters: GeneratedCharacter[];   // Tous les personnages
  locations: GeneratedLocation[];     // Tous les lieux
  scenes: GeneratedScene[];           // Toutes les scènes avec leurs plans
  totalPlans: number;                 // Nombre total de plans
  estimatedDuration: number;          // Durée totale estimée (secondes)
  reasoning?: string;                 // Raisonnement de l'IA (GPT-5.1)
}

// ========== NŒUDS CANVAS ==========
export interface CanvasNodePosition {
  x: number;
  y: number;
}

export interface SceneCluster {
  sceneId: string;
  color: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  titlePosition: CanvasNodePosition;
}

// ========== ÉVÉNEMENTS SSE ==========
export type GenerationEventType = 
  | 'status'           // Message de statut
  | 'reasoning'        // Contenu de raisonnement (streaming)
  | 'phase_start'      // Début d'une phase
  | 'phase_complete'   // Fin d'une phase
  | 'node_created'     // Nœud créé
  | 'progress'         // Progression (pourcentage)
  | 'complete'         // Terminé avec succès
  | 'error';           // Erreur

export interface GenerationEvent {
  type: GenerationEventType;
  message?: string;
  reasoning?: string;
  phase?: 'analysis' | 'canvas_creation' | 'media_generation';
  progress?: number;
  nodeId?: string;
  nodeType?: string;
  projectId?: string;
  error?: string;
  data?: Record<string, unknown>;
}

// ========== COULEURS SCÈNES ==========
export const SCENE_COLORS = [
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#f97316', // orange-500
  '#22c55e', // green-500
  '#06b6d4', // cyan-500
  '#eab308', // yellow-500
  '#ef4444', // red-500
  '#6366f1', // indigo-500
  '#14b8a6', // teal-500
];

export function getSceneColor(index: number): string {
  return SCENE_COLORS[index % SCENE_COLORS.length];
}

