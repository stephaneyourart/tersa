'use client';

import { cn } from '@/lib/utils';

interface DurationBadgeProps {
  duration?: number; // en secondes
  position?: 'top-right' | 'bottom-right';
  className?: string;
}

/**
 * Badge affichant la durée de la vidéo
 * Format: "5s", "10s", "1:30", etc.
 */
export function DurationBadge({ 
  duration = 5, 
  position = 'top-right',
  className 
}: DurationBadgeProps) {
  // Formater la durée
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${mins}m`;
  };

  const positionClasses = position === 'top-right' 
    ? 'top-2 right-2' 
    : 'bottom-2 right-2';

  return (
    <div 
      className={cn(
        "absolute z-10",
        positionClasses,
        "px-1.5 py-0.5 rounded",
        "bg-black/70 backdrop-blur-sm",
        "text-[10px] font-medium text-white tabular-nums",
        "border border-white/10",
        className
      )}
    >
      {formatDuration(duration)}
    </div>
  );
}
