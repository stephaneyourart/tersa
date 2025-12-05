'use client';

import { Button } from '@/components/ui/button';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Save, RotateCcw } from 'lucide-react';
import { useState, useEffect, useMemo, createContext, useContext, useCallback } from 'react';
import { getApiDocumentation } from '@/lib/api-docs';
import { getProviderInfo, getReadableModelName } from '@/hooks/use-available-models';
import { cn } from '@/lib/utils';
import modelsData from '@/lib/data/wavespeed-models.json';

// Context pour gérer l'état de la sidebar globalement
interface ModelParamsSidebarContextType {
  isOpen: boolean;
  modelId: string | null;
  nodeId: string | null;
  settings: Record<string, any>;
  openSidebar: (modelId: string, nodeId: string, settings: Record<string, any>, onSettingsChange: (settings: Record<string, any>) => void) => void;
  closeSidebar: () => void;
  updateSettings: (settings: Record<string, any>) => void;
}

const ModelParamsSidebarContext = createContext<ModelParamsSidebarContextType | null>(null);

export function useModelParamsSidebar() {
  const context = useContext(ModelParamsSidebarContext);
  if (!context) {
    throw new Error('useModelParamsSidebar must be used within ModelParamsSidebarProvider');
  }
  return context;
}

interface ProviderProps {
  children: React.ReactNode;
}

export function ModelParamsSidebarProvider({ children }: ProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [modelId, setModelId] = useState<string | null>(null);
  const [nodeId, setNodeId] = useState<string | null>(null);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [onSettingsChangeRef, setOnSettingsChangeRef] = useState<((settings: Record<string, any>) => void) | null>(null);

  const openSidebar = useCallback((
    modelId: string, 
    nodeId: string, 
    settings: Record<string, any>,
    onSettingsChange: (settings: Record<string, any>) => void
  ) => {
    setModelId(modelId);
    setNodeId(nodeId);
    setSettings(settings);
    setOnSettingsChangeRef(() => onSettingsChange);
    setIsOpen(true);
  }, []);

  const closeSidebar = useCallback(() => {
    setIsOpen(false);
    // Petit délai avant de nettoyer pour permettre l'animation
    setTimeout(() => {
      setModelId(null);
      setNodeId(null);
      setSettings({});
      setOnSettingsChangeRef(null);
    }, 300);
  }, []);

  const updateSettings = useCallback((newSettings: Record<string, any>) => {
    setSettings(newSettings);
    onSettingsChangeRef?.(newSettings);
  }, [onSettingsChangeRef]);

  return (
    <ModelParamsSidebarContext.Provider value={{
      isOpen,
      modelId,
      nodeId,
      settings,
      openSidebar,
      closeSidebar,
      updateSettings,
    }}>
      {children}
      <ModelParamsSidebarUI />
    </ModelParamsSidebarContext.Provider>
  );
}

// Le composant UI de la sidebar
function ModelParamsSidebarUI() {
  const { isOpen, modelId, settings, closeSidebar, updateSettings } = useModelParamsSidebar();
  const [localSettings, setLocalSettings] = useState<Record<string, any>>({});

  // Sync local settings with context settings
  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  // Charger la doc API
  const doc = useMemo(() => modelId ? getApiDocumentation(modelId) : null, [modelId]);
  
  // Obtenir les infos du modèle
  const modelInfo = useMemo(() => {
    if (!modelId) return null;
    const item = modelsData.data.items.find(m => m.model_uuid === modelId);
    if (!item) return null;
    const providerInfo = getProviderInfo(modelId);
    const readableName = getReadableModelName(item.model_name, (item as any).seo);
    return { ...item, providerInfo, readableName };
  }, [modelId]);

  // Charger les defaults sauvegardés
  useEffect(() => {
    if (isOpen && modelId) {
      const savedDefaults = localStorage.getItem(`wavespeed_defaults_${modelId}`);
      if (savedDefaults) {
        const defaults = JSON.parse(savedDefaults);
        setLocalSettings(prev => ({ ...defaults, ...prev }));
      }
    }
  }, [isOpen, modelId]);

  const handleChange = (key: string, value: any) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    updateSettings(newSettings);
  };

  const handleSaveAsDefault = () => {
    if (modelId) {
      localStorage.setItem(`wavespeed_defaults_${modelId}`, JSON.stringify(localSettings));
    }
  };

  const handleReset = () => {
    if (modelId) {
      localStorage.removeItem(`wavespeed_defaults_${modelId}`);
      // Reset to doc defaults
      const defaults: Record<string, any> = {};
      doc?.parameters.forEach(p => {
        if (p.default !== undefined) {
          defaults[p.name] = p.default;
        }
      });
      setLocalSettings(defaults);
      updateSettings(defaults);
    }
  };

  // Filtrer les paramètres
  const params = useMemo(() => {
    if (!doc) return [];
    return doc.parameters.filter(p => 
      !['prompt', 'image', 'video', 'images', 'mask'].includes(p.name) &&
      p.type !== 'object'
    );
  }, [doc]);

  if (!modelId) return null;

  const ProviderIcon = modelInfo?.providerInfo.icon;

  return (
    <>
      {/* Overlay */}
      <div 
        className={cn(
          "fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={closeSidebar}
      />
      
      {/* Sidebar */}
      <div 
        className={cn(
          "fixed top-0 right-0 h-full w-[380px] bg-background border-l shadow-2xl z-50",
          "transform transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-muted/30">
          <div className="flex items-center gap-3 overflow-hidden">
            {ProviderIcon && (
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                <ProviderIcon className="w-6 h-6 text-primary" />
              </div>
            )}
            <div className="overflow-hidden">
              <h2 className="font-semibold text-sm truncate">
                {modelInfo?.readableName || modelId?.split('/').pop()}
              </h2>
              <p className="text-xs text-muted-foreground truncate">
                {modelInfo?.providerInfo.name} • {modelInfo?.type}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={closeSidebar} className="shrink-0">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <ScrollArea className="h-[calc(100vh-140px)]">
          <div className="p-4 space-y-5">
            {params.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucun paramètre configurable pour ce modèle.
              </p>
            ) : (
              params.map(param => (
                <div key={param.name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={param.name} className="text-sm font-medium capitalize">
                      {param.name.replace(/_/g, ' ')}
                    </Label>
                    {param.required && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                        Requis
                      </span>
                    )}
                  </div>
                  
                  {/* RENDU SELON LE TYPE */}
                  
                  {/* SELECT / ENUM */}
                  {(param.range?.includes(',') || (param.type === 'string' && param.range && param.range !== '-')) ? (
                    <Select
                      value={localSettings[param.name]?.toString() || param.default?.toString()}
                      onValueChange={(val) => handleChange(param.name, val)}
                    >
                      <SelectTrigger id={param.name} className="h-9">
                        <SelectValue placeholder="Sélectionner..." />
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
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <span className="text-sm text-muted-foreground">
                        {param.description}
                      </span>
                      <Switch 
                        id={param.name} 
                        checked={localSettings[param.name] ?? param.default ?? false}
                        onCheckedChange={(val) => handleChange(param.name, val)}
                      />
                    </div>
                  ) :

                  /* NUMBER / INTEGER */
                  (param.type === 'integer' || param.type === 'number') ? (
                    <Input
                      id={param.name}
                      type="number"
                      className="h-9"
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
                      className="resize-none"
                    />
                  ) :

                  /* DEFAULT STRING INPUT */
                  (
                    <Input
                      id={param.name}
                      className="h-9"
                      value={localSettings[param.name] ?? param.default ?? ''}
                      onChange={(e) => handleChange(param.name, e.target.value)}
                      placeholder={String(param.default || '')}
                    />
                  )}
                  
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {param.description}
                    {param.range && param.range !== '-' && !param.range.includes(',') && (
                      <span className="ml-1 text-primary/70">Range: {param.range}</span>
                    )}
                  </p>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-background/95 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleReset}
              className="text-xs gap-1.5"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </Button>
            <Button 
              size="sm" 
              onClick={handleSaveAsDefault}
              className="text-xs gap-1.5"
            >
              <Save className="w-3 h-3" />
              Sauvegarder par défaut
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

