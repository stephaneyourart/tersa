'use client';

/**
 * Provider pour la mise en évidence des connexions au hover
 * 
 * Quand un nœud est survolé :
 * - Sa bordure est grossie (x3)
 * - Les liens entrants/sortants sont grossis
 * - Les bordures des nœuds connectés sont grossies
 */

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import { useReactFlow } from '@xyflow/react';

interface HoveredNodeContextValue {
  // ID du nœud survolé
  hoveredNodeId: string | null;
  // IDs des nœuds connectés (entrants + sortants)
  connectedNodeIds: Set<string>;
  // IDs des edges connectés
  connectedEdgeIds: Set<string>;
  // Callbacks
  onNodeHover: (nodeId: string | null) => void;
  // Helpers pour vérifier si un élément est mis en évidence
  isNodeHighlighted: (nodeId: string) => boolean;
  isEdgeHighlighted: (edgeId: string) => boolean;
}

const HoveredNodeContext = createContext<HoveredNodeContextValue | null>(null);

export function HoveredNodeProvider({ children }: { children: ReactNode }) {
  const { getEdges } = useReactFlow();
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [connectedNodeIds, setConnectedNodeIds] = useState<Set<string>>(new Set());
  const [connectedEdgeIds, setConnectedEdgeIds] = useState<Set<string>>(new Set());

  const onNodeHover = useCallback((nodeId: string | null) => {
    setHoveredNodeId(nodeId);

    if (!nodeId) {
      setConnectedNodeIds(new Set());
      setConnectedEdgeIds(new Set());
      return;
    }

    // Trouver tous les edges et nœuds connectés
    const edges = getEdges();
    const nodeIds = new Set<string>();
    const edgeIds = new Set<string>();

    for (const edge of edges) {
      if (edge.source === nodeId) {
        // Edge sortant
        nodeIds.add(edge.target);
        edgeIds.add(edge.id);
      } else if (edge.target === nodeId) {
        // Edge entrant
        nodeIds.add(edge.source);
        edgeIds.add(edge.id);
      }
    }

    setConnectedNodeIds(nodeIds);
    setConnectedEdgeIds(edgeIds);
  }, [getEdges]);

  const isNodeHighlighted = useCallback((nodeId: string) => {
    return nodeId === hoveredNodeId || connectedNodeIds.has(nodeId);
  }, [hoveredNodeId, connectedNodeIds]);

  const isEdgeHighlighted = useCallback((edgeId: string) => {
    return connectedEdgeIds.has(edgeId);
  }, [connectedEdgeIds]);

  const value = useMemo(() => ({
    hoveredNodeId,
    connectedNodeIds,
    connectedEdgeIds,
    onNodeHover,
    isNodeHighlighted,
    isEdgeHighlighted,
  }), [hoveredNodeId, connectedNodeIds, connectedEdgeIds, onNodeHover, isNodeHighlighted, isEdgeHighlighted]);

  return (
    <HoveredNodeContext.Provider value={value}>
      {children}
    </HoveredNodeContext.Provider>
  );
}

export function useHoveredNode() {
  const context = useContext(HoveredNodeContext);
  if (!context) {
    throw new Error('useHoveredNode must be used within HoveredNodeProvider');
  }
  return context;
}

// Hook optionnel qui ne throw pas si hors du provider (pour les edges)
export function useHoveredNodeOptional() {
  return useContext(HoveredNodeContext);
}

