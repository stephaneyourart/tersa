'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { ASPECT_RATIOS, type AspectRatio, getAspectRatioSize } from '@/lib/models/image/aspect-ratio';
import { getModelCapabilities } from '@/lib/models/image/capabilities';
import { Settings2Icon } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';

export type ImageAdvancedSettings = {
  aspectRatio: AspectRatio;
  width?: number;
  height?: number;
  seed?: number;
  guidanceScale: number;
  numInferenceSteps: number;
  negativePrompt: string;
  quality: 'standard' | 'hd' | 'ultra';
  style?: string;
  strength?: number;
};

const DEFAULT_SETTINGS: ImageAdvancedSettings = {
  aspectRatio: '1:1',
  width: 1024,
  height: 1024,
  guidanceScale: 7.5,
  numInferenceSteps: 30,
  negativePrompt: '',
  quality: 'standard',
  strength: 0.8,
};

const ASPECT_RATIO_LABELS: Record<AspectRatio, string> = {
  '1:1': '1:1 (Carré)',
  '16:9': '16:9 (Paysage)',
  '9:16': '9:16 (Portrait)',
  '4:3': '4:3 (Standard)',
  '3:4': '3:4 (Portrait)',
  '3:2': '3:2 (Photo)',
  '2:3': '2:3 (Portrait)',
  '21:9': '21:9 (Cinéma)',
  '9:21': '9:21 (Vertical)',
};

const QUALITY_OPTIONS = [
  { value: 'standard', label: 'Standard', description: 'Rapide, bonne qualité' },
  { value: 'hd', label: 'HD', description: 'Haute définition' },
  { value: 'ultra', label: 'Ultra', description: 'Qualité maximale, plus lent' },
];

const STYLE_PRESETS = [
  { value: '', label: 'Aucun' },
  { value: 'photorealistic', label: 'Photoréaliste' },
  { value: 'anime', label: 'Anime' },
  { value: 'digital-art', label: 'Art Digital' },
  { value: 'oil-painting', label: 'Peinture à l\'huile' },
  { value: 'watercolor', label: 'Aquarelle' },
  { value: 'sketch', label: 'Croquis' },
  { value: '3d-render', label: 'Rendu 3D' },
  { value: 'pixel-art', label: 'Pixel Art' },
  { value: 'comic-book', label: 'Bande Dessinée' },
  { value: 'cinematic', label: 'Cinématique' },
];

type AdvancedSettingsProps = {
  settings: ImageAdvancedSettings;
  onChange: (settings: ImageAdvancedSettings) => void;
  modelId?: string;
  supportsEdit?: boolean;
};

export function AdvancedSettingsPanel({
  settings,
  onChange,
  modelId,
  supportsEdit,
}: AdvancedSettingsProps) {
  const [open, setOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState<ImageAdvancedSettings>(settings);

  const handleSave = () => {
    onChange(localSettings);
    setOpen(false);
  };

  const handleReset = () => {
    setLocalSettings(DEFAULT_SETTINGS);
  };

  const updateSetting = <K extends keyof ImageAdvancedSettings>(
    key: K,
    value: ImageAdvancedSettings[K]
  ) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
  };

  // Mettre à jour l'aspect ratio ET les dimensions
  const updateAspectRatio = (ratio: AspectRatio) => {
    const { width, height } = getAspectRatioSize(ratio);
    setLocalSettings((prev) => ({
      ...prev,
      aspectRatio: ratio,
      width,
      height,
    }));
  };

  // Obtenir les capacités du modèle sélectionné
  const capabilities = useMemo(() => 
    getModelCapabilities(modelId || ''),
    [modelId]
  );

  // Initialiser les dimensions au premier rendu si non définies
  useEffect(() => {
    if (!localSettings.width || !localSettings.height) {
      const { width, height } = getAspectRatioSize(localSettings.aspectRatio);
      setLocalSettings((prev) => ({
        ...prev,
        width: prev.width || width,
        height: prev.height || height,
      }));
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Settings2Icon className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2Icon className="h-5 w-5" />
            Paramètres Avancés
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Aspect Ratio */}
          {capabilities.supportsAspectRatio && (
            <div className="space-y-2">
              <Label htmlFor="aspect-ratio">Format d'image</Label>
              <div className="grid grid-cols-3 gap-2">
                {ASPECT_RATIOS.map((ratio) => (
                  <Button
                    key={ratio}
                    variant={localSettings.aspectRatio === ratio ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateAspectRatio(ratio)}
                    className="text-xs"
                  >
                    {ASPECT_RATIO_LABELS[ratio]}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Dimensions personnalisées */}
          {capabilities.supportsAspectRatio && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="width">Largeur</Label>
                <Input
                  id="width"
                  type="number"
                  placeholder="Auto"
                  value={localSettings.width || ''}
                  onChange={(e) => updateSetting('width', e.target.value ? parseInt(e.target.value) : undefined)}
                  min={256}
                  max={4096}
                  step={64}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height">Hauteur</Label>
                <Input
                  id="height"
                  type="number"
                  placeholder="Auto"
                  value={localSettings.height || ''}
                  onChange={(e) => updateSetting('height', e.target.value ? parseInt(e.target.value) : undefined)}
                  min={256}
                  max={4096}
                  step={64}
                />
              </div>
            </div>
          )}

          {/* Qualité */}
          {capabilities.supportsQuality && (
            <div className="space-y-2">
              <Label>Qualité</Label>
              <div className="grid grid-cols-3 gap-2">
                {QUALITY_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    variant={localSettings.quality === option.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateSetting('quality', option.value as 'standard' | 'hd' | 'ultra')}
                    className="flex flex-col h-auto py-2"
                  >
                    <span className="font-medium">{option.label}</span>
                    <span className="text-xs opacity-70">{option.description}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Style Preset */}
          {capabilities.supportsStyle && (
            <div className="space-y-2">
              <Label htmlFor="style">Style</Label>
              <Select
                value={localSettings.style || ''}
                onValueChange={(value) => updateSetting('style', value || undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un style..." />
                </SelectTrigger>
                <SelectContent>
                  {STYLE_PRESETS.map((style) => (
                    <SelectItem key={style.value} value={style.value || 'none'}>
                      {style.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Guidance Scale */}
          {capabilities.supportsGuidanceScale && (
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Guidance Scale</Label>
                <span className="text-sm text-muted-foreground">{localSettings.guidanceScale}</span>
              </div>
              <Slider
                value={[localSettings.guidanceScale]}
                onValueChange={([value]) => updateSetting('guidanceScale', value)}
                min={capabilities.minGuidanceScale ?? 1}
                max={capabilities.maxGuidanceScale ?? 20}
                step={0.5}
              />
              <p className="text-xs text-muted-foreground">
                Plus élevé = plus fidèle au prompt, moins de créativité
              </p>
            </div>
          )}

          {/* Inference Steps */}
          {capabilities.supportsInferenceSteps && (
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Étapes d'inférence</Label>
                <span className="text-sm text-muted-foreground">{localSettings.numInferenceSteps}</span>
              </div>
              <Slider
                value={[localSettings.numInferenceSteps]}
                onValueChange={([value]) => updateSetting('numInferenceSteps', value)}
                min={capabilities.minInferenceSteps ?? 10}
                max={capabilities.maxInferenceSteps ?? 100}
                step={5}
              />
              <p className="text-xs text-muted-foreground">
                Plus d'étapes = meilleure qualité, plus lent
              </p>
            </div>
          )}

          {/* Strength (pour edit/img2img) */}
          {supportsEdit && capabilities.supportsStrength && (
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Force de transformation</Label>
                <span className="text-sm text-muted-foreground">{(localSettings.strength ?? 0.8) * 100}%</span>
              </div>
              <Slider
                value={[(localSettings.strength ?? 0.8) * 100]}
                onValueChange={([value]) => updateSetting('strength', value / 100)}
                min={0}
                max={100}
                step={5}
              />
              <p className="text-xs text-muted-foreground">
                Plus élevé = plus de changements par rapport à l'image source
              </p>
            </div>
          )}

          {/* Seed */}
          {capabilities.supportsSeed && (
            <div className="space-y-2">
              <Label htmlFor="seed">Seed (optionnel)</Label>
              <div className="flex gap-2">
                <Input
                  id="seed"
                  type="number"
                  placeholder="Aléatoire"
                  value={localSettings.seed ?? ''}
                  onChange={(e) => updateSetting('seed', e.target.value ? parseInt(e.target.value) : undefined)}
                />
                <Button
                  variant="outline"
                  onClick={() => updateSetting('seed', Math.floor(Math.random() * 2147483647))}
                >
                  🎲
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Même seed = même résultat (reproductibilité)
              </p>
            </div>
          )}

          {/* Negative Prompt */}
          {capabilities.supportsNegativePrompt && (
            <div className="space-y-2">
              <Label htmlFor="negative-prompt">Prompt Négatif</Label>
              <Textarea
                id="negative-prompt"
                placeholder="Éléments à éviter dans l'image..."
                value={localSettings.negativePrompt}
                onChange={(e) => updateSetting('negativePrompt', e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Décrivez ce que vous ne voulez PAS voir dans l'image
              </p>
            </div>
          )}

          {/* Message si aucune option disponible */}
          {!capabilities.supportsAspectRatio && 
           !capabilities.supportsQuality && 
           !capabilities.supportsStyle && 
           !capabilities.supportsGuidanceScale && 
           !capabilities.supportsInferenceSteps && 
           !capabilities.supportsSeed && 
           !capabilities.supportsNegativePrompt && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Ce modèle ne supporte pas de paramètres avancés.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="ghost" onClick={handleReset}>
            Réinitialiser
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSave}>
              Appliquer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { DEFAULT_SETTINGS };

