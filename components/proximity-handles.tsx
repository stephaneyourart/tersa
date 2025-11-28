/**
 * Composant qui "allume" les handles proches du curseur
 * Style Flora - les connecteurs s'activent dans une zone autour du pointeur
 */

'use client';

import { useEffect, useCallback, useRef } from 'react';

const PROXIMITY_RADIUS = 150; // Rayon de détection en pixels

export function ProximityHandles() {
  const rafRef = useRef<number | null>(null);
  const lastPosition = useRef({ x: 0, y: 0 });

  const updateHandlesProximity = useCallback((clientX: number, clientY: number) => {
    // Récupérer tous les handles
    const handles = document.querySelectorAll('.react-flow__handle');
    
    handles.forEach((handle) => {
      const rect = handle.getBoundingClientRect();
      const handleCenterX = rect.left + rect.width / 2;
      const handleCenterY = rect.top + rect.height / 2;
      
      // Calculer la distance entre le curseur et le handle
      const distance = Math.sqrt(
        Math.pow(clientX - handleCenterX, 2) + 
        Math.pow(clientY - handleCenterY, 2)
      );
      
      // Activer/désactiver le handle selon la proximité
      if (distance < PROXIMITY_RADIUS) {
        // Calculer l'intensité (plus proche = plus visible)
        const intensity = 1 - (distance / PROXIMITY_RADIUS);
        handle.classList.add('handle-proximity-active');
        (handle as HTMLElement).style.setProperty('--proximity-intensity', intensity.toString());
      } else {
        handle.classList.remove('handle-proximity-active');
        (handle as HTMLElement).style.removeProperty('--proximity-intensity');
      }
    });
  }, []);

  const handlePointerMove = useCallback((e: PointerEvent | TouchEvent) => {
    let clientX: number;
    let clientY: number;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    lastPosition.current = { x: clientX, y: clientY };
    
    // Utiliser requestAnimationFrame pour éviter trop de calculs
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    
    rafRef.current = requestAnimationFrame(() => {
      updateHandlesProximity(clientX, clientY);
    });
  }, [updateHandlesProximity]);

  const handlePointerLeave = useCallback(() => {
    // Désactiver tous les handles quand le curseur quitte la zone
    const handles = document.querySelectorAll('.react-flow__handle');
    handles.forEach((handle) => {
      handle.classList.remove('handle-proximity-active');
      (handle as HTMLElement).style.removeProperty('--proximity-intensity');
    });
  }, []);

  useEffect(() => {
    // Écouter les mouvements de souris et touch
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('touchmove', handlePointerMove as EventListener);
    document.addEventListener('pointerleave', handlePointerLeave);
    
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('touchmove', handlePointerMove as EventListener);
      document.removeEventListener('pointerleave', handlePointerLeave);
      
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [handlePointerMove, handlePointerLeave]);

  return null; // Ce composant ne rend rien, il gère juste les événements
}

