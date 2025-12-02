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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Settings2Icon } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { getApiDocumentation } from '@/lib/api-docs';

interface DynamicSettingsProps {
  modelId: string;
  settings: Record<string, any>;
  onSettingsChange: (settings: Record<string, any>) => void;
}

export function DynamicAdvancedSettings({
  modelId,
  settings,
  onSettingsChange,
}: DynamicSettingsProps) {
  const [open, setOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState<Record<string, any>>(settings);

  // Charger la doc et les defaults
  const doc = useMemo(() => getApiDocumentation(modelId), [modelId]);
  
  // Charger les valeurs sauvegardées par défaut pour ce modèle
  useEffect(() => {
    if (open) {
      const savedDefaults = localStorage.getItem(`wavespeed_defaults_${modelId}`);
      if (savedDefaults) {
        setLocalSettings(prev => ({ ...JSON.parse(savedDefaults), ...prev }));
      }
    }
  }, [open, modelId]);

  const handleChange = (key: string, value: any) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSettingsChange(localSettings);
    setOpen(false);
  };

  const handleSaveAsDefault = () => {
    localStorage.setItem(`wavespeed_defaults_${modelId}`, JSON.stringify(localSettings));
    handleSave();
  };

  // Filtrer les paramètres techniques ou déjà gérés (prompt, image, etc.)
  const params = doc.parameters.filter(p => 
    !['prompt', 'image', 'video', 'images', 'mask'].includes(p.name) &&
    // Exclure les objets complexes pour l'instant sauf si on a un UI dédié
    p.type !== 'object'
  );

  if (params.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="rounded-full h-8 w-8">
          <Settings2Icon size={14} />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Paramètres - {modelId.split('/').pop()}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {params.map(param => (
            <div key={param.name} className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={param.name} className="capitalize">
                  {param.name.replace(/_/g, ' ')}
                </Label>
                {param.required && <span className="text-[10px] text-amber-500 font-mono">REQ</span>}
              </div>
              
              {/* RENDU SELON LE TYPE */}
              
              {/* SELECT / ENUM (déduit du range ou type) */}
              {(param.range?.includes(',') || (param.type === 'string' && param.range && param.range !== '-')) ? (
                <Select
                  value={localSettings[param.name]?.toString() || param.default?.toString()}
                  onValueChange={(val) => handleChange(param.name, val)}
                >
                  <SelectTrigger id={param.name}>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {param.range!.split(',').map(opt => {
                        const val = opt.trim();
                        return (
                            <SelectItem key={val} value={val}>{val}</SelectItem>
                        );
                    })}
                  </SelectContent>
                </Select>
              ) : 
              
              /* BOOLEAN */
              param.type === 'boolean' ? (
                <div className="flex items-center space-x-2">
                  <Switch 
                    id={param.name} 
                    checked={localSettings[param.name] ?? param.default ?? false}
                    onCheckedChange={(val) => handleChange(param.name, val)}
                  />
                  <Label htmlFor={param.name} className="font-normal text-muted-foreground">
                    {param.description}
                  </Label>
                </div>
              ) :

              /* NUMBER / INTEGER */
              (param.type === 'integer' || param.type === 'number') ? (
                <Input
                  id={param.name}
                  type="number"
                  value={localSettings[param.name] ?? param.default ?? ''}
                  onChange={(e) => handleChange(param.name, param.type === 'integer' ? parseInt(e.target.value) : parseFloat(e.target.value))}
                  placeholder={String(param.default || '')}
                />
              ) :

              /* TEXTAREA pour les longs textes */
              (param.name.includes('prompt') || param.description.length > 50) ? (
                <Textarea
                  id={param.name}
                  value={localSettings[param.name] ?? param.default ?? ''}
                  onChange={(e) => handleChange(param.name, e.target.value)}
                  placeholder={String(param.default || '')}
                  rows={3}
                />
              ) :

              /* DEFAULT STRING INPUT */
              (
                <Input
                  id={param.name}
                  value={localSettings[param.name] ?? param.default ?? ''}
                  onChange={(e) => handleChange(param.name, e.target.value)}
                  placeholder={String(param.default || '')}
                />
              )}
              
              <p className="text-[10px] text-muted-foreground">{param.description}</p>
            </div>
          ))}
        </div>

        <div className="flex justify-between pt-4 border-t mt-2">
          <Button variant="outline" size="sm" onClick={handleSaveAsDefault} className="text-xs">
            Save as Default
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
            </Button>
            <Button size="sm" onClick={handleSave}>
                Apply
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

