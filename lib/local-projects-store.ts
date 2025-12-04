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
  characterImages: { 
    characterId: string; 
    imageNodeIds: string[];
    prompts?: Record<string, string>; // viewType -> prompt enrichi
    aspectRatios?: Record<string, string>; // viewType -> aspectRatio
    order?: string[]; // Ordre de génération (fullBody d'abord)
  }[];
  locationImages: { 
    locationId: string; 
    imageNodeIds: string[];
    prompts?: Record<string, string>;
    aspectRatios?: Record<string, string>;
    order?: string[];
  }[];
  characterCollections: [string, string][]; // [characterId, collectionNodeId]
  locationCollections: [string, string][]; // [locationId, collectionNodeId]
  videos: { 
    planId: string; 
    videoNodeIds: string[]; // TABLEAU : 1 nœud par copie (ex: 4 nœuds pour 4 copies)
    prompt: string;
    characterCollectionIds: string[]; // IDs des collections personnages
    locationCollectionId?: string; // ID de la collection lieu
  }[];
  videoCopies: number; // Nombre de copies par plan (défaut: 4)
  videoSettings?: { duration: number; aspectRatio: string }; // Paramètres vidéo
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
 * DEBOUNCED pour éviter les appels trop fréquents (réduit le flickering UI)
 */
let syncTimeout: NodeJS.Timeout | null = null;
let lastSyncTime = 0;
const SYNC_DEBOUNCE_MS = 5000; // 5 secondes minimum entre les syncs

async function syncProjectsToServer(projects: LocalProject[]): Promise<void> {
  const now = Date.now();
  
  // Si on a sync récemment, debounce
  if (now - lastSyncTime < SYNC_DEBOUNCE_MS) {
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
      syncProjectsToServer(projects);
    }, SYNC_DEBOUNCE_MS);
    return;
  }
  
  lastSyncTime = now;
  
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
 * Détermine le service depuis le modelId
 */
function getServiceFromModel(modelId: string): string {
  const id = modelId.toLowerCase();
  if (id.includes('wavespeed')) return 'wavespeed';
  if (id.includes('fal')) return 'fal';
  if (id.includes('replicate')) return 'replicate';
  if (id.includes('openai') || id.includes('gpt') || id.includes('dall-e')) return 'openai';
  if (id.includes('runway')) return 'runway';
  if (id.includes('luma')) return 'luma';
  if (id.includes('minimax')) return 'minimax';
  if (id.includes('kling')) return 'kling';
  if (id.includes('anthropic') || id.includes('claude')) return 'anthropic';
  return 'other';
}

/**
 * Estime le coût d'une génération basé sur le modèle
 * Valeurs approximatives basées sur les tarifs courants
 */
function estimateCost(modelId: string, type: 'image' | 'video' | 'audio', duration?: number): number {
  const id = modelId.toLowerCase();
  
  if (type === 'image') {
    // Images - prix moyen par image
    if (id.includes('flux-pro') || id.includes('flux-1.1-pro')) return 0.05;
    if (id.includes('flux-dev') || id.includes('flux-1-dev')) return 0.025;
    if (id.includes('flux-schnell')) return 0.003;
    if (id.includes('dall-e-3')) return 0.08;
    if (id.includes('dall-e-2')) return 0.02;
    if (id.includes('grok')) return 0.07;
    if (id.includes('recraft')) return 0.04;
    if (id.includes('ideogram')) return 0.08;
    if (id.includes('stable-diffusion')) return 0.02;
    if (id.includes('wavespeed')) return 0.02;
    return 0.03; // Défaut
  }
  
  if (type === 'video') {
    const dur = duration || 5;
    // Vidéos - prix par seconde
    if (id.includes('kling-v2')) return 0.1 * dur;
    if (id.includes('kling-v1.6')) return 0.08 * dur;
    if (id.includes('kling-v1.5')) return 0.065 * dur;
    if (id.includes('kling-v1')) return 0.05 * dur;
    if (id.includes('minimax')) return 0.05 * dur;
    if (id.includes('runway')) return 0.05 * dur;
    if (id.includes('luma')) return 0.04 * dur;
    if (id.includes('wan-')) return 0.03 * dur;
    if (id.includes('ltx-video')) return 0.03 * dur;
    if (id.includes('wavespeed')) return 0.43;
    return 0.05 * dur; // Défaut
  }
  
  if (type === 'audio') {
    const dur = duration || 10;
    // Audio - prix par seconde
    if (id.includes('elevenlabs')) return 0.002 * dur;
    if (id.includes('openai') || id.includes('tts')) return 0.015 * dur;
    return 0.001 * dur; // Défaut
  }
  
  return 0;
}

/**
 * Détermine le type de média depuis le type de node
 */
function getMediaTypeFromNodeType(nodeType: string): 'image' | 'video' | 'audio' | null {
  if (nodeType === 'image' || nodeType === 'image-transform') return 'image';
  if (nodeType === 'video' || nodeType === 'video-transform') return 'video';
  if (nodeType === 'audio' || nodeType === 'audio-transform') return 'audio';
  return null;
}

/**
 * Reconstruit les stats d'un projet à partir de ses nodes
 * Utilisé pour récupérer les stats des projets existants
 */
export function rebuildProjectStats(projectId: string): ProjectStats {
  const project = getLocalProjectById(projectId);
  if (!project) return initProjectStats();
  
  const stats: ProjectStats = {
    totalGenerations: 0,
    totalDeleted: 0, // On ne peut pas reconstruire cette valeur
    costByService: {},
    totalCost: 0,
    generationsByModel: {},
    generationsByType: {},
    totalSentToDVR: 0,
  };
  
  const nodes = project.data?.nodes || [];
  
  for (const node of nodes) {
    const nodeData = node as { type?: string; data?: Record<string, unknown> };
    const nodeType = nodeData.type;
    const data = nodeData.data || {};
    
    // Vérifier si c'est un média généré
    const isGenerated = Boolean(data.isGenerated || data.generated);
    if (!isGenerated) continue;
    
    const mediaType = getMediaTypeFromNodeType(nodeType || '');
    if (!mediaType) continue;
    
    // Incrémenter les compteurs
    stats.totalGenerations++;
    stats.generationsByType[mediaType] = (stats.generationsByType[mediaType] || 0) + 1;
    
    // Modèle
    const modelId = (data.modelId || 'unknown') as string;
    stats.generationsByModel[modelId] = (stats.generationsByModel[modelId] || 0) + 1;
    
    // Coût : utiliser la valeur stockée ou estimer
    let cost = 0;
    if (typeof data.cost === 'number') {
      cost = data.cost;
    } else {
      // Estimer le coût
      const duration = (data.duration || data.generated?.duration) as number | undefined;
      cost = estimateCost(modelId, mediaType, duration);
    }
    
    stats.totalCost += cost;
    
    // Par service
    const service = getServiceFromModel(modelId);
    stats.costByService[service] = (stats.costByService[service] || 0) + cost;
    
    // DVR
    if (data.dvrTransferred) {
      stats.totalSentToDVR++;
    }
  }
  
  // Sauvegarder les stats reconstruites
  updateLocalProject(projectId, { stats });
  
  return stats;
}

/**
 * Reconstruit les stats de TOUS les projets
 * Retourne le nombre de projets mis à jour
 */
export function rebuildAllProjectsStats(): number {
  const projects = getLocalProjects();
  let updated = 0;
  
  for (const project of projects) {
    rebuildProjectStats(project.id);
    updated++;
  }
  
  return updated;
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

