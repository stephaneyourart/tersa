'use client';

/**
 * OPTIMISATION CRITIQUE : Un seul observer pour le zoom
 * 
 * Problème : 224 nœuds qui observent le zoom = 224 sélecteurs par frame = LAG
 * Solution : 1 observer qui met à jour un store Zustand + les nœuds lisent le store
 * 
 * AUSSI : Détecte quand on est EN TRAIN de zoomer pour cacher les edges
 */

import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '@xyflow/react';
import { create } from 'zustand';

// ========== CONSTANTES ==========
const ZOOM_SIMPLIFIED = 0.10;  // 10% - très zoomé out
const ZOOM_MEDIUM = 0.30;
const ZOOM_STABLE_DELAY = 100; // ms avant de considérer le zoom stable

export type ZoomLevel = 'simplified' | 'medium' | 'full';

function getZoomLevel(zoom: number): ZoomLevel {
  if (zoom < ZOOM_SIMPLIFIED) return 'simplified';
  if (zoom < ZOOM_MEDIUM) return 'medium';
  return 'full';
}

// ========== STORE ZUSTAND GLOBAL ==========
interface ZoomLevelStore {
  zoomLevel: ZoomLevel;
  isZooming: boolean;
  setZoomLevel: (level: ZoomLevel) => void;
  setIsZooming: (zooming: boolean) => void;
}

export const useZoomLevelStore = create<ZoomLevelStore>((set) => ({
  zoomLevel: 'full',
  isZooming: false,
  setZoomLevel: (level) => set({ zoomLevel: level }),
  setIsZooming: (zooming) => set({ isZooming: zooming }),
}));

// ========== HOOK POUR LES NŒUDS ==========
export function useGlobalZoomLevel(): ZoomLevel {
  return useZoomLevelStore((state) => state.zoomLevel);
}

// ========== OBSERVER UNIQUE ==========
export function ZoomLevelObserver() {
  const lastLevelRef = useRef<ZoomLevel | null>(null);
  const lastZoomRef = useRef<number | null>(null);
  const zoomStableTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const setZoomLevel = useZoomLevelStore((state) => state.setZoomLevel);
  const setIsZooming = useZoomLevelStore((state) => state.setIsZooming);
  
  // Observer le zoom brut - très réactif
  const currentZoom = useStore(
    (state) => state.transform[2],
    // Déclencher dès le moindre changement de zoom
    (prev, next) => prev === next
  );
  
  const zoomLevel = getZoomLevel(currentZoom);

  // Marquer comme "en train de zoomer" et reset après délai
  const handleZoomChange = useCallback(() => {
    const flowContainer = document.querySelector('.react-flow');
    
    // Seulement si le zoom a vraiment changé (pas le pan) - seuil très bas
    if (lastZoomRef.current !== null && currentZoom !== lastZoomRef.current) {
      // On zoome !
      setIsZooming(true);
      if (flowContainer) {
        flowContainer.setAttribute('data-zooming', 'true');
      }
      
      // Annuler le timeout précédent
      if (zoomStableTimeoutRef.current) {
        clearTimeout(zoomStableTimeoutRef.current);
      }
      
      // Remettre les edges après stabilisation
      zoomStableTimeoutRef.current = setTimeout(() => {
        setIsZooming(false);
        if (flowContainer) {
          flowContainer.removeAttribute('data-zooming');
        }
      }, ZOOM_STABLE_DELAY);
    }
    
    lastZoomRef.current = currentZoom;
  }, [currentZoom, setIsZooming]);

  useEffect(() => {
    handleZoomChange();
  }, [handleZoomChange]);

  // Mettre à jour le niveau de zoom (pour les nœuds simplifiés)
  useEffect(() => {
    if (lastLevelRef.current === zoomLevel) return;
    lastLevelRef.current = zoomLevel;
    
    setZoomLevel(zoomLevel);
    
    const flowContainer = document.querySelector('.react-flow');
    if (flowContainer) {
      flowContainer.setAttribute('data-zoom-level', zoomLevel);
    }
  }, [zoomLevel, setZoomLevel]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (zoomStableTimeoutRef.current) {
        clearTimeout(zoomStableTimeoutRef.current);
      }
      const flowContainer = document.querySelector('.react-flow');
      if (flowContainer) {
        flowContainer.removeAttribute('data-zoom-level');
        flowContainer.removeAttribute('data-zooming');
      }
    };
  }, []);

  return null;
}
