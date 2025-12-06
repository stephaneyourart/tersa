'use client';

import { usePerformanceModeStore } from '@/lib/performance-mode-store';
import { ZapIcon, ZapOffIcon } from 'lucide-react';
import { Button } from './ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from './ui/tooltip';

export function PerformanceModeToggle() {
  const isPerformanceMode = usePerformanceModeStore((s) => s.isPerformanceMode);
  const togglePerformanceMode = usePerformanceModeStore((s) => s.togglePerformanceMode);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`rounded-full transition-colors ${
            isPerformanceMode 
              ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={togglePerformanceMode}
        >
          {isPerformanceMode ? (
            <ZapOffIcon size={16} />
          ) : (
            <ZapIcon size={16} />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[200px]">
        <p className="font-medium">
          {isPerformanceMode ? 'Mode Performance ON' : 'Mode Performance OFF'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {isPerformanceMode 
            ? 'Les vidéos sont en pause. Cliquez pour réactiver la lecture au hover.'
            : 'Cliquez pour désactiver la lecture des vidéos et améliorer les performances.'}
        </p>
        <p className="text-xs text-muted-foreground mt-1 opacity-70">
          Raccourci : CMD+K (sur nœuds sélectionnés)
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
