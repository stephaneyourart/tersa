/**
 * Store pour la bibliothèque de collections sauvegardées
 * Utilise localStorage pour persister les collections et catégories
 */

import type { CollectionItem, CollectionPreset } from '@/components/nodes/collection';

// Catégorie/dossier de collections
export interface CollectionCategory {
  id: string;
  name: string;
  color: string; // Couleur hex du header
  order: number;
}

// Collection sauvegardée
export interface SavedCollection {
  id: string;
  name: string;
  categoryId: string;
  items: CollectionItem[];
  presets: CollectionPreset[];
  createdAt: string;
  updatedAt: string;
}

// Structure complète de la bibliothèque
export interface CollectionsLibrary {
  categories: CollectionCategory[];
  collections: SavedCollection[];
}

const STORAGE_KEY = 'tersa-collections-library';

// Couleurs par défaut pour les catégories
export const DEFAULT_CATEGORY_COLORS = [
  '#F6C744', // Jaune (défaut)
  '#4CAF50', // Vert
  '#2196F3', // Bleu
  '#9C27B0', // Violet
  '#FF5722', // Orange
  '#E91E63', // Rose
  '#00BCD4', // Cyan
  '#795548', // Marron
];

/**
 * Génère un ID unique
 */
function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Récupère la bibliothèque complète
 */
export function getCollectionsLibrary(): CollectionsLibrary {
  if (typeof window === 'undefined') {
    return { categories: [], collections: [] };
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // Initialiser avec une catégorie par défaut
      const defaultLibrary: CollectionsLibrary = {
        categories: [
          { id: 'cat-default', name: 'Général', color: '#F6C744', order: 0 }
        ],
        collections: []
      };
      saveLibrary(defaultLibrary);
      return defaultLibrary;
    }
    return JSON.parse(stored) as CollectionsLibrary;
  } catch {
    console.error('Erreur lecture bibliothèque collections');
    return { categories: [], collections: [] };
  }
}

/**
 * Sauvegarde la bibliothèque
 */
function saveLibrary(library: CollectionsLibrary): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
  } catch (error) {
    console.error('Erreur sauvegarde bibliothèque:', error);
  }
}

// ==================== CATÉGORIES ====================

/**
 * Récupère toutes les catégories
 */
export function getCategories(): CollectionCategory[] {
  return getCollectionsLibrary().categories.sort((a, b) => a.order - b.order);
}

/**
 * Récupère une catégorie par ID
 */
export function getCategoryById(id: string): CollectionCategory | null {
  const library = getCollectionsLibrary();
  return library.categories.find(c => c.id === id) || null;
}

/**
 * Crée une nouvelle catégorie
 */
export function createCategory(name: string, color?: string): CollectionCategory {
  const library = getCollectionsLibrary();
  const maxOrder = Math.max(0, ...library.categories.map(c => c.order));
  
  const newCategory: CollectionCategory = {
    id: generateId('cat'),
    name,
    color: color || DEFAULT_CATEGORY_COLORS[library.categories.length % DEFAULT_CATEGORY_COLORS.length],
    order: maxOrder + 1,
  };
  
  library.categories.push(newCategory);
  saveLibrary(library);
  
  return newCategory;
}

/**
 * Met à jour une catégorie
 */
export function updateCategory(
  id: string, 
  updates: Partial<Pick<CollectionCategory, 'name' | 'color' | 'order'>>
): CollectionCategory | null {
  const library = getCollectionsLibrary();
  const index = library.categories.findIndex(c => c.id === id);
  
  if (index === -1) return null;
  
  library.categories[index] = {
    ...library.categories[index],
    ...updates,
  };
  
  saveLibrary(library);
  return library.categories[index];
}

/**
 * Supprime une catégorie (et ses collections)
 */
export function deleteCategory(id: string): boolean {
  const library = getCollectionsLibrary();
  const index = library.categories.findIndex(c => c.id === id);
  
  if (index === -1) return false;
  
  // Supprimer les collections de cette catégorie
  library.collections = library.collections.filter(c => c.categoryId !== id);
  library.categories.splice(index, 1);
  
  saveLibrary(library);
  return true;
}

// ==================== COLLECTIONS ====================

/**
 * Récupère toutes les collections d'une catégorie
 */
export function getCollectionsByCategory(categoryId: string): SavedCollection[] {
  const library = getCollectionsLibrary();
  return library.collections
    .filter(c => c.categoryId === categoryId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/**
 * Récupère une collection par ID
 */
export function getCollectionById(id: string): SavedCollection | null {
  const library = getCollectionsLibrary();
  return library.collections.find(c => c.id === id) || null;
}

/**
 * Sauvegarde une nouvelle collection
 */
export function saveCollection(
  name: string,
  categoryId: string,
  items: CollectionItem[],
  presets: CollectionPreset[] = []
): SavedCollection {
  const library = getCollectionsLibrary();
  
  const newCollection: SavedCollection = {
    id: generateId('col'),
    name,
    categoryId,
    items,
    presets,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  library.collections.push(newCollection);
  saveLibrary(library);
  
  return newCollection;
}

/**
 * Met à jour une collection existante
 */
export function updateSavedCollection(
  id: string,
  updates: Partial<Pick<SavedCollection, 'name' | 'categoryId' | 'items' | 'presets'>>
): SavedCollection | null {
  const library = getCollectionsLibrary();
  const index = library.collections.findIndex(c => c.id === id);
  
  if (index === -1) return null;
  
  library.collections[index] = {
    ...library.collections[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  saveLibrary(library);
  return library.collections[index];
}

/**
 * Supprime une collection
 */
export function deleteSavedCollection(id: string): boolean {
  const library = getCollectionsLibrary();
  const index = library.collections.findIndex(c => c.id === id);
  
  if (index === -1) return false;
  
  library.collections.splice(index, 1);
  saveLibrary(library);
  
  return true;
}

/**
 * Duplique une collection
 */
export function duplicateCollection(id: string): SavedCollection | null {
  const collection = getCollectionById(id);
  if (!collection) return null;
  
  return saveCollection(
    `${collection.name} (copy)`,
    collection.categoryId,
    collection.items,
    collection.presets
  );
}

