/**
 * Bouton Upscale pour les images
 * 2 états visuels :
 * - commande : visible au hover, déclenche le menu contextuel d'upscale
 * - en cours : loader pendant l'upscaling (filler pourpre géré par le nœud parent)
 * 
 * Après upscale, le bouton reste visible au hover pour permettre de recommencer
 * Les infos d'upscale s'affichent dans le slider de comparaison au hover
 */

'use client';

import { cn } from '@/lib/utils';
import { upscaleModels } from '@/lib/models/upscale';
import {
  ArrowUpRightIcon,
  Loader2Icon,
  SlidersHorizontalIcon,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

export type UpscaleStatus = 'idle' | 'ready' | 'processing' | 'completed';

export type UpscaleSettings = {
  model: string;
  scale: number;
  creativity: number;
};

const DEFAULT_UPSCALE_SETTINGS: UpscaleSettings = {
  model: 'lupa-standard',
  scale: 2,
  creativity: 5,
};

// Récupérer uniquement les modèles d'upscale image (pas vidéo)
const imageUpscaleModels = Object.entries(upscaleModels).filter(
  ([_, model]) => model.type === 'image' || model.type === 'both'
);

type UpscaleButtonProps = {
  isVisible: boolean;
  status: UpscaleStatus;
  onUpscale: (settings: UpscaleSettings) => void;
  onCancelUpscale: () => void;
  onHoverChange?: (isHovered: boolean) => void;
  className?: string;
};

export function UpscaleButton({
  isVisible,
  status,
  onUpscale,
  // onCancelUpscale n'est plus utilisé car on permet de refaire sans annuler
  onHoverChange,
  className,
}: UpscaleButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [settings, setSettings] = useState<UpscaleSettings>(DEFAULT_UPSCALE_SETTINGS);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setIsHovered(true);
    onHoverChange?.(true);
  };

  const handleMouseLeave = () => {
    hideTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
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

  const handleUpscale = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    onUpscale(settings);
  };

  // Conditions d'affichage - visible au hover ou pendant le processing
  const shouldShow = status === 'processing' || isVisible || isHovered;

  // Si en cours de traitement, afficher un loader
  if (status === 'processing') {
    return (
      <div
        className={cn(
          'flex items-center justify-center',
          'w-7 h-7 rounded-full',
          'bg-purple-600/90 backdrop-blur-sm shadow-lg',
          'text-white',
          className
        )}
      >
        <Loader2Icon size={12} className="animate-spin" />
      </div>
    );
  }

  // Si upscale terminé, afficher le même bouton upscale pour pouvoir recommencer
  // (l'info d'upscale s'affiche dans le slider de comparaison)

  // État par défaut : bouton commande avec popover
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'flex items-center justify-center',
            'w-7 h-7 rounded-full',
            'bg-zinc-800/90 backdrop-blur-sm shadow-lg',
            'text-white text-xs',
            'hover:bg-zinc-700 transition-all',
            'transition-all duration-200',
            shouldShow ? 'opacity-100' : 'opacity-0 pointer-events-none',
            className
          )}
          title="Upscale image"
        >
          <ArrowUpRightIcon size={12} />
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-72 p-4" 
        side="top" 
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium">Modèle d'upscale</Label>
            <Select
              value={settings.model}
              onValueChange={(value) => setSettings({ ...settings, model: value })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Sélectionner un modèle" />
              </SelectTrigger>
              <SelectContent>
                {imageUpscaleModels.map(([id, model]) => (
                  <SelectItem key={id} value={id} className="text-xs">
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Paramètres avancés */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between px-0 h-6 text-xs text-muted-foreground hover:text-foreground"
              >
                <span className="flex items-center gap-1.5">
                  <SlidersHorizontalIcon size={12} />
                  Paramètres avancés
                </span>
                <span className="text-[10px]">
                  {showAdvanced ? '▲' : '▼'}
                </span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-3">
              {/* Scale */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Résolution</Label>
                  <span className="text-xs text-muted-foreground font-mono">
                    {settings.scale}x
                  </span>
                </div>
                <Slider
                  value={[settings.scale]}
                  onValueChange={([value]) => setSettings({ ...settings, scale: value })}
                  min={2}
                  max={settings.model.startsWith('lupa') ? 6 : 4}
                  step={2}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>2x</span>
                  <span>4x</span>
                  {settings.model.startsWith('lupa') && <span>6x</span>}
                </div>
              </div>

              {/* Créativité (pour Lupa) */}
              {settings.model.startsWith('lupa') && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Créativité</Label>
                    <span className="text-xs text-muted-foreground font-mono">
                      {settings.creativity}
                    </span>
                  </div>
                  <Slider
                    value={[settings.creativity]}
                    onValueChange={([value]) => setSettings({ ...settings, creativity: value })}
                    min={-10}
                    max={10}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Fidèle</span>
                    <span>Créatif</span>
                  </div>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Bouton Upscale */}
          <Button
            onClick={handleUpscale}
            className="w-full h-8 text-xs font-medium bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            <ArrowUpRightIcon size={12} className="mr-1.5" />
            Upscaler l'image
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

