/**
 * Composant de comparaison d'images avant/après avec slider vertical
 * Style inspiré de LupaUpscaler - barre verticale draggable
 * 
 * Le drag sur la barre n'affecte pas la navigation du canvas
 * L'upscale est TOUJOURS à droite, l'original à gauche
 */

'use client';

import { cn } from '@/lib/utils';
import Image from 'next/image';
import { useState, useRef, useCallback, useEffect } from 'react';
import { GripVerticalIcon } from 'lucide-react';

type ImageCompareSliderProps = {
  beforeUrl: string;
  afterUrl: string;
  className?: string;
  width?: number;
  height?: number;
  // Infos d'upscale pour affichage au hover
  upscaleModel?: string;
  upscaleScale?: number;
  upscaleCreativity?: number;
};

export function ImageCompareSlider({
  beforeUrl,
  afterUrl,
  className,
  width = 1000,
  height = 1000,
  upscaleModel,
  upscaleScale,
  upscaleCreativity,
}: ImageCompareSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  }, []);

  // Handler pour le drag de la barre uniquement
  const handleSliderMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Empêche la propagation vers le canvas
    setIsDragging(true);
    handleMove(e.clientX);
  };

  const handleSliderTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation(); // Empêche la propagation vers le canvas
    setIsDragging(true);
    handleMove(e.touches[0].clientX);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      e.stopPropagation();
      handleMove(e.clientX);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      e.stopPropagation();
      handleMove(e.touches[0].clientX);
    };

    const handleEnd = (e: MouseEvent | TouchEvent) => {
      if (isDragging) {
        e.preventDefault();
        e.stopPropagation();
      }
      setIsDragging(false);
    };

    if (isDragging) {
      // Utiliser capture pour intercepter avant le canvas
      document.addEventListener('mousemove', handleMouseMove, { capture: true });
      document.addEventListener('mouseup', handleEnd, { capture: true });
      document.addEventListener('touchmove', handleTouchMove, { capture: true, passive: false });
      document.addEventListener('touchend', handleEnd, { capture: true });
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove, { capture: true });
      document.removeEventListener('mouseup', handleEnd, { capture: true });
      document.removeEventListener('touchmove', handleTouchMove, { capture: true });
      document.removeEventListener('touchend', handleEnd, { capture: true });
    };
  }, [isDragging, handleMove]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full overflow-hidden select-none',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image de fond (After / Upscalé) - visible à droite */}
      <div className="relative w-full">
        <Image
          src={afterUrl}
          alt="Upscalé"
          width={width}
          height={height}
          className="w-full h-auto object-cover pointer-events-none"
          draggable={false}
        />
      </div>

      {/* Overlay avec infos d'upscale au hover */}
      {isHovered && upscaleModel && (
        <div className="absolute top-3 left-3 z-20 pointer-events-none">
          <div className="px-2.5 py-1.5 rounded-lg bg-black/70 backdrop-blur-sm border border-white/10">
            <p className="text-white text-xs font-medium">
              Upscalé avec {upscaleModel}
            </p>
            <div className="flex items-center gap-2 text-white/70 text-[10px]">
              {upscaleScale && <span>{upscaleScale}x</span>}
              {upscaleCreativity !== undefined && (
                <span>• Créativité: {upscaleCreativity}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Image de superposition (Before / Original) - clippée à gauche */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
      >
        <Image
          src={beforeUrl}
          alt="Original"
          width={width}
          height={height}
          className="w-full h-auto object-cover"
          draggable={false}
        />
      </div>

      {/* Barre verticale de séparation - seule zone draggable */}
      {/* nodrag + nopan = classes React Flow pour empêcher le pan/drag du canvas */}
      <div
        className="nodrag nopan absolute top-0 bottom-0 w-8 cursor-ew-resize z-10"
        style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
        onMouseDown={handleSliderMouseDown}
        onTouchStart={handleSliderTouchStart}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Ligne blanche */}
        <div className="absolute top-0 bottom-0 left-1/2 w-[3px] -translate-x-1/2 bg-white shadow-[0_0_8px_rgba(0,0,0,0.5)]" />
        
        {/* Handle central */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center">
          <GripVerticalIcon size={14} className="text-zinc-500" />
        </div>
      </div>
    </div>
  );
}

