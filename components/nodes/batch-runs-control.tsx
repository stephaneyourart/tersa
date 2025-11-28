/**
 * Contrôle du nombre de runs parallèles (style Flora)
 * S'affiche au hover d'un node - incrusté sur le côté droit
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
    <>
      {/* Zone de hover invisible pour relier le node au contrôle */}
      <div
        className={cn(
          'absolute -right-1 top-0 bottom-0 w-16 z-40',
          shouldShow ? 'pointer-events-auto' : 'pointer-events-none'
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />
      
      <div
        className={cn(
          'absolute right-4 top-1/2 -translate-y-1/2 translate-x-full z-50',
          'flex flex-col items-center gap-3',
          'transition-all duration-200',
          shouldShow ? 'opacity-100' : 'opacity-0 pointer-events-none',
          className
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Contrôle du compteur - style Flora */}
        <div className="flex flex-col items-center bg-zinc-800 rounded-full overflow-hidden shadow-xl">
          <button
            onClick={increment}
            disabled={count >= maxRuns}
            className={cn(
              'p-3 transition-colors',
              'hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed'
            )}
          >
            <PlusIcon size={20} className="text-white" />
          </button>
          
          <div className="py-1 px-3 font-mono text-xl font-bold text-white min-w-[3rem] text-center select-none">
            {count}
          </div>
          
          <button
            onClick={decrement}
            disabled={count <= 1}
            className={cn(
              'p-3 transition-colors',
              'hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed'
            )}
          >
            <MinusIcon size={20} className="text-white" />
          </button>
        </div>

        {/* Bouton de lancement - blanc avec icône noire */}
        <button
          onClick={handleRun}
          className={cn(
            'p-4 rounded-full bg-white shadow-xl',
            'hover:bg-zinc-100 hover:scale-105 transition-all',
            'flex items-center justify-center'
          )}
          title={`Lancer ${count} run${count > 1 ? 's' : ''}`}
        >
          <ArrowUpIcon size={22} className="text-black" strokeWidth={2.5} />
        </button>
      </div>
    </>
  );
}
