'use client';

import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Settings2, Info, Image as ImageIcon, FileCode, DollarSign } from 'lucide-react';
import { PriceDisplay } from './price-display';
import { getApiDocumentation } from '@/lib/api-docs';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { WaveSpeedModel } from '@/app/(authenticated)/settings/models/page';
import { cn } from '@/lib/utils';

import { useModelPreferences } from '@/hooks/use-model-preferences';
import { getModelSchema } from '@/lib/model-schemas';

// Remove local hook definition


interface ModelListProps {
  models: WaveSpeedModel[];
  searchQuery: string;
  selectedCategory: string | null;
  onActiveCategoriesChange: (categories: Set<string>) => void;
}

export function ModelList({ 
  models, 
  searchQuery, 
  selectedCategory,
  onActiveCategoriesChange 
}: ModelListProps) {
  const { preferences, toggleModel, loaded } = useModelPreferences();

  // Group models by family (e.g. "Kling", "Google", etc.)
  // We deduce family from the first part of model_uuid or tags
  const getFamily = (model: WaveSpeedModel) => {
    if (model.tags?.includes('kling')) return 'Kling Models';
    if (model.tags?.includes('google') || model.model_uuid.startsWith('google/')) return 'Google Models';
    if (model.tags?.includes('openai') || model.model_uuid.startsWith('openai/')) return 'OpenAI Models';
    if (model.tags?.includes('minimax') || model.model_uuid.includes('hailuo')) return 'Minimax Hailuo Models';
    if (model.model_uuid.startsWith('wavespeed-ai/')) return 'WaveSpeedAI Models';
    if (model.model_uuid.startsWith('stability-ai/')) return 'Stability AI Models';
    return 'Other Models';
  };

  // Filter models
  const filteredModels = models.filter(model => {
    const matchesSearch = 
      model.model_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory ? model.type === selectedCategory : true;
    
    return matchesSearch && matchesCategory;
  });

  // Group filtered models
  const groupedModels: Record<string, WaveSpeedModel[]> = {};
  filteredModels.forEach(model => {
    const family = getFamily(model);
    if (!groupedModels[family]) groupedModels[family] = [];
    groupedModels[family].push(model);
  });

  // Calculate active categories for sidebar
  useEffect(() => {
    if (!loaded) return;
    const activeCats = new Set<string>();
    models.forEach(model => {
      // Default to OFF if not in preferences
      if (preferences[model.model_uuid]) {
        activeCats.add(model.type);
      }
    });
    onActiveCategoriesChange(activeCats);
  }, [preferences, models, loaded, onActiveCategoriesChange]);

  if (!loaded) return <div>Loading preferences...</div>;

  return (
    <div className="space-y-8">
      {Object.entries(groupedModels).map(([family, familyModels]) => {
        // Check if any model in this family is enabled
        const isFamilyActive = familyModels.some(m => preferences[m.model_uuid]);

        return (
          <div key={family} className="space-y-4">
            <div className={cn(
              "px-4 py-2 rounded-lg border font-semibold text-lg flex items-center justify-between",
              isFamilyActive ? "bg-primary/10 border-primary/20 text-primary" : "bg-muted/30 border-muted text-muted-foreground"
            )}>
              {family}
              <Badge variant={isFamilyActive ? "default" : "secondary"}>
                {familyModels.length} models
              </Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {familyModels.map(model => (
                <ModelCard 
                  key={model.model_uuid} 
                  model={model} 
                  enabled={!!preferences[model.model_uuid]}
                  onToggle={(val) => toggleModel(model.model_uuid, val)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ModelCard({ model, enabled, onToggle }: { model: WaveSpeedModel, enabled: boolean, onToggle: (v: boolean) => void }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [imageError, setImageError] = useState(false);

  return (
    <Card className={cn(
      "flex flex-col overflow-hidden transition-all duration-200",
      enabled ? "ring-2 ring-primary border-primary" : "opacity-80 hover:opacity-100"
    )}>
      <div className="relative aspect-video bg-muted overflow-hidden group">
        {model.cover_url && !imageError ? (
           // eslint-disable-next-line @next/next/no-img-element
          <img 
            src={model.cover_url} 
            alt={model.model_name} 
            className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105" 
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-muted/50 p-4 text-center">
             <ImageIcon className="w-8 h-8 mb-2 opacity-20" />
             <span className="text-xs opacity-50 font-mono text-[10px] truncate w-full px-4">{model.model_name.split('/').pop()}</span>
          </div>
        )}
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <div className="absolute top-2 right-2 z-10">
          <Switch checked={enabled} onCheckedChange={onToggle} className="data-[state=checked]:bg-primary shadow-sm" />
        </div>
        
        <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end z-10">
             <Badge variant="secondary" className="backdrop-blur-md bg-black/60 text-white text-[10px] border-white/10 px-1.5 py-0.5 h-auto">
                {model.type}
             </Badge>
        </div>
      </div>

      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-lg font-bold tracking-tight leading-tight break-words" title={model.model_name}>
          {model.model_name}
        </CardTitle>
        <CardDescription className="text-xs line-clamp-2 h-8 mt-1">
          {model.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="p-4 pt-2 flex-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
            <span className="font-mono bg-muted px-1 rounded">{model.model_uuid}</span>
        </div>
        
        {/* Advanced Section embedded in card as requested */}
        <div className="border-t pt-2 mt-auto">
             <Button 
                variant="ghost" 
                size="sm" 
                className="w-full h-8 text-xs flex justify-between px-0 hover:bg-transparent text-muted-foreground hover:text-foreground"
                onClick={() => setShowAdvanced(!showAdvanced)}
            >
                <span>Details & Pricing</span>
                {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </Button>
            
            {showAdvanced && (
                <div className="pt-2 text-xs space-y-4 animate-in slide-in-from-top-2 duration-200">
                    <Tabs defaultValue="pricing" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 h-8">
                            <TabsTrigger value="pricing" className="text-[10px] h-6">Pricing</TabsTrigger>
                            <TabsTrigger value="api" className="text-[10px] h-6">API</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="pricing" className="mt-2 space-y-2">
                             <PriceDisplay model={model} />
                        </TabsContent>
                        
                        <TabsContent value="api" className="mt-4 space-y-6">
                            {(() => {
                                const doc = getApiDocumentation(model.model_uuid);
                                return (
                                    <div className="space-y-6">
                                        {/* Endpoint Section */}
                                        <div>
                                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                                                Submit Task & Query Result
                                            </h4>
                                            <div className="bg-zinc-950 rounded-md border border-zinc-800 overflow-hidden">
                                                <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-900/50">
                                                    <div className="flex gap-2 text-[10px] font-medium text-zinc-400">
                                                        <span className="text-zinc-100">cURL</span>
                                                        <span>Python</span>
                                                        <span>JavaScript</span>
                                                    </div>
                                                </div>
                                                <div className="p-3 overflow-x-auto">
                                                    <pre className="text-[10px] leading-relaxed font-mono text-zinc-300">
{`curl --location --request POST "${doc.endpoint}" \\
--header "Content-Type: application/json" \\
--header "Authorization: Bearer \${WAVESPEED_API_KEY}" \\
--data-raw '{
${doc.parameters.map(p => `    "${p.name}": ${p.type === 'integer' || p.type === 'number' || p.type === 'boolean' ? (p.default !== undefined ? p.default : '...') : `"${p.default !== undefined ? p.default : '...'}"`}`).join(',\n')}
}'`}
                                                    </pre>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Parameters Table */}
                                        <div>
                                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                                                Request Parameters
                                            </h4>
                                            <div className="rounded-md border overflow-hidden">
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-[11px] text-left">
                                                        <thead className="bg-muted/50 text-muted-foreground border-b font-medium">
                                                            <tr>
                                                                <th className="p-2 pl-3 w-1/4">Parameter</th>
                                                                <th className="p-2 w-1/6">Type</th>
                                                                <th className="p-2 w-1/12 text-center">Required</th>
                                                                <th className="p-2 w-1/6">Default</th>
                                                                <th className="p-2 w-1/4">Range</th>
                                                                <th className="p-2 pr-3 w-1/3">Description</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y">
                                                            {doc.parameters.map((p) => (
                                                                <tr key={p.name} className="hover:bg-muted/30 transition-colors">
                                                                    <td className="p-2 pl-3 font-mono text-primary font-medium">{p.name}</td>
                                                                    <td className="p-2 font-mono text-muted-foreground">{p.type}</td>
                                                                    <td className="p-2 text-center">
                                                                        {p.required ? (
                                                                            <Badge variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-400 text-[9px] px-1 py-0 h-4">Yes</Badge>
                                                                        ) : (
                                                                            <span className="text-muted-foreground opacity-50">No</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="p-2 font-mono text-muted-foreground break-words">
                                                                        {p.default !== undefined ? String(p.default) : '-'}
                                                                    </td>
                                                                    <td className="p-2 font-mono text-muted-foreground break-words text-[10px]">
                                                                        {p.range || '-'}
                                                                    </td>
                                                                    <td className="p-2 pr-3 text-muted-foreground leading-snug">
                                                                        {p.description}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                        {/* Response Parameters Table */}
                                        {doc.responseParameters && (
                                            <div>
                                                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                                                    Response Parameters
                                                </h4>
                                                <div className="rounded-md border overflow-hidden">
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-[11px] text-left">
                                                            <thead className="bg-muted/50 text-muted-foreground border-b font-medium">
                                                                <tr>
                                                                    <th className="p-2 pl-3 w-1/3">Parameter</th>
                                                                    <th className="p-2 w-1/4">Type</th>
                                                                    <th className="p-2 pr-3 w-1/2">Description</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y">
                                                                {doc.responseParameters.map((p) => (
                                                                    <tr key={p.name} className="hover:bg-muted/30 transition-colors">
                                                                        <td className="p-2 pl-3 font-mono text-primary font-medium">{p.name}</td>
                                                                        <td className="p-2 font-mono text-muted-foreground">{p.type}</td>
                                                                        <td className="p-2 pr-3 text-muted-foreground leading-snug">
                                                                            {p.description}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </TabsContent>
                    </Tabs>
                </div>
            )}
        </div>
      </CardContent>
    </Card>
  );
}

