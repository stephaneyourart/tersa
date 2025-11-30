/**
 * Système de références pour les médias partagés entre projets
 * 
 * Règles :
 * - Un fichier média peut être utilisé par plusieurs projets
 * - Supprimer un projet NE supprime PAS les fichiers
 * - Supprimer un nœud dans un projet supprime le fichier SEULEMENT si aucun autre projet ne l'utilise
 * - Dupliquer un projet partage les mêmes fichiers (pas de copie)
 */

const STORAGE_KEY = 'tersa-media-references';

export interface MediaReference {
  // Chemin du fichier (localPath ou URL relative)
  filePath: string;
  // IDs des projets qui utilisent ce fichier
  projectIds: string[];
  // Date de création
  createdAt: string;
}

interface MediaReferencesStore {
  references: Record<string, MediaReference>; // clé = filePath normalisé
}

/**
 * Normalise un chemin de fichier pour l'utiliser comme clé
 */
function normalizeFilePath(filePath: string): string {
  // Supprimer les préfixes communs
  return filePath
    .replace(/^\/api\/storage\//, '')
    .replace(/^.*\/storage\//, '');
}

/**
 * Charge le store des références
 */
function loadStore(): MediaReferencesStore {
  if (typeof window === 'undefined') {
    return { references: {} };
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { references: {} };
    return JSON.parse(stored) as MediaReferencesStore;
  } catch {
    console.error('Erreur lecture références média');
    return { references: {} };
  }
}

/**
 * Sauvegarde le store des références
 */
function saveStore(store: MediaReferencesStore): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (error) {
    console.error('Erreur sauvegarde références média:', error);
  }
}

/**
 * Ajoute une référence à un fichier pour un projet
 */
export function addMediaReference(filePath: string, projectId: string): void {
  if (!filePath || !projectId) return;
  
  const store = loadStore();
  const key = normalizeFilePath(filePath);
  
  if (!store.references[key]) {
    store.references[key] = {
      filePath: key,
      projectIds: [],
      createdAt: new Date().toISOString(),
    };
  }
  
  if (!store.references[key].projectIds.includes(projectId)) {
    store.references[key].projectIds.push(projectId);
  }
  
  saveStore(store);
}

/**
 * Supprime une référence à un fichier pour un projet
 * Retourne true si le fichier peut être supprimé (plus aucune référence)
 */
export function removeMediaReference(filePath: string, projectId: string): boolean {
  if (!filePath || !projectId) return false;
  
  const store = loadStore();
  const key = normalizeFilePath(filePath);
  
  if (!store.references[key]) {
    // Pas de référence = on peut supprimer le fichier
    return true;
  }
  
  // Retirer ce projet des références
  store.references[key].projectIds = store.references[key].projectIds.filter(
    id => id !== projectId
  );
  
  // Si plus aucun projet n'utilise ce fichier
  if (store.references[key].projectIds.length === 0) {
    delete store.references[key];
    saveStore(store);
    return true; // OK pour supprimer le fichier
  }
  
  saveStore(store);
  return false; // Fichier encore utilisé ailleurs
}

/**
 * Vérifie si un fichier est utilisé par d'autres projets que celui spécifié
 */
export function isMediaUsedElsewhere(filePath: string, currentProjectId: string): boolean {
  if (!filePath) return false;
  
  const store = loadStore();
  const key = normalizeFilePath(filePath);
  
  const ref = store.references[key];
  if (!ref) return false;
  
  // Vérifie s'il y a d'autres projets que le courant
  return ref.projectIds.some(id => id !== currentProjectId);
}

/**
 * Récupère tous les projets qui utilisent un fichier
 */
export function getMediaProjects(filePath: string): string[] {
  if (!filePath) return [];
  
  const store = loadStore();
  const key = normalizeFilePath(filePath);
  
  return store.references[key]?.projectIds || [];
}

/**
 * Compte le nombre de références pour un fichier
 */
export function getMediaReferenceCount(filePath: string): number {
  if (!filePath) return 0;
  
  const store = loadStore();
  const key = normalizeFilePath(filePath);
  
  return store.references[key]?.projectIds.length || 0;
}

/**
 * Enregistre toutes les références d'un projet (à appeler lors de la sauvegarde)
 */
export function registerProjectMediaReferences(projectId: string, nodes: unknown[]): void {
  if (!projectId || !nodes) return;
  
  for (const node of nodes) {
    const nodeData = node as { data?: Record<string, unknown> };
    const data = nodeData.data || {};
    
    // Récupérer le chemin du fichier
    const localPath = data.localPath as string | undefined;
    const contentUrl = (data.content?.url || data.generated?.url) as string | undefined;
    
    const filePath = localPath || contentUrl;
    if (filePath) {
      addMediaReference(filePath, projectId);
    }
  }
}

/**
 * Nettoie les références orphelines (projets qui n'existent plus)
 * À appeler périodiquement
 */
export function cleanupOrphanedReferences(existingProjectIds: string[]): void {
  const store = loadStore();
  let changed = false;
  
  for (const key of Object.keys(store.references)) {
    const ref = store.references[key];
    const validProjects = ref.projectIds.filter(id => existingProjectIds.includes(id));
    
    if (validProjects.length !== ref.projectIds.length) {
      changed = true;
      if (validProjects.length === 0) {
        delete store.references[key];
      } else {
        store.references[key].projectIds = validProjects;
      }
    }
  }
  
  if (changed) {
    saveStore(store);
  }
}

/**
 * Récupère toutes les références (pour debug)
 */
export function getAllMediaReferences(): Record<string, MediaReference> {
  return loadStore().references;
}

