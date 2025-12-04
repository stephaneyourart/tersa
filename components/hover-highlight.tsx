'use client';

/**
 * Composant qui gère le highlight des connexions au hover
 * 
 * APPROCHE : Manipulation directe du DOM (comme ProximityHandles)
 * - Pas de state React = pas de re-render = pas de clignotement
 * - Ajoute des classes CSS pour le styling
 * 
 * Quand un nœud est survolé :
 * - Le nœud reçoit la classe "node-hovered"
 * - Les nœuds connectés reçoivent "node-highlighted"
 * - Les edges connectés reçoivent "edge-highlighted"
 */

import { useEffect, useCallback, useRef } from 'react';

export function HoverHighlight() {
  const currentHoveredId = useRef<string | null>(null);

  const clearHighlights = useCallback(() => {
    // Retirer toutes les classes de highlight
    document.querySelectorAll('.node-hovered').forEach(el => el.classList.remove('node-hovered'));
    document.querySelectorAll('.node-highlighted').forEach(el => el.classList.remove('node-highlighted'));
    document.querySelectorAll('.edge-highlighted').forEach(el => el.classList.remove('edge-highlighted'));
    
    // Retirer l'attribut du container
    const flowContainer = document.querySelector('.react-flow');
    if (flowContainer) {
      flowContainer.removeAttribute('data-hovered-node');
    }
    
    currentHoveredId.current = null;
  }, []);

  const highlightConnections = useCallback((nodeId: string) => {
    if (currentHoveredId.current === nodeId) return;
    
    // Nettoyer les highlights précédents
    clearHighlights();
    
    currentHoveredId.current = nodeId;
    
    // Marquer le container ReactFlow
    const flowContainer = document.querySelector('.react-flow');
    if (flowContainer) {
      flowContainer.setAttribute('data-hovered-node', nodeId);
    }
    
    // Marquer le nœud survolé
    const hoveredNode = document.querySelector(`[data-id="${nodeId}"]`);
    if (hoveredNode) {
      hoveredNode.classList.add('node-hovered');
    }
    
    // Trouver et marquer les edges connectés
    const connectedNodeIds = new Set<string>();
    
    document.querySelectorAll('.flora-edge-group').forEach(edgeGroup => {
      const source = edgeGroup.getAttribute('data-source');
      const target = edgeGroup.getAttribute('data-target');
      
      if (source === nodeId || target === nodeId) {
        edgeGroup.classList.add('edge-highlighted');
        
        // Collecter les IDs des nœuds connectés
        if (source === nodeId && target) {
          connectedNodeIds.add(target);
        } else if (target === nodeId && source) {
          connectedNodeIds.add(source);
        }
      }
    });
    
    // Marquer les nœuds connectés
    connectedNodeIds.forEach(connectedId => {
      const connectedNode = document.querySelector(`[data-id="${connectedId}"]`);
      if (connectedNode) {
        connectedNode.classList.add('node-highlighted');
      }
    });
  }, [clearHighlights]);

  useEffect(() => {
    const handleMouseOver = (e: MouseEvent) => {
      // Chercher le nœud ReactFlow parent
      const target = e.target as HTMLElement;
      const nodeElement = target.closest('.react-flow__node');
      
      if (nodeElement) {
        const nodeId = nodeElement.getAttribute('data-id');
        if (nodeId) {
          highlightConnections(nodeId);
        }
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const relatedTarget = e.relatedTarget as HTMLElement | null;
      
      // Vérifier si on quitte vraiment le nœud (pas juste un enfant)
      const nodeElement = target.closest('.react-flow__node');
      const relatedNodeElement = relatedTarget?.closest('.react-flow__node');
      
      if (nodeElement && nodeElement !== relatedNodeElement) {
        // On quitte le nœud pour aller ailleurs
        clearHighlights();
      }
    };

    // Écouter sur le container ReactFlow
    const flowContainer = document.querySelector('.react-flow');
    if (flowContainer) {
      flowContainer.addEventListener('mouseover', handleMouseOver as EventListener);
      flowContainer.addEventListener('mouseout', handleMouseOut as EventListener);
    }

    return () => {
      if (flowContainer) {
        flowContainer.removeEventListener('mouseover', handleMouseOver as EventListener);
        flowContainer.removeEventListener('mouseout', handleMouseOut as EventListener);
      }
      clearHighlights();
    };
  }, [highlightConnections, clearHighlights]);

  return null; // Ce composant ne rend rien
}

