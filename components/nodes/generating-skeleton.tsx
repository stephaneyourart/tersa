/**
 * Skeleton avec remplissage progressif pendant la génération
 * Remplissage pourpre sombre qui monte progressivement
 */

'use client';

import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

interface GeneratingSkeletonProps {
  className?: string;
  estimatedDuration?: number; // Durée estimée en secondes
  startTime?: number; // Timestamp de début
}

export function GeneratingSkeleton({ 
  className,
  estimatedDuration = 30, // 30 secondes par défaut
  startTime,
}: GeneratingSkeletonProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const start = startTime || Date.now();
    
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsedSeconds = (now - start) / 1000;
      
      // Progression qui ralentit vers la fin (asymptotique vers 95%)
      // Utilise une courbe logarithmique pour un effet naturel
      const rawProgress = 1 - Math.exp(-elapsedSeconds / (estimatedDuration * 0.5));
      const cappedProgress = Math.min(rawProgress * 95, 95); // Max 95%
      
      setProgress(cappedProgress);
    }, 100);

    return () => clearInterval(interval);
  }, [startTime, estimatedDuration]);

  return (
    <div className={cn(
      'relative flex aspect-video w-full items-center justify-center overflow-hidden bg-zinc-950',
      className
    )}>
      {/* Fond de remplissage progressif pourpre sombre avec gradient */}
      <div 
        className="absolute inset-x-0 bottom-0 transition-all duration-500 ease-out"
        style={{ 
          height: `${progress}%`,
          background: 'linear-gradient(to top, rgba(88, 28, 135, 0.9) 0%, rgba(126, 34, 206, 0.6) 40%, rgba(147, 51, 234, 0.3) 70%, rgba(168, 85, 247, 0.1) 100%)',
        }}
      />
      
      {/* Lueur subtile sur le bord supérieur du remplissage */}
      <div 
        className="absolute left-0 right-0 h-px transition-all duration-500 ease-out"
        style={{ 
          bottom: `${progress}%`,
          background: 'linear-gradient(90deg, transparent 0%, rgba(168, 85, 247, 0.5) 50%, transparent 100%)',
          boxShadow: '0 0 20px 2px rgba(147, 51, 234, 0.4)',
        }}
      />
    </div>
  );
}

