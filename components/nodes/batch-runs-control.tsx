/**
 * Contrôle du nombre de runs parallèles (comme Flora AI)
 * S'affiche au hover d'un node pour permettre de lancer N runs en parallèle
 */

'use client';

import { cn } from '@/lib/utils';
import { MinusIcon, PlusIcon, PlayIcon } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

type BatchRunsControlProps = {
  nodeId: string;
  isVisible: boolean;
  onRun?: (count: number) => void;
  maxRuns?: number;
  className?: string;
  onHoverChange?: (isHovered: boolean) => void;
};

export function BatchRunsControl({
  nodeId,
  isVisible,
  onRun,
  maxRuns = 10,
  className,
  onHoverChange,
}: BatchRunsControlProps) {
  const [count, setCount] = useState(1);
  const [isControlHovered, setIsControlHovered] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const increment = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCount((prev) => Math.min(prev + 1, maxRuns));
  };

  const decrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCount((prev) => Math.max(prev - 1, 1));
  };

  const handleRun = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRun) {
      onRun(count);
    }
  };

  const handleMouseEnter = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setIsControlHovered(true);
    onHoverChange?.(true);
  };

  const handleMouseLeave = () => {
    // Petit délai pour permettre de revenir sur le contrôle
    hideTimeoutRef.current = setTimeout(() => {
      setIsControlHovered(false);
      onHoverChange?.(false);
    }, 150);
  };

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  // Afficher si le node est hovered OU si le contrôle lui-même est hovered
  const shouldShow = isVisible || isControlHovered;

  return (
    <>
      {/* Zone de hover invisible pour relier le node au contrôle */}
      <div
        className={cn(
          'absolute -right-0 top-0 bottom-0 w-20 z-40',
          shouldShow ? 'pointer-events-auto' : 'pointer-events-none'
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />
      
      <div
        className={cn(
          'absolute -right-3 top-1/2 -translate-y-1/2 translate-x-full z-50',
          'flex flex-col items-center gap-2',
          'transition-all duration-200',
          shouldShow ? 'opacity-100' : 'opacity-0 pointer-events-none',
          className
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
      {/* Contrôle du compteur */}
      <div className="flex flex-col items-center bg-card rounded-full p-1.5 shadow-lg ring-1 ring-border">
        <button
          onClick={increment}
          disabled={count >= maxRuns}
          className={cn(
            'p-2.5 rounded-full transition-colors',
            'hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed'
          )}
          title="Augmenter le nombre de runs"
        >
          <PlusIcon size={18} />
        </button>
        
        <div className="py-2 px-4 font-mono text-xl font-bold min-w-[2.5rem] text-center select-none">
          {count}
        </div>
        
        <button
          onClick={decrement}
          disabled={count <= 1}
          className={cn(
            'p-2.5 rounded-full transition-colors',
            'hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed'
          )}
          title="Diminuer le nombre de runs"
        >
          <MinusIcon size={18} />
        </button>
      </div>

      {/* Bouton de lancement */}
      <button
        onClick={handleRun}
        className={cn(
          'p-3.5 rounded-full bg-primary text-primary-foreground shadow-lg',
          'hover:bg-primary/90 hover:scale-105 transition-all',
          'flex items-center justify-center'
        )}
        title={`Lancer ${count} run${count > 1 ? 's' : ''} en parallèle`}
      >
        <PlayIcon size={18} fill="currentColor" />
      </button>
    </div>
    </>
  );
}

