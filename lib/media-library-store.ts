/**
 * Store Zustand pour la Media Library Sidebar
 * Gère l'état de la sidebar et la liste des médias globaux
 */

import { create } from 'zustand';

// Types de médias
export type MediaType = 'image' | 'video' | 'audio' | 'document';

// Métadonnées d'un média
export interface MediaItem {
  id: string;
  filename: string;
  type: MediaType;
  url: string;
  path: string;
  
  // Métadonnées techniques
  width?: number;
  height?: number;
  duration?: number;
  fps?: number; // frames per second (vidéos uniquement)
  fileSize?: number;
  format?: string;
  
  // Métadonnées utilisateur
  name?: string;
  description?: string;
  scene?: string;
  decor?: string;
  tags?: string[];
  favorites?: number; // 0-5 étoiles
  
  // Génération
  isGenerated?: boolean;
  modelId?: string;
  prompt?: string;
  aspectRatio?: string;
  seed?: number | string;
  
  // DVR
  dvrTransferred?: boolean;
  dvrProject?: string;
  
  // Dates
  createdAt?: string;
  updatedAt?: string;
  
  // Projets qui utilisent ce média
  usedInProjects?: string[];
}

// Colonnes disponibles
export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  width: number;
  order: number;
}

// Configuration des colonnes par défaut - TOUTES les colonnes possibles
// Colonnes visibles par défaut optimisées pour une vue compacte
// Note: "name" affiche le nom avec tooltip pour chemin complet (pas de colonne filename séparée)
// Les 3 premières colonnes (type, preview, name) sont figées lors du scroll horizontal
export const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'type', label: 'Type', visible: true, width: 40, order: 0 },
  { id: 'preview', label: 'Aperçu', visible: true, width: 60, order: 1 },
  { id: 'name', label: 'Nom', visible: true, width: 200, order: 2 },
  { id: 'favorites', label: '★', visible: true, width: 70, order: 3 },
  { id: 'dimensions', label: 'Dimensions', visible: true, width: 100, order: 4 },
  { id: 'duration', label: 'Durée', visible: true, width: 60, order: 5 },
  { id: 'fps', label: 'FPS', visible: true, width: 50, order: 6 },
  { id: 'dvrTransferred', label: 'DVR', visible: true, width: 40, order: 7 },
  { id: 'isGenerated', label: 'IA', visible: true, width: 40, order: 8 },
  { id: 'fileSize', label: 'Taille', visible: true, width: 80, order: 9 },
  { id: 'scene', label: 'Scène', visible: false, width: 100, order: 10 },
  { id: 'decor', label: 'Décor', visible: false, width: 100, order: 11 },
  { id: 'description', label: 'Description', visible: false, width: 180, order: 12 },
  { id: 'format', label: 'Format', visible: false, width: 70, order: 13 },
  { id: 'modelId', label: 'Modèle', visible: false, width: 140, order: 14 },
  { id: 'prompt', label: 'Prompt', visible: false, width: 200, order: 15 },
  { id: 'aspectRatio', label: 'Ratio', visible: false, width: 70, order: 16 },
  { id: 'seed', label: 'Seed', visible: false, width: 90, order: 17 },
  { id: 'dvrProject', label: 'Projet DVR', visible: false, width: 120, order: 18 },
  { id: 'tags', label: 'Tags', visible: false, width: 120, order: 19 },
  { id: 'createdAt', label: 'Créé le', visible: false, width: 100, order: 20 },
  { id: 'updatedAt', label: 'Modifié le', visible: false, width: 100, order: 21 },
  { id: 'usedInProjects', label: 'Projets', visible: false, width: 80, order: 22 },
];

// Sections de la sidebar
export type SidebarSection = 'media' | 'collections' | 'generators' | 'history';

// Tri
export type SortDirection = 'asc' | 'desc';
export interface SortConfig {
  column: string;
  direction: SortDirection;
}

// Filtres
export interface MediaFilters {
  type?: MediaType[];
  isGenerated?: boolean;
  dvrTransferred?: boolean;
  search?: string;
  projectId?: string;
  orphans?: boolean; // Médias non utilisés dans aucun projet
}

// État du store
interface MediaLibraryState {
  // Sidebar
  isOpen: boolean;
  activeSection: SidebarSection;
  expandedSections: Record<SidebarSection, boolean>;
  sidebarWidth: number;
  fontSize: number; // 10-18 px
  
  // Médias
  medias: MediaItem[];
  selectedMediaIds: Set<string>;
  isLoading: boolean;
  lastRefresh: Date | null;
  
  // Configuration
  columns: ColumnConfig[];
  sort: SortConfig;
  filters: MediaFilters;
  lockedOrder: string[] | null; // Ordre verrouillé (IDs) pour éviter le re-tri
  
  // Actions sidebar
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
  setActiveSection: (section: SidebarSection) => void;
  toggleSection: (section: SidebarSection) => void;
  setSidebarWidth: (width: number) => void;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  
  // Actions médias
  fetchMedias: () => Promise<void>;
  selectMedia: (id: string) => void;
  deselectMedia: (id: string) => void;
  toggleMediaSelection: (id: string, shiftKey?: boolean, lastSelectedId?: string) => void;
  selectMediaRange: (fromId: string, toId: string) => void;
  clearSelection: () => void;
  updateMediaMetadata: (id: string, updates: Partial<MediaItem>) => Promise<boolean>;
  deleteSelectedMedias: () => Promise<{ deleted: number; errors: number }>;
  
  // Actions colonnes
  setColumnVisibility: (columnId: string, visible: boolean) => void;
  reorderColumns: (columns: ColumnConfig[]) => void;
  setColumnWidth: (columnId: string, width: number) => void;
  resetColumns: () => void;
  
  // Actions tri/filtres
  setSort: (column: string, direction?: SortDirection) => void;
  setFilters: (filters: MediaFilters) => void;
  clearFilters: () => void;
  lockCurrentOrder: () => void; // Verrouille l'ordre actuel pour éviter le re-tri
  
  // Utilitaires
  getFilteredMedias: () => MediaItem[];
  getSortedMedias: () => MediaItem[];
  getVisibleColumns: () => ColumnConfig[];
}

// Clés localStorage
const STORAGE_KEYS = {
  columns: 'tersa-media-library-columns',
  sort: 'tersa-media-library-sort',
  filters: 'tersa-media-library-filters',
  expandedSections: 'tersa-media-library-sections',
  sidebarWidth: 'tersa-media-library-width',
  fontSize: 'tersa-media-library-fontsize',
};

// Charger depuis localStorage
// Colonnes obsolètes à supprimer automatiquement
const OBSOLETE_COLUMNS = ['filename', 'path', 'width', 'height', 'Fichier'];

function loadFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return defaultValue;
    
    let parsed = JSON.parse(stored);
    
    // Migration automatique des colonnes : supprimer les colonnes obsolètes
    if (key === STORAGE_KEYS.columns && Array.isArray(parsed)) {
      const originalLength = parsed.length;
      parsed = parsed.filter((col: ColumnConfig) => 
        !OBSOLETE_COLUMNS.includes(col.id) && !OBSOLETE_COLUMNS.includes(col.label)
      );
      
      // Ajouter les nouvelles colonnes manquantes
      const existingIds = new Set(parsed.map((c: ColumnConfig) => c.id));
      for (const defaultCol of DEFAULT_COLUMNS) {
        if (!existingIds.has(defaultCol.id)) {
          parsed.push(defaultCol);
        }
      }
      
      // Si des changements ont été faits, sauvegarder
      if (parsed.length !== originalLength) {
        console.log('[MediaLibrary] Migration des colonnes: colonnes obsolètes supprimées');
        localStorage.setItem(key, JSON.stringify(parsed));
      }
    }
    
    return parsed;
  } catch {
    return defaultValue;
  }
}

// Sauvegarder dans localStorage
function saveToStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
}

export const useMediaLibraryStore = create<MediaLibraryState>((set, get) => ({
  // État initial
  isOpen: false,
  activeSection: 'media',
  expandedSections: loadFromStorage(STORAGE_KEYS.expandedSections, {
    media: true,
    collections: false,
    generators: false,
    history: false,
  }),
  sidebarWidth: loadFromStorage(STORAGE_KEYS.sidebarWidth, 800),
  fontSize: loadFromStorage(STORAGE_KEYS.fontSize, 11),
  
  medias: [],
  selectedMediaIds: new Set(),
  isLoading: false,
  lastRefresh: null,
  
  columns: loadFromStorage(STORAGE_KEYS.columns, DEFAULT_COLUMNS),
  sort: loadFromStorage(STORAGE_KEYS.sort, { column: 'createdAt', direction: 'desc' as SortDirection }),
  filters: loadFromStorage(STORAGE_KEYS.filters, {}),
  lockedOrder: null,

  // Actions sidebar
  openSidebar: () => set({ isOpen: true }),
  closeSidebar: () => set({ isOpen: false }),
  toggleSidebar: () => set((state) => ({ isOpen: !state.isOpen })),
  
  setActiveSection: (section) => set({ activeSection: section }),
  
  toggleSection: (section) => set((state) => {
    const newExpanded = {
      ...state.expandedSections,
      [section]: !state.expandedSections[section],
    };
    saveToStorage(STORAGE_KEYS.expandedSections, newExpanded);
    return { expandedSections: newExpanded };
  }),
  
  setSidebarWidth: (width) => {
    const clampedWidth = Math.max(400, Math.min(1200, width));
    saveToStorage(STORAGE_KEYS.sidebarWidth, clampedWidth);
    set({ sidebarWidth: clampedWidth });
  },
  
  increaseFontSize: () => set((state) => {
    const newSize = Math.min(18, state.fontSize + 1);
    saveToStorage(STORAGE_KEYS.fontSize, newSize);
    return { fontSize: newSize };
  }),
  
  decreaseFontSize: () => set((state) => {
    const newSize = Math.max(8, state.fontSize - 1);
    saveToStorage(STORAGE_KEYS.fontSize, newSize);
    return { fontSize: newSize };
  }),

  // Actions médias
  fetchMedias: async () => {
    set({ isLoading: true });
    
    try {
      const response = await fetch('/api/media-library');
      
      if (!response.ok) {
        throw new Error('Failed to fetch media library');
      }
      
      const data = await response.json();
      
      set({
        medias: data.medias || [],
        isLoading: false,
        lastRefresh: new Date(),
      });
    } catch (error) {
      console.error('Error fetching media library:', error);
      set({ isLoading: false });
    }
  },
  
  selectMedia: (id) => set((state) => ({
    selectedMediaIds: new Set([...Array.from(state.selectedMediaIds), id]),
  })),
  
  deselectMedia: (id) => set((state) => {
    const newSet = new Set(state.selectedMediaIds);
    newSet.delete(id);
    return { selectedMediaIds: newSet };
  }),
  
  toggleMediaSelection: (id) => set((state) => {
    const newSet = new Set(state.selectedMediaIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    return { selectedMediaIds: newSet };
  }),
  
  selectMediaRange: (fromId, toId) => set((state) => {
    // Utiliser getSortedMedias pour avoir le même ordre que l'affichage
    const sortedMedias = state.getSortedMedias();
    const fromIndex = sortedMedias.findIndex(m => m.id === fromId);
    const toIndex = sortedMedias.findIndex(m => m.id === toId);
    
    console.log('[MediaLibrary Store] selectMediaRange:', { fromId, toId, fromIndex, toIndex, totalMedias: sortedMedias.length });
    
    if (fromIndex === -1 || toIndex === -1) {
      console.log('[MediaLibrary Store] Invalid indices, returning');
      return state;
    }
    
    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);
    
    const newSet = new Set(state.selectedMediaIds);
    for (let i = start; i <= end; i++) {
      newSet.add(sortedMedias[i].id);
    }
    
    console.log('[MediaLibrary Store] Selected range:', { start, end, count: end - start + 1 });
    
    return { selectedMediaIds: newSet };
  }),
  
  clearSelection: () => set({ selectedMediaIds: new Set() }),
  
  deleteSelectedMedias: async () => {
    const { selectedMediaIds, medias } = get();
    let deleted = 0;
    let errors = 0;
    
    for (const id of Array.from(selectedMediaIds)) {
      const media = medias.find(m => m.id === id);
      if (!media) continue;
      
      try {
        // Supprimer via l'API trash (même comportement que Cleanup)
        const response = await fetch('/api/trash', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: media.path }),
        });
        
        if (response.ok) {
          deleted++;
        } else {
          errors++;
        }
      } catch (error) {
        console.error('Error deleting media:', error);
        errors++;
      }
    }
    
    // Retirer les médias supprimés de la liste
    if (deleted > 0) {
      set((state) => ({
        medias: state.medias.filter(m => !selectedMediaIds.has(m.id)),
        selectedMediaIds: new Set(),
      }));
    }
    
    return { deleted, errors };
  },
  
  updateMediaMetadata: async (id, updates) => {
    try {
      // Trouver le média pour obtenir son path
      const media = get().medias.find(m => m.id === id);
      if (!media) {
        console.error('Media not found locally:', id);
        return false;
      }
      
      const response = await fetch('/api/media-library', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, path: media.path, updates }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update media metadata');
      }
      
      // Mettre à jour localement
      set((state) => ({
        medias: state.medias.map((m) =>
          m.id === id ? { ...m, ...updates, updatedAt: new Date().toISOString() } : m
        ),
      }));
      
      return true;
    } catch (error) {
      console.error('Error updating media metadata:', error);
      return false;
    }
  },

  // Actions colonnes
  setColumnVisibility: (columnId, visible) => set((state) => {
    const newColumns = state.columns.map((c) =>
      c.id === columnId ? { ...c, visible } : c
    );
    saveToStorage(STORAGE_KEYS.columns, newColumns);
    return { columns: newColumns };
  }),
  
  reorderColumns: (columns) => {
    saveToStorage(STORAGE_KEYS.columns, columns);
    set({ columns });
  },
  
  setColumnWidth: (columnId, width) => set((state) => {
    const newColumns = state.columns.map((c) =>
      c.id === columnId ? { ...c, width } : c
    );
    saveToStorage(STORAGE_KEYS.columns, newColumns);
    return { columns: newColumns };
  }),
  
  resetColumns: () => {
    saveToStorage(STORAGE_KEYS.columns, DEFAULT_COLUMNS);
    set({ columns: DEFAULT_COLUMNS });
  },

  // Actions tri/filtres
  setSort: (column, direction) => set((state) => {
    let newDirection: SortDirection;
    
    if (direction) {
      // Direction explicitement fournie
      newDirection = direction;
    } else if (state.lockedOrder) {
      // Si l'ordre était verrouillé, on commence TOUJOURS par décroissant
      newDirection = 'desc';
    } else {
      // Toggle normal : décroissant par défaut, croissant si déjà décroissant sur cette colonne
      newDirection = (state.sort.column === column && state.sort.direction === 'desc') ? 'asc' : 'desc';
    }
    
    const newSort = { column, direction: newDirection };
    saveToStorage(STORAGE_KEYS.sort, newSort);
    // Déverrouiller l'ordre quand on change le tri manuellement
    return { sort: newSort, lockedOrder: null };
  }),
  
  setFilters: (filters) => set((state) => {
    const newFilters = { ...state.filters, ...filters };
    saveToStorage(STORAGE_KEYS.filters, newFilters);
    return { filters: newFilters };
  }),
  
  clearFilters: () => {
    saveToStorage(STORAGE_KEYS.filters, {});
    set({ filters: {} });
  },
  
  lockCurrentOrder: () => {
    // Capturer l'ordre actuel des médias triés
    const currentOrder = get().getSortedMedias().map(m => m.id);
    set({ lockedOrder: currentOrder });
  },

  // Utilitaires
  getFilteredMedias: () => {
    const { medias, filters } = get();
    
    return medias.filter((media) => {
      // Filtre par type
      if (filters.type?.length && !filters.type.includes(media.type)) {
        return false;
      }
      
      // Filtre par génération
      if (filters.isGenerated !== undefined && media.isGenerated !== filters.isGenerated) {
        return false;
      }
      
      // Filtre par DVR
      if (filters.dvrTransferred !== undefined && media.dvrTransferred !== filters.dvrTransferred) {
        return false;
      }
      
      // Filtre par recherche
      if (filters.search) {
        const search = filters.search.toLowerCase();
        const searchableFields = [
          media.name,
          media.filename,
          media.description,
          media.scene,
          media.decor,
          media.prompt,
          ...(media.tags || []),
        ].filter(Boolean).map((s) => s?.toLowerCase());
        
        if (!searchableFields.some((f) => f?.includes(search))) {
          return false;
        }
      }
      
      // Filtre par projet
      if (filters.projectId && !media.usedInProjects?.includes(filters.projectId)) {
        return false;
      }
      
      // Filtre médias orphelins (non utilisés dans aucun projet)
      if (filters.orphans === true) {
        if (media.usedInProjects && media.usedInProjects.length > 0) {
          return false;
        }
      }
      
      return true;
    });
  },
  
  getSortedMedias: () => {
    const filteredMedias = get().getFilteredMedias();
    const { sort, lockedOrder } = get();
    
    // Si l'ordre est verrouillé, utiliser cet ordre
    if (lockedOrder && lockedOrder.length > 0) {
      const orderMap = new Map(lockedOrder.map((id, index) => [id, index]));
      return [...filteredMedias].sort((a, b) => {
        const aIndex = orderMap.get(a.id) ?? Infinity;
        const bIndex = orderMap.get(b.id) ?? Infinity;
        return aIndex - bIndex;
      });
    }
    
    // Si pas de colonne de tri, retourner l'ordre actuel (pas de tri)
    if (!sort.column) {
      return filteredMedias;
    }
    
    return [...filteredMedias].sort((a, b) => {
      let aVal: unknown = a[sort.column as keyof MediaItem];
      let bVal: unknown = b[sort.column as keyof MediaItem];
      
      // Gestion des valeurs nulles
      if (aVal === undefined || aVal === null) aVal = '';
      if (bVal === undefined || bVal === null) bVal = '';
      
      // Comparaison
      let comparison = 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
        comparison = (aVal ? 1 : 0) - (bVal ? 1 : 0);
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }
      
      return sort.direction === 'asc' ? comparison : -comparison;
    });
  },
  
  getVisibleColumns: () => {
    const { columns } = get();
    return columns
      .filter((c) => c.visible)
      .sort((a, b) => a.order - b.order);
  },
}));

/**
 * Hook pour initialiser la Media Library
 */
export function useInitMediaLibrary() {
  const { fetchMedias, lastRefresh, isOpen } = useMediaLibraryStore();
  
  // Charger les médias quand la sidebar s'ouvre pour la première fois
  if (isOpen && !lastRefresh) {
    fetchMedias();
  }
}

