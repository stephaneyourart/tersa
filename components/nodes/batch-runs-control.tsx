/**
 * Contrôle du nombre de runs parallèles (style Flora)
 * S'affiche au hover d'un node - en bas à droite, compact
 */

'use client';

import { cn } from '@/lib/utils';
import { ArrowUpIcon, MinusIcon, PlusIcon } from 'lucide-react';
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
  isVisible,
  onRun,
  maxRuns = 100,
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
    hideTimeoutRef.current = setTimeout(() => {
      setIsControlHovered(false);
      onHoverChange?.(false);
    }, 200);
  };

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  const shouldShow = isVisible || isControlHovered;

  return (
    <div
      className={cn(
        'flex items-center gap-2',
        'transition-all duration-200',
        shouldShow ? 'opacity-100' : 'opacity-0 pointer-events-none',
        className
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Compteur compact - seulement si > 1 */}
      {count > 1 && (
        <div className="flex items-center bg-zinc-800/90 rounded-full overflow-hidden shadow-lg backdrop-blur-sm">
          <button
            onClick={decrement}
            disabled={count <= 1}
            className={cn(
              'p-1.5 transition-colors',
              'hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed'
            )}
          >
            <MinusIcon size={12} className="text-white" />
          </button>
          
          <span className="px-1.5 font-mono text-sm font-bold text-white min-w-[1.5rem] text-center select-none">
            {count}
          </span>
          
          <button
            onClick={increment}
            disabled={count >= maxRuns}
            className={cn(
              'p-1.5 transition-colors',
              'hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed'
            )}
          >
            <PlusIcon size={12} className="text-white" />
          </button>
        </div>
      )}

      {/* Indicateur de multiplicateur si count = 1 - juste le chiffre cliquable pour incrémenter */}
      {count === 1 && (
        <button
          onClick={increment}
          className="flex items-center justify-center w-7 h-7 bg-zinc-800/90 rounded-full text-white text-xs font-bold shadow-lg backdrop-blur-sm hover:bg-zinc-700 transition-colors"
        >
          {count}×
        </button>
      )}

      {/* Bouton de lancement - compact */}
      <button
        onClick={handleRun}
        className={cn(
          'p-1.5 rounded-full bg-white shadow-lg',
          'hover:bg-zinc-100 hover:scale-105 transition-all',
          'flex items-center justify-center'
        )}
        title={`Lancer ${count} run${count > 1 ? 's' : ''}`}
      >
        <ArrowUpIcon size={12} className="text-black" strokeWidth={2.5} />
      </button>
    </div>
  );
}
