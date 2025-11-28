'use client';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { PaletteIcon } from 'lucide-react';
import { HexColorPicker, HexColorInput } from 'react-colorful';
import { useState, useEffect, useCallback } from 'react';

// Présets de couleurs pour le nuancier
const COLOR_PRESETS = [
  // Sombres
  '#0a0a0a', '#1a1a1a', '#262626', '#171717',
  // Gris
  '#404040', '#525252', '#737373', '#a3a3a3',
  // Couleurs sombres
  '#0c0a09', '#1c1917', '#292524', '#1e1b4b',
  '#172554', '#0c4a6e', '#134e4a', '#14532d',
  '#365314', '#422006', '#431407', '#4c0519',
  // Couleurs moyennes
  '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4',
];

const STORAGE_KEY = 'tersa-canvas-bg-color';
const DEFAULT_COLOR = '#0a0a0a';

// Hook exporté pour utiliser la couleur dans d'autres composants
export function useCanvasBackgroundColor() {
  const [color, setColorState] = useState<string>(DEFAULT_COLOR);

  // Charger la couleur depuis localStorage au montage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setColorState(stored);
      }
    }
  }, []);

  // Sauvegarder et mettre à jour
  const setColor = useCallback((newColor: string) => {
    setColorState(newColor);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, newColor);
      // Émettre un événement pour que le canvas se mette à jour
      window.dispatchEvent(new CustomEvent('tersa-bg-color-change', { detail: newColor }));
    }
  }, []);

  return { color, setColor };
}

export function BackgroundColorPicker() {
  const { color, setColor } = useCanvasBackgroundColor();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full flex items-center justify-center"
          title="Couleur du fond"
        >
          <div 
            className="h-4 w-4 rounded-full border border-border shadow-inner flex-shrink-0"
            style={{ backgroundColor: color }}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-auto p-3" 
        align="center"
        side="top"
        sideOffset={8}
      >
        <div className="space-y-3">
          {/* Titre */}
          <div className="flex items-center gap-2 text-sm font-medium">
            <PaletteIcon size={14} />
            Couleur du fond
          </div>
          
          {/* Roue de couleur */}
          <div className="flex justify-center">
            <HexColorPicker 
              color={color} 
              onChange={setColor}
              style={{ width: '180px', height: '150px' }}
            />
          </div>
          
          {/* Input hex */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">#</span>
            <HexColorInput
              color={color}
              onChange={setColor}
              prefixed={false}
              className="flex-1 h-8 px-2 text-xs font-mono bg-muted border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <div 
              className="h-8 w-8 rounded-md border border-border shadow-inner flex-shrink-0"
              style={{ backgroundColor: color }}
            />
          </div>
          
          {/* Nuancier de présets */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Présets</p>
            <div className="grid grid-cols-8 gap-1">
              {COLOR_PRESETS.map((presetColor) => (
                <button
                  key={presetColor}
                  onClick={() => setColor(presetColor)}
                  className={`h-5 w-5 rounded-sm border transition-transform hover:scale-110 ${
                    color === presetColor 
                      ? 'border-primary ring-1 ring-primary' 
                      : 'border-border/50'
                  }`}
                  style={{ backgroundColor: presetColor }}
                  title={presetColor}
                />
              ))}
            </div>
          </div>
          
          {/* Bouton reset */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => setColor(DEFAULT_COLOR)}
          >
            Réinitialiser
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

