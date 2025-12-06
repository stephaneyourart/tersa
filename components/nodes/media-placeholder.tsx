'use client';

import { cn } from '@/lib/utils';

interface MediaPlaceholderProps {
  isMoving?: boolean;
  isZoomedOut?: boolean;
  className?: string;
}

/**
 * Placeholder affiché quand le contenu média n'est pas rendu
 * - En mouvement: shimmer animé
 * - Zoom out: fond gris statique
 */
export function MediaPlaceholder({ 
  isMoving = false, 
  isZoomedOut = false,
  className 
}: MediaPlaceholderProps) {
  if (isMoving) {
    // Shimmer animé pendant le mouvement
    return (
      <div 
        className={cn(
          "absolute inset-0 bg-gradient-to-r from-muted via-muted-foreground/10 to-muted",
          "animate-shimmer bg-[length:200%_100%]",
          className
        )}
        style={{
          animation: 'shimmer 1.5s ease-in-out infinite',
        }}
      />
    );
  }
  
  if (isZoomedOut) {
    // Fond gris statique quand on est trop loin
    return (
      <div 
        className={cn(
          "absolute inset-0 bg-muted/80 flex items-center justify-center",
          className
        )}
      >
        <div className="w-8 h-8 rounded bg-muted-foreground/20" />
      </div>
    );
  }
  
  // Placeholder de chargement par défaut
  return (
    <div 
      className={cn(
        "absolute inset-0 bg-muted/50 flex items-center justify-center",
        className
      )}
    >
      <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
    </div>
  );
}
