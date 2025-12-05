/**
 * Gestion des groupes de nœuds sauvegardés
 * Permet de sauvegarder et réutiliser des patterns de nœuds
 */

import type { Node, Edge } from '@xyflow/react';

export interface SavedGroup {
  id: string;
  name: string;
  description?: string;
  color?: string;
  nodes: Node[];
  edges: Edge[];
  nodeCount?: number;
  createdAt: string;
  updatedAt: string;
  thumbnail?: string;
}

const STORAGE_KEY = 'tersa_saved_groups';

/**
 * Charge tous les groupes sauvegardés
 */
export function loadGroups(): SavedGroup[] {
  return getSavedGroups();
}

/**
 * Alias pour loadGroups
 */
export function getSavedGroups(): SavedGroup[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Sauvegarde un groupe
 */
export function saveGroup(group: SavedGroup): void {
  if (typeof window === 'undefined') return;
  
  const groups = loadGroups();
  const index = groups.findIndex(g => g.id === group.id);
  
  if (index >= 0) {
    groups[index] = group;
  } else {
    groups.push(group);
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
}

/**
 * Supprime un groupe
 */
export function deleteGroup(groupId: string): void {
  if (typeof window === 'undefined') return;
  
  const groups = getSavedGroups().filter(g => g.id !== groupId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
}

/**
 * Alias pour deleteGroup
 */
export function deleteSavedGroup(groupId: string): void {
  deleteGroup(groupId);
}

/**
 * Renomme un groupe
 */
export function renameSavedGroup(groupId: string, newName: string): void {
  if (typeof window === 'undefined') return;
  
  const groups = getSavedGroups();
  const group = groups.find(g => g.id === groupId);
  if (group) {
    group.name = newName;
    group.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
  }
}

/**
 * Prépare les nœuds d'un groupe pour insertion dans le canvas
 * Génère de nouveaux IDs et ajuste les positions
 */
export function prepareGroupNodesForCanvas(
  group: SavedGroup,
  targetPosition: { x: number; y: number }
): { nodes: Node[]; edges: Edge[] } {
  const idMap = new Map<string, string>();
  
  // Calculer le centre du groupe original
  const bounds = group.nodes.reduce(
    (acc, node) => ({
      minX: Math.min(acc.minX, node.position.x),
      minY: Math.min(acc.minY, node.position.y),
      maxX: Math.max(acc.maxX, node.position.x),
      maxY: Math.max(acc.maxY, node.position.y),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );
  
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  
  // Créer les nouveaux nœuds avec nouveaux IDs et positions ajustées
  const newNodes = group.nodes.map(node => {
    const newId = `${node.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    idMap.set(node.id, newId);
    
    return {
      ...node,
      id: newId,
      position: {
        x: node.position.x - centerX + targetPosition.x,
        y: node.position.y - centerY + targetPosition.y,
      },
    };
  });
  
  // Créer les nouveaux edges avec les IDs mis à jour
  const newEdges = group.edges.map(edge => ({
    ...edge,
    id: `${edge.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    source: idMap.get(edge.source) || edge.source,
    target: idMap.get(edge.target) || edge.target,
  }));
  
  return { nodes: newNodes, edges: newEdges };
}
