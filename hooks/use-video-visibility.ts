'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Hook pour détecter si un élément est visible dans le viewport.
 * Utilisé pour pauser les vidéos hors écran et économiser les ressources.
 */
export function useVideoVisibility(options?: IntersectionObserverInit) {
  const ref = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      {
        // Marge autour du viewport pour pré-charger légèrement avant
        rootMargin: '100px',
        threshold: 0.1,
        ...options,
      }
    );
    
    observer.observe(element);
    
    return () => {
      observer.disconnect();
    };
  }, [options]);
  
  return { ref, isVisible };
}

/**
 * Hook pour gérer le hover sur un élément vidéo.
 * Retourne isHovered et les handlers à attacher.
 */
export function useVideoHover() {
  const [isHovered, setIsHovered] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const handleMouseEnter = useCallback(() => {
    // Petit délai pour éviter les activations accidentelles
    timeoutRef.current = setTimeout(() => {
      setIsHovered(true);
    }, 150);
  }, []);
  
  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsHovered(false);
  }, []);
  
  // Cleanup
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return {
    isHovered,
    hoverProps: {
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
    },
  };
}
