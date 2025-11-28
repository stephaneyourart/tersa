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
import { Textarea } from '@/components/ui/textarea';
import { getVideoModelConfig } from '@/lib/models/video/wavespeed-video-params';
import { Settings2Icon } from 'lucide-react';
import { useState } from 'react';

export interface VideoAdvancedSettings {
  aspect_ratio?: string;
  duration?: number;
  resolution?: string;
  seed?: number;
  negative_prompt?: string;
  fps?: number;
}

export const DEFAULT_VIDEO_SETTINGS: VideoAdvancedSettings = {};

interface VideoAdvancedSettingsPanelProps {
  settings: VideoAdvancedSettings;
  onSettingsChange: (settings: VideoAdvancedSettings) => void;
  modelId: string;
  modelPath: string;
}

export function VideoAdvancedSettingsPanel({
  settings,
  onSettingsChange,
  modelPath,
}: VideoAdvancedSettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState<VideoAdvancedSettings>(settings);

  const modelConfig = getVideoModelConfig(modelPath);
  const supportedParams = modelConfig?.supportedParams || [];

  const handleChange = (key: keyof VideoAdvancedSettings, value: string | number | undefined) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
  };

  const handleSave = () => {
    onSettingsChange(localSettings);
    setOpen(false);
  };

  // Filtrer les paramètres éditables (autre que prompt, image, video, audio, images)
  const editableParams = supportedParams.filter(p => 
    !['prompt', 'image', 'images', 'video', 'audio'].includes(p)
  );
  
  // Toujours afficher le bouton (même sans config, pour debug)
  const hasEditableParams = editableParams.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="rounded-full">
          <Settings2Icon size={12} />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Paramètres avancés vidéo</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          {/* Message si aucun param éditable */}
          {!hasEditableParams && (
            <p className="text-sm text-muted-foreground">
              Ce modèle n&apos;a pas de paramètres avancés configurables.
            </p>
          )}
          
          {/* Aspect Ratio */}
          {supportedParams.includes('aspect_ratio') && modelConfig?.aspectRatioOptions && (
            <div className="grid gap-2">
              <Label>Aspect Ratio</Label>
              <Select
                value={localSettings.aspect_ratio || modelConfig.defaults?.aspect_ratio?.toString() || '16:9'}
                onValueChange={(value) => handleChange('aspect_ratio', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un ratio" />
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

          {/* Duration */}
          {supportedParams.includes('duration') && modelConfig?.durationOptions && (
            <div className="grid gap-2">
              <Label>Durée (secondes)</Label>
              <Select
                value={localSettings.duration?.toString() || modelConfig.defaults?.duration?.toString() || '5'}
                onValueChange={(value) => handleChange('duration', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une durée" />
                </SelectTrigger>
                <SelectContent>
                  {modelConfig.durationOptions.map((d) => (
                    <SelectItem key={d} value={d.toString()}>
                      {d}s
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Resolution */}
          {supportedParams.includes('resolution') && modelConfig?.resolutionOptions && (
            <div className="grid gap-2">
              <Label>Résolution</Label>
              <Select
                value={localSettings.resolution || modelConfig.defaults?.resolution?.toString() || '1080p'}
                onValueChange={(value) => handleChange('resolution', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une résolution" />
                </SelectTrigger>
                <SelectContent>
                  {modelConfig.resolutionOptions.map((res) => (
                    <SelectItem key={res} value={res}>
                      {res}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Seed */}
          {supportedParams.includes('seed') && (
            <div className="grid gap-2">
              <Label>Seed (-1 = aléatoire)</Label>
              <Input
                type="number"
                value={localSettings.seed ?? -1}
                onChange={(e) => handleChange('seed', parseInt(e.target.value) || -1)}
                min={-1}
                max={2147483647}
              />
            </div>
          )}

          {/* Negative Prompt */}
          {supportedParams.includes('negative_prompt') && (
            <div className="grid gap-2">
              <Label>Prompt négatif</Label>
              <Textarea
                value={localSettings.negative_prompt || ''}
                onChange={(e) => handleChange('negative_prompt', e.target.value)}
                placeholder="Ce que vous ne voulez pas voir..."
                rows={3}
              />
            </div>
          )}

          {/* FPS */}
          {supportedParams.includes('fps') && (
            <div className="grid gap-2">
              <Label>FPS</Label>
              <Input
                type="number"
                value={localSettings.fps ?? 24}
                onChange={(e) => handleChange('fps', parseInt(e.target.value) || 24)}
                min={1}
                max={60}
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave}>
            Appliquer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

