'use client';

/**
 * Mode comparaison de médias (vidéos OU images) en VRAI plein écran
 * ENTREE pour confirmer, CMD+Z pour annuler
 */

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { CheckIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MediaInfo {
  id: string;
  url: string;
  title?: string;
  type: 'video' | 'image';
  nodeData?: Record<string, unknown>;
}

interface MediaComparisonModeProps {
  media: MediaInfo[];
  onClose: () => void;
  onConfirm: (selectedIds: string[], rejectedIds: string[]) => Promise<void>;
}

// Calculer la disposition optimale
function calculateOptimalGrid(count: number, screenWidth: number, screenHeight: number): { cols: number; rows: number } {
  if (count === 1) return { cols: 1, rows: 1 };
  
  const mediaRatio = 16 / 9;
  let bestLayout = { cols: 1, rows: count };
  let bestWaste = Infinity;
  
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const cellWidth = screenWidth / cols;
    const cellHeight = screenHeight / rows;
    const cellRatio = cellWidth / cellHeight;
    
    let mediaWidth, mediaHeight;
    if (cellRatio > mediaRatio) {
      mediaHeight = cellHeight;
      mediaWidth = mediaHeight * mediaRatio;
    } else {
      mediaWidth = cellWidth;
      mediaHeight = mediaWidth / mediaRatio;
    }
    
    const usedArea = mediaWidth * mediaHeight * count;
    const totalArea = screenWidth * screenHeight;
    const waste = totalArea - usedArea;
    const emptySlots = (cols * rows) - count;
    const adjustedWaste = waste + (emptySlots * (totalArea / (cols * rows)) * 0.5);
    
    if (adjustedWaste < bestWaste) {
      bestWaste = adjustedWaste;
      bestLayout = { cols, rows };
    }
  }
  
  return bestLayout;
}

export function MediaComparisonMode({ media, onClose, onConfirm }: MediaComparisonModeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isConfirming, setIsConfirming] = useState(false);
  const [screenSize, setScreenSize] = useState({ width: 1920, height: 1080 });

  // Entrer en mode plein écran
  useEffect(() => {
    const enterFullscreen = async () => {
      try {
        if (containerRef.current && document.fullscreenEnabled) {
          await containerRef.current.requestFullscreen();
        }
      } catch (e) {
        console.warn('Fullscreen non disponible:', e);
      }
    };
    const timer = setTimeout(enterFullscreen, 100);
    return () => clearTimeout(timer);
  }, []);

  // Taille écran
  useEffect(() => {
    const updateSize = () => {
      setScreenSize({
        width: window.screen.width || window.innerWidth,
        height: window.screen.height || window.innerHeight,
      });
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        onClose();
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [onClose]);

  // Démarrer vidéos
  useEffect(() => {
    const timer = setTimeout(() => {
      videoRefs.current.forEach((video) => {
        if (video) {
          video.currentTime = 0;
          video.muted = true;
          video.play().catch(console.error);
        }
      });
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Grille
  const gridLayout = useMemo(() => 
    calculateOptimalGrid(media.length, screenSize.width, screenSize.height),
    [media.length, screenSize]
  );

  // Toggle
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // Confirmer avec ENTREE
  const handleConfirm = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.error('Sélectionnez au moins un élément');
      return;
    }

    setIsConfirming(true);
    const rejectedIds = media.filter((m) => !selectedIds.has(m.id)).map((m) => m.id);

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      await onConfirm(Array.from(selectedIds), rejectedIds);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de la confirmation');
    } finally {
      setIsConfirming(false);
    }
  }, [selectedIds, media, onConfirm]);

  // Clavier : ESC et ENTREE
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          onClose();
        }
      } else if (e.key === 'Enter' && !isConfirming) {
        e.preventDefault();
        handleConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, handleConfirm, isConfirming]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] bg-black"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${gridLayout.cols}, 1fr)`,
        gridTemplateRows: `repeat(${gridLayout.rows}, 1fr)`,
        gap: '2px',
        padding: '0',
        margin: '0',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      {media.map((item, index) => {
        const isSelected = selectedIds.has(item.id);

        return (
          <div
            key={item.id}
            className="relative flex items-center justify-center bg-black cursor-pointer overflow-hidden"
            onClick={() => toggleSelection(item.id)}
          >
            {/* Média */}
            {item.type === 'video' ? (
              <video
                ref={(el) => { videoRefs.current[index] = el; }}
                src={item.url}
                className="w-full h-full object-contain"
                playsInline
                muted
                loop
              />
            ) : (
              <img
                src={item.url}
                alt={item.title || 'Image'}
                className="w-full h-full object-contain"
              />
            )}

            {/* Checkbox simple */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSelection(item.id);
                }}
                className={cn(
                  "flex items-center justify-center w-7 h-7 rounded-full transition-all",
                  isSelected
                    ? "bg-orange-500 text-white"
                    : "bg-black/50 border border-white/40"
                )}
              >
                {isSelected && <CheckIcon size={16} strokeWidth={3} />}
              </button>
            </div>
          </div>
        );
      })}

      {/* Indicateur discret */}
      {isConfirming && (
        <div className="fixed inset-0 z-[10001] bg-black/50 flex items-center justify-center">
          <div className="text-white text-lg">Processing...</div>
        </div>
      )}
    </div>
  );
}

export { MediaComparisonMode as VideoComparisonMode };
