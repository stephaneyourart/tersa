'use client';

// ========== LOD DÉSACTIVÉ ==========
// Le système de Level of Detail était trop complexe et causait des problèmes de performance.
// Avec 224+ nœuds, les limites de React sont atteintes.
// Les autres optimisations (debounce save, structuredClone, onlyRenderVisibleElements) restent actives.

export function updateViewportZoom(_zoom: number) {
  // Désactivé
}

export function onViewportMoveStart() {
  // Désactivé
}

export function onViewportMoveEnd() {
  // Désactivé
}

// Hook qui retourne toujours "render = true" pour désactiver le LOD
export function useShouldRenderContent(): {
  shouldRender: boolean;
  isZoomedOut: boolean;
  isMoving: boolean;
} {
  return {
    shouldRender: true, // Toujours rendre
    isZoomedOut: false,
    isMoving: false,
  };
}
