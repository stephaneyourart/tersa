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
import { getModelConfig, type WaveSpeedModelConfig } from '@/lib/models/image/wavespeed-params';
import { Settings2Icon } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';

// Settings simplifié - seulement ce qui est supporté par WaveSpeed
export type ImageAdvancedSettings = {
  aspect_ratio?: string;
  resolution?: string;
  output_format?: string;
  seed?: number;
  guidance_scale?: number;
  num_inference_steps?: number;
  negative_prompt?: string;
};

const DEFAULT_SETTINGS: ImageAdvancedSettings = {
  aspect_ratio: '1:1',
  output_format: 'jpeg',
};

type AdvancedSettingsPanelProps = {
  modelId?: string;
  modelPath?: string; // Le chemin WaveSpeed du modèle (ex: 'google/nano-banana/text-to-image')
  settings: ImageAdvancedSettings;
  onSettingsChange: (settings: ImageAdvancedSettings) => void;
};

export function AdvancedSettingsPanel({
  modelId,
  modelPath,
  settings,
  onSettingsChange,
}: AdvancedSettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState<ImageAdvancedSettings>(settings);

  // Récupérer la configuration du modèle
  const modelConfig = useMemo(() => {
    if (modelPath) {
      return getModelConfig(modelPath);
    }
    return null;
  }, [modelPath]);

  // Mettre à jour les settings locaux quand les props changent
  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSave = () => {
    onSettingsChange(localSettings);
    setOpen(false);
  };

  const handleReset = () => {
    const defaults = modelConfig?.defaults || {};
    setLocalSettings({
      aspect_ratio: defaults.aspect_ratio || '1:1',
      resolution: defaults.resolution,
      output_format: defaults.output_format || 'jpeg',
    });
  };

  const updateSetting = <K extends keyof ImageAdvancedSettings>(
    key: K,
    value: ImageAdvancedSettings[K]
  ) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
  };

  // Vérifier si un paramètre est supporté
  const isSupported = (param: string): boolean => {
    if (!modelConfig) return false;
    return modelConfig.supportedParams.includes(param as never);
  };

  // Si pas de config, afficher un message
  const hasAnyParams = modelConfig && modelConfig.supportedParams.length > 1; // Plus que 'prompt'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Settings2Icon className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2Icon className="h-5 w-5" />
            Paramètres - {modelPath || modelId || 'Modèle'}
          </DialogTitle>
        </DialogHeader>

        {!modelConfig ? (
          <div className="py-8 text-center text-muted-foreground">
            <p>Configuration non disponible pour ce modèle.</p>
            <p className="text-sm mt-2">Model path: {modelPath || 'non défini'}</p>
          </div>
        ) : !hasAnyParams ? (
          <div className="py-8 text-center text-muted-foreground">
            <p>Ce modèle n'a pas de paramètres configurables.</p>
            <p className="text-sm mt-2">Seul le prompt est requis.</p>
          </div>
        ) : (
          <div className="grid gap-6 py-4">
            {/* Aspect Ratio */}
            {isSupported('aspect_ratio') && modelConfig.aspectRatioOptions && (
              <div className="space-y-2">
                <Label>Aspect Ratio</Label>
                <Select
                  value={localSettings.aspect_ratio || '1:1'}
                  onValueChange={(value) => updateSetting('aspect_ratio', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {modelConfig.aspectRatioOptions.map((ratio) => (
                      <SelectItem key={ratio} value={ratio}>
                        {ratio}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Resolution */}
            {isSupported('resolution') && modelConfig.resolutionOptions && (
              <div className="space-y-2">
                <Label>Résolution</Label>
                <Select
                  value={localSettings.resolution || modelConfig.defaults?.resolution || '2k'}
                  onValueChange={(value) => updateSetting('resolution', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {modelConfig.resolutionOptions.map((res) => (
                      <SelectItem key={res} value={res}>
                        {res.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Output Format */}
            {isSupported('output_format') && modelConfig.outputFormatOptions && (
              <div className="space-y-2">
                <Label>Format de sortie</Label>
                <Select
                  value={localSettings.output_format || 'jpeg'}
                  onValueChange={(value) => updateSetting('output_format', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {modelConfig.outputFormatOptions.map((format) => (
                      <SelectItem key={format} value={format}>
                        {format.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Seed */}
            {isSupported('seed') && (
              <div className="space-y-2">
                <Label>Seed (optionnel)</Label>
                <Input
                  type="number"
                  placeholder="Aléatoire"
                  value={localSettings.seed ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateSetting('seed', val ? parseInt(val, 10) : undefined);
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Utilisez le même seed pour reproduire des résultats similaires.
                </p>
              </div>
            )}

            {/* Guidance Scale */}
            {isSupported('guidance_scale') && (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Guidance Scale</Label>
                  <span className="text-sm text-muted-foreground">
                    {localSettings.guidance_scale ?? 3.5}
                  </span>
                </div>
                <Slider
                  value={[localSettings.guidance_scale ?? 3.5]}
                  onValueChange={([value]) => updateSetting('guidance_scale', value)}
                  min={1}
                  max={20}
                  step={0.5}
                />
              </div>
            )}

            {/* Inference Steps */}
            {isSupported('num_inference_steps') && (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Étapes d'inférence</Label>
                  <span className="text-sm text-muted-foreground">
                    {localSettings.num_inference_steps ?? 28}
                  </span>
                </div>
                <Slider
                  value={[localSettings.num_inference_steps ?? 28]}
                  onValueChange={([value]) => updateSetting('num_inference_steps', value)}
                  min={1}
                  max={50}
                  step={1}
                />
              </div>
            )}

            {/* Negative Prompt */}
            {isSupported('negative_prompt') && (
              <div className="space-y-2">
                <Label>Negative Prompt</Label>
                <Textarea
                  placeholder="Ce que vous ne voulez pas voir..."
                  value={localSettings.negative_prompt || ''}
                  onChange={(e) => updateSetting('negative_prompt', e.target.value)}
                  rows={3}
                />
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={handleReset}>
            Réinitialiser
          </Button>
          <Button onClick={handleSave}>
            Appliquer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { DEFAULT_SETTINGS };
