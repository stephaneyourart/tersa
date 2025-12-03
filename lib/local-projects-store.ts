/**
 * Store pour les projets locaux
 * Utilise localStorage pour persister les projets
 * + Synchronise vers un fichier serveur pour l'API media-library
 */

export interface ProjectSettings {
  // System prompt pour l'analyse IA des médias (DVR)
  dvrAnalysisSystemPrompt?: string;
  // Dossier DVR par défaut pour ce projet
  dvrDefaultFolder?: string;
  // Raccourci clavier pour la recherche dans le Media Pool de DVR
  // Format: "cmd+shift+f" ou "ctrl+shift+f" (Windows)
  dvrSearchShortcut?: string;
  // Autres settings futurs...
}

// Stats historiques du projet (persistées même si les éléments sont supprimés)
export interface ProjectStats {
  // Compteurs de générations (même supprimées)
  totalGenerations: number;
  totalDeleted: number;
  
  // Coûts par service/API
  costByService: Record<string, number>; // ex: { "wavespeed": 1.23, "replicate": 0.45 }
  totalCost: number;
  
  // Générations par modèle (même supprimées)
  generationsByModel: Record<string, number>; // ex: { "kling-v2.5-turbo": 5 }
  
  // Générations par type
  generationsByType: Record<string, number>; // ex: { "image": 10, "video": 3 }
  
  // Compteur DVR
  totalSentToDVR: number;
}

export interface GenerationSequence {
  characterImages: { characterId: string; imageNodeIds: string[] }[];
  locationImages: { locationId: string; imageNodeIds: string[] }[];
  characterCollections: [string, string][]; // [characterId, collectionNodeId]
  locationCollections: [string, string][]; // [locationId, collectionNodeId]
  videos: { 
    planId: string; 
    videoNodeId: string;
    prompt: string;
    characterCollectionIds: string[]; // IDs des collections personnages
    locationCollectionId?: string; // ID de la collection lieu
  }[];
}

export interface LocalProject {
  id: string;
  name: string;
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
  settings?: ProjectSettings;
  stats?: ProjectStats; // Stats historiques (persistées)
  data: {
    nodes: unknown[];
    edges: unknown[];
    viewport?: unknown;
    generationSequence?: GenerationSequence; // Séquence pour génération automatique
  };
}

const STORAGE_KEY = 'tersa-local-projects';

/**
 * Génère un ID unique
 */
function generateId(): string {
  return `project-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Récupère tous les projets locaux
 */
export function getLocalProjects(): LocalProject[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const projects = JSON.parse(stored) as LocalProject[];
    
    // Synchroniser vers le serveur en arrière-plan (pour l'API media-library)
    syncProjectsToServer(projects);
    
    return projects;
  } catch {
    console.error('Erreur lecture projets locaux');
    return [];
  }
}

/**
 * Récupère un projet par son ID
 */
export function getLocalProjectById(id: string): LocalProject | null {
  const projects = getLocalProjects();
  return projects.find(p => p.id === id) || null;
}

/**
 * Crée un nouveau projet
 */
export function createLocalProject(name: string = 'Untitled'): LocalProject {
  const projects = getLocalProjects();
  
  const newProject: LocalProject = {
    id: generateId(),
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    data: {
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    },
  };
  
  projects.unshift(newProject);
  saveProjects(projects);
  
  return newProject;
}

/**
 * Met à jour un projet
 */
export function updateLocalProject(
  id: string, 
  updates: Partial<Pick<LocalProject, 'name' | 'thumbnail' | 'data' | 'settings' | 'stats'>>
): LocalProject | null {
  const projects = getLocalProjects();
  const index = projects.findIndex(p => p.id === id);
  
  if (index === -1) return null;
  
  projects[index] = {
    ...projects[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  saveProjects(projects);
  return projects[index];
}

/**
 * Met à jour les settings d'un projet
 */
export function updateProjectSettings(
  id: string,
  settings: Partial<ProjectSettings>
): LocalProject | null {
  const project = getLocalProjectById(id);
  if (!project) return null;
  
  return updateLocalProject(id, {
    settings: {
      ...project.settings,
      ...settings,
    },
  });
}

/**
 * Récupère les settings d'un projet
 */
export function getProjectSettings(id: string): ProjectSettings | null {
  const project = getLocalProjectById(id);
  return project?.settings || null;
}

/**
 * Duplique un projet
 */
export function duplicateLocalProject(id: string): LocalProject | null {
  const project = getLocalProjectById(id);
  if (!project) return null;
  
  const projects = getLocalProjects();
  
  const duplicated: LocalProject = {
    ...project,
    id: generateId(),
    name: `${project.name} (copy)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  projects.unshift(duplicated);
  saveProjects(projects);
  
  return duplicated;
}

/**
 * Renomme un projet
 */
export function renameLocalProject(id: string, newName: string): LocalProject | null {
  return updateLocalProject(id, { name: newName });
}

/**
 * Supprime un projet
 * NOTE: Les fichiers médias ne sont PAS supprimés du disque !
 * Ils peuvent être utilisés par d'autres projets (duplication).
 */
export function deleteLocalProject(id: string): boolean {
  const projects = getLocalProjects();
  const index = projects.findIndex(p => p.id === id);
  
  if (index === -1) return false;
  
  // Supprimer le projet (les fichiers restent sur le disque)
  projects.splice(index, 1);
  saveProjects(projects);
  
  return true;
}

/**
 * Sauvegarde les projets dans localStorage ET synchronise vers le serveur
 */
function saveProjects(projects: LocalProject[]): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    
    // Synchroniser vers le serveur (async, fire-and-forget)
    syncProjectsToServer(projects);
  } catch (error) {
    console.error('Erreur sauvegarde projets:', error);
  }
}

/**
 * Synchronise les projets vers le serveur pour l'API media-library
 */
async function syncProjectsToServer(projects: LocalProject[]): Promise<void> {
  try {
    await fetch('/api/projects-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projects }),
    });
  } catch (error) {
    // Silencieux - la synchronisation est optionnelle
    console.debug('Sync projets vers serveur:', error);
  }
}

/**
 * Initialise les stats vides d'un projet
 */
function initProjectStats(): ProjectStats {
  return {
    totalGenerations: 0,
    totalDeleted: 0,
    costByService: {},
    totalCost: 0,
    generationsByModel: {},
    generationsByType: {},
    totalSentToDVR: 0,
  };
}

/**
 * Récupère les stats d'un projet (avec initialisation si nécessaire)
 */
export function getProjectStats(id: string): ProjectStats {
  const project = getLocalProjectById(id);
  return project?.stats || initProjectStats();
}

/**
 * Enregistre une nouvelle génération dans les stats du projet
 */
export function trackGeneration(
  projectId: string,
  data: {
    type: 'image' | 'video' | 'audio';
    model: string;
    service: string; // 'wavespeed', 'replicate', 'fal', 'openai', etc.
    cost: number;
  }
): void {
  const project = getLocalProjectById(projectId);
  if (!project) return;
  
  const stats = project.stats || initProjectStats();
  
  // Incrémenter les compteurs
  stats.totalGenerations++;
  stats.totalCost += data.cost;
  
  // Par service
  stats.costByService[data.service] = (stats.costByService[data.service] || 0) + data.cost;
  
  // Par modèle
  stats.generationsByModel[data.model] = (stats.generationsByModel[data.model] || 0) + 1;
  
  // Par type
  stats.generationsByType[data.type] = (stats.generationsByType[data.type] || 0) + 1;
  
  updateLocalProject(projectId, { stats } as Partial<Pick<LocalProject, 'stats'>>);
}

/**
 * Enregistre une suppression dans les stats du projet
 */
export function trackDeletion(projectId: string): void {
  const project = getLocalProjectById(projectId);
  if (!project) return;
  
  const stats = project.stats || initProjectStats();
  stats.totalDeleted++;
  
  updateLocalProject(projectId, { stats } as Partial<Pick<LocalProject, 'stats'>>);
}

/**
 * Enregistre un envoi vers DVR dans les stats du projet
 */
export function trackDVRTransfer(projectId: string): void {
  const project = getLocalProjectById(projectId);
  if (!project) return;
  
  const stats = project.stats || initProjectStats();
  stats.totalSentToDVR++;
  
  updateLocalProject(projectId, { stats } as Partial<Pick<LocalProject, 'stats'>>);
}

/**
 * Formate une date pour l'affichage
 */
export function formatProjectDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) {
    return 'Edited today';
  } else if (days === 1) {
    return 'Edited yesterday';
  } else if (days < 7) {
    return `Edited ${days} days ago`;
  } else {
    return `Edited ${date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    })}`;
  }
}

