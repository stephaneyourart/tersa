/**
 * Store pour les générations (localStorage)
 * Enregistre toutes les générations avec leurs métadonnées
 */

export type GenerationType = 'text' | 'image' | 'video' | 'audio' | 'code';

export type Generation = {
  id: string;
  type: GenerationType;
  model: string;
  modelLabel?: string;
  prompt?: string;
  createdAt: string; // ISO string
  duration: number; // en secondes
  cost: number; // en dollars
  status: 'success' | 'error';
  error?: string;
  outputUrl?: string; // URL du fichier généré (pour image/video/audio)
  outputText?: string; // Texte généré (pour text)
  projectId?: string;
  projectName?: string;
  nodeId?: string;
  nodeName?: string; // Nom personnalisé du nœud (vide si nom par défaut)
  // Métadonnées supplémentaires
  inputTokens?: number;
  outputTokens?: number;
  size?: string; // Pour les images (ex: "1024x1024")
  fileSize?: number; // Taille du fichier en bytes
  videoDuration?: number; // Durée de la vidéo en secondes
  // DaVinci Resolve
  dvrTransferred?: boolean; // Si true, l'élément a été transféré vers DVR
  dvrTransferDate?: string; // Date du transfert
  dvrProject?: string; // Nom du projet DVR
  localPath?: string; // Chemin local du fichier téléchargé
};

const STORAGE_KEY = 'tersa-generations';

// Récupérer toutes les générations
export function getGenerations(): Generation[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading generations from localStorage:', error);
    return [];
  }
}

// Ajouter une génération
export function addGeneration(generation: Omit<Generation, 'id' | 'createdAt'>): Generation {
  const newGeneration: Generation = {
    ...generation,
    id: `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
  };
  
  const generations = getGenerations();
  generations.unshift(newGeneration); // Ajouter au début
  
  // Limiter à 500 générations
  if (generations.length > 500) {
    generations.pop();
  }
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(generations));
  } catch (error) {
    console.error('Error saving generation to localStorage:', error);
  }
  
  // Émettre un événement pour mettre à jour le dashboard
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tersa-generation-added', { detail: newGeneration }));
  }
  
  return newGeneration;
}

// Supprimer une génération
export function deleteGeneration(id: string): void {
  const generations = getGenerations();
  const filtered = generations.filter(g => g.id !== id);
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error deleting generation from localStorage:', error);
  }
}

// Renommer une génération
export function renameGeneration(id: string, newName: string): void {
  const generations = getGenerations();
  const updated = generations.map(g => 
    g.id === id ? { ...g, nodeName: newName || undefined } : g
  );
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error renaming generation in localStorage:', error);
  }
}

// Mettre à jour le statut DVR d'une génération
export function updateGenerationDVRStatus(
  nodeId: string, 
  dvrData: { 
    dvrTransferred: boolean; 
    dvrTransferDate?: string;
    dvrProject?: string;
    localPath?: string;
  }
): void {
  const generations = getGenerations();
  const updated = generations.map(g => 
    g.nodeId === nodeId ? { ...g, ...dvrData } : g
  );
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    // Émettre un événement pour mettre à jour le dashboard
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tersa-generation-updated'));
    }
  } catch (error) {
    console.error('Error updating generation DVR status in localStorage:', error);
  }
}

// Récupérer une génération par nodeId
export function getGenerationByNodeId(nodeId: string): Generation | undefined {
  const generations = getGenerations();
  return generations.find(g => g.nodeId === nodeId);
}

// Supprimer toutes les générations
export function clearGenerations(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing generations from localStorage:', error);
  }
}

// Statistiques globales
export function getGenerationsStats() {
  const generations = getGenerations();
  
  const stats = {
    total: generations.length,
    success: generations.filter(g => g.status === 'success').length,
    error: generations.filter(g => g.status === 'error').length,
    totalCost: generations.reduce((acc, g) => acc + (g.cost || 0), 0),
    totalDuration: generations.reduce((acc, g) => acc + (g.duration || 0), 0),
    byType: {
      text: generations.filter(g => g.type === 'text').length,
      image: generations.filter(g => g.type === 'image').length,
      video: generations.filter(g => g.type === 'video').length,
      audio: generations.filter(g => g.type === 'audio').length,
      code: generations.filter(g => g.type === 'code').length,
    },
    costByType: {
      text: generations.filter(g => g.type === 'text').reduce((acc, g) => acc + (g.cost || 0), 0),
      image: generations.filter(g => g.type === 'image').reduce((acc, g) => acc + (g.cost || 0), 0),
      video: generations.filter(g => g.type === 'video').reduce((acc, g) => acc + (g.cost || 0), 0),
      audio: generations.filter(g => g.type === 'audio').reduce((acc, g) => acc + (g.cost || 0), 0),
      code: generations.filter(g => g.type === 'code').reduce((acc, g) => acc + (g.cost || 0), 0),
    },
  };
  
  return stats;
}

