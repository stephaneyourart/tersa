/**
 * Skeleton avec remplissage progressif pendant la génération
 * Style Flora - animation de vague qui monte progressivement
 */

'use client';

import { cn } from '@/lib/utils';
import { Loader2Icon } from 'lucide-react';
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
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = startTime || Date.now();
    
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsedSeconds = (now - start) / 1000;
      setElapsed(Math.floor(elapsedSeconds));
      
      // Progression qui ralentit vers la fin (asymptotique vers 95%)
      // Utilise une courbe logarithmique pour un effet naturel
      const rawProgress = 1 - Math.exp(-elapsedSeconds / (estimatedDuration * 0.5));
      const cappedProgress = Math.min(rawProgress * 95, 95); // Max 95%
      
      setProgress(cappedProgress);
    }, 100);

    return () => clearInterval(interval);
  }, [startTime, estimatedDuration]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <div className={cn(
      'relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl bg-zinc-900',
      className
    )}>
      {/* Fond de remplissage progressif - vague qui monte */}
      <div 
        className="absolute inset-0 bg-gradient-to-t from-zinc-700/50 via-zinc-700/30 to-transparent transition-all duration-300 ease-out"
        style={{ 
          height: `${progress}%`,
          bottom: 0,
          top: 'auto',
        }}
      />
      
      {/* Effet de vague animée sur le bord supérieur */}
      <div 
        className="absolute left-0 right-0 h-4 opacity-60"
        style={{ 
          bottom: `${progress}%`,
          background: 'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)',
          animation: 'wave 2s ease-in-out infinite',
        }}
      />
      
      {/* Contenu central */}
      <div className="relative z-10 flex flex-col items-center gap-3">
        <Loader2Icon className="h-8 w-8 animate-spin text-white/70" />
        <div className="flex flex-col items-center gap-1">
          <span className="text-sm font-medium text-white/80">
            {Math.round(progress)}%
          </span>
          <span className="text-xs text-white/50">
            {formatTime(elapsed)}
          </span>
        </div>
      </div>

      {/* Style pour l'animation de vague */}
      <style jsx>{`
        @keyframes wave {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-4px);
          }
        }
      `}</style>
    </div>
  );
}

