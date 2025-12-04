/**
 * Skeleton avec remplissage progressif pendant la génération
 * 
 * CODE COULEUR UNIFIÉ :
 * - image / image-edit : Vert Matrix (#00ff41)
 * - video : Fuchsia (#d946ef)
 * 
 * OPTIMISÉ : Interval de 1s (au lieu de 100ms) avec transition CSS fluide
 */

'use client';

import { cn } from '@/lib/utils';
import { useEffect, useState, memo, useRef } from 'react';

// Presets de couleurs - CODE COULEUR UNIFIÉ
const COLOR_PRESETS = {
  // Images = Vert Matrix
  image: {
    gradient: 'linear-gradient(to top, rgba(0, 255, 65, 0.9) 0%, rgba(34, 197, 94, 0.6) 40%, rgba(52, 211, 153, 0.3) 70%, rgba(110, 231, 183, 0.1) 100%)',
    glow: 'linear-gradient(90deg, transparent 0%, rgba(0, 255, 65, 0.5) 50%, transparent 100%)',
    shadow: '0 0 20px 2px rgba(0, 255, 65, 0.4)',
  },
  // Vidéos = Fuchsia
  video: {
    gradient: 'linear-gradient(to top, rgba(217, 70, 239, 0.9) 0%, rgba(168, 85, 247, 0.6) 40%, rgba(192, 132, 252, 0.3) 70%, rgba(216, 180, 254, 0.1) 100%)',
    glow: 'linear-gradient(90deg, transparent 0%, rgba(217, 70, 239, 0.5) 50%, transparent 100%)',
    shadow: '0 0 20px 2px rgba(217, 70, 239, 0.4)',
  },
  // Alias pour rétrocompatibilité
  violet: {
    gradient: 'linear-gradient(to top, rgba(0, 255, 65, 0.9) 0%, rgba(34, 197, 94, 0.6) 40%, rgba(52, 211, 153, 0.3) 70%, rgba(110, 231, 183, 0.1) 100%)',
    glow: 'linear-gradient(90deg, transparent 0%, rgba(0, 255, 65, 0.5) 50%, transparent 100%)',
    shadow: '0 0 20px 2px rgba(0, 255, 65, 0.4)',
  },
  amber: {
    gradient: 'linear-gradient(to top, rgba(0, 255, 65, 0.9) 0%, rgba(34, 197, 94, 0.6) 40%, rgba(52, 211, 153, 0.3) 70%, rgba(110, 231, 183, 0.1) 100%)',
    glow: 'linear-gradient(90deg, transparent 0%, rgba(0, 255, 65, 0.5) 50%, transparent 100%)',
    shadow: '0 0 20px 2px rgba(0, 255, 65, 0.4)',
  },
  emerald: {
    gradient: 'linear-gradient(to top, rgba(217, 70, 239, 0.9) 0%, rgba(168, 85, 247, 0.6) 40%, rgba(192, 132, 252, 0.3) 70%, rgba(216, 180, 254, 0.1) 100%)',
    glow: 'linear-gradient(90deg, transparent 0%, rgba(217, 70, 239, 0.5) 50%, transparent 100%)',
    shadow: '0 0 20px 2px rgba(217, 70, 239, 0.4)',
  },
};

interface GeneratingSkeletonProps {
  className?: string;
  estimatedDuration?: number; // Durée estimée en secondes
  startTime?: number; // Timestamp de début
  color?: 'image' | 'video' | 'violet' | 'amber' | 'emerald'; // Type de média
}

// Mémorisé pour éviter les re-renders inutiles
export const GeneratingSkeleton = memo(function GeneratingSkeleton({ 
  className,
  estimatedDuration = 30, // 30 secondes par défaut
  startTime,
  color = 'image', // Image (vert) par défaut
}: GeneratingSkeletonProps) {
  const [progress, setProgress] = useState(0);
  const colorPreset = COLOR_PRESETS[color];
  const startRef = useRef(startTime || Date.now());

  useEffect(() => {
    // Capturer le temps de départ une seule fois
    if (startTime) {
      startRef.current = startTime;
    }
    
    // Calculer la progression initiale
    const calculateProgress = () => {
      const now = Date.now();
      const elapsedSeconds = (now - startRef.current) / 1000;
      
      // Progression qui ralentit vers la fin (asymptotique vers 95%)
      const rawProgress = 1 - Math.exp(-elapsedSeconds / (estimatedDuration * 0.5));
      return Math.min(rawProgress * 95, 95); // Max 95%
    };
    
    // Set initial progress
    setProgress(calculateProgress());
    
    // Update toutes les 1 seconde (au lieu de 100ms)
    // La transition CSS de 1s rend l'animation fluide
    const interval = setInterval(() => {
      setProgress(calculateProgress());
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, estimatedDuration]);

  return (
    <div className={cn(
      'relative flex aspect-video w-full items-center justify-center overflow-hidden bg-zinc-900/80',
      className
    )}>
      {/* Fond de remplissage progressif avec gradient coloré */}
      <div 
        className="absolute inset-x-0 bottom-0 transition-all duration-1000 ease-out"
        style={{ 
          height: `${progress}%`,
          background: colorPreset.gradient,
        }}
      />
      
      {/* Lueur subtile sur le bord supérieur du remplissage */}
      <div 
        className="absolute left-0 right-0 h-px transition-all duration-1000 ease-out"
        style={{ 
          bottom: `${progress}%`,
          background: colorPreset.glow,
          boxShadow: colorPreset.shadow,
        }}
      />
    </div>
  );
});

