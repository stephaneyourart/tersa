/**
 * Contrôle du nombre de runs parallèles (comme Flora AI)
 * S'affiche au hover d'un node pour permettre de lancer N runs en parallèle
 */

'use client';

import { cn } from '@/lib/utils';
import { MinusIcon, PlusIcon, PlayIcon } from 'lucide-react';
import { useState } from 'react';

type BatchRunsControlProps = {
  nodeId: string;
  isVisible: boolean;
  onRun?: (count: number) => void;
  maxRuns?: number;
  className?: string;
};

export function BatchRunsControl({
  nodeId,
  isVisible,
  onRun,
  maxRuns = 10,
  className,
}: BatchRunsControlProps) {
  const [count, setCount] = useState(1);
  const [isHovered, setIsHovered] = useState(false);

  const increment = () => {
    setCount((prev) => Math.min(prev + 1, maxRuns));
  };

  const decrement = () => {
    setCount((prev) => Math.max(prev - 1, 1));
  };

  const handleRun = () => {
    if (onRun) {
      onRun(count);
    }
  };

  // Afficher uniquement si visible ou hovered
  if (!isVisible && !isHovered) {
    return null;
  }

  return (
    <div
      className={cn(
        'absolute -right-3 top-1/2 -translate-y-1/2 translate-x-full z-50',
        'flex flex-col items-center gap-2',
        'transition-opacity duration-200',
        isVisible || isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Contrôle du compteur */}
      <div className="flex flex-col items-center bg-card rounded-full p-1 shadow-lg ring-1 ring-border">
        <button
          onClick={increment}
          disabled={count >= maxRuns}
          className={cn(
            'p-2 rounded-full transition-colors',
            'hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed'
          )}
          title="Augmenter le nombre de runs"
        >
          <PlusIcon size={16} />
        </button>
        
        <div className="py-2 px-3 font-mono text-lg font-semibold min-w-[2rem] text-center">
          {count}
        </div>
        
        <button
          onClick={decrement}
          disabled={count <= 1}
          className={cn(
            'p-2 rounded-full transition-colors',
            'hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed'
          )}
          title="Diminuer le nombre de runs"
        >
          <MinusIcon size={16} />
        </button>
      </div>

      {/* Bouton de lancement */}
      <button
        onClick={handleRun}
        className={cn(
          'p-3 rounded-full bg-primary text-primary-foreground shadow-lg',
          'hover:bg-primary/90 transition-colors',
          'flex items-center justify-center'
        )}
        title={`Lancer ${count} run${count > 1 ? 's' : ''} en parallèle`}
      >
        <PlayIcon size={16} fill="currentColor" />
      </button>
    </div>
  );
}

