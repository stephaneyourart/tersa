'use client';

import { NodeLayout } from '@/components/nodes/layout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useModelParamsSidebar } from '@/components/model-params-sidebar';
import { ModelSelector } from '../model-selector';
import type { ComponentProps } from 'react';
import { useMemo } from 'react';
import { getIncomers, useReactFlow } from '@xyflow/react';
import { getTextFromTextNodes } from '@/lib/xyflow';
import { nanoid } from 'nanoid';
import { useCallback, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useProject } from '@/providers/project';
import { Loader2Icon, UserIcon, SaveIcon, Settings2Icon, ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import { T2I_MODELS, ASPECT_RATIOS, RESOLUTIONS, getT2IModel } from '@/lib/models-registry';
import type { CharacterNodeProps } from './index';

// Clé pour le stockage local du System Prompt par défaut
const SYSTEM_PROMPT_STORAGE_KEY = 'tersa-character-system-prompt-default';

const DEFAULT_SYSTEM_PROMPT = `Tu es un expert en character design. Génère une description visuelle détaillée.
Concentre-toi sur : l'apparence physique, les vêtements, le style distinctif, l'éclairage et l'ambiance.
Assure-toi que le personnage est bien isolé et cadré selon le ratio demandé.`;

export const CharacterTransform = ({
  data,
  id,
  type,
  title,
}: CharacterNodeProps & { title: string }) => {
  const { updateNodeData, addNodes, addEdges, getNode, getNodes, getEdges, fitView } = useReactFlow();
  const [loading, setLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const project = useProject();

  // Chargement du System Prompt (Données du nœud > LocalStorage > Défaut)
  useEffect(() => {
    if (data.advancedSettings && typeof (data.advancedSettings as any).systemPrompt === 'string') {
        return; // Déjà chargé dans le nœud
    }

    // Sinon, charger depuis le stockage local ou le défaut
    const savedDefault = localStorage.getItem(SYSTEM_PROMPT_STORAGE_KEY);
    const initialSystemPrompt = savedDefault || DEFAULT_SYSTEM_PROMPT;

    // Mettre à jour le nœud avec ce défaut sans écraser les autres settings
    updateNodeData(id, {
        advancedSettings: {
            ...(data.advancedSettings as object || {}),
            systemPrompt: initialSystemPrompt
        }
    });
  }, []); // Exécuter une seule fois au montage

  const { openSidebar } = useModelParamsSidebar();
  
  // Settings pour la sidebar
  const settings = (data.advancedSettings || {}) as Record<string, any>;
  
  // Modèle sélectionné
  const selectedModel = data.model || (settings.model as string) || T2I_MODELS[0]?.id || '';
  
  // System prompt
  const systemPrompt = (settings.systemPrompt as string) || '';
  
  // Ratio et résolution
  const selectedRatio = (settings.aspectRatio as string) || ASPECT_RATIOS[0]?.id || '1:1';
  const selectedResolution = (settings.resolution as string) || RESOLUTIONS[0]?.id || '1024x1024';

  // Mettre à jour les settings dans le nœud (défini avant useMemo)
  const updateSettings = useCallback((updates: Record<string, any>) => {
    updateNodeData(id, {
      advancedSettings: {
        ...settings,
        ...updates
      }
    });
  }, [id, settings, updateNodeData]);

  // Hook pour la sidebar des paramètres - comme ImageTransform
  const handleModelSelected = useCallback((selectedModelId: string) => {
    openSidebar(selectedModelId, id, settings, (newSettings) => {
      updateNodeData(id, { advancedSettings: newSettings });
    });
  }, [id, settings, openSidebar, updateNodeData]);

  // Détection des entrées texte
  const incomers = getIncomers({ id }, getNodes(), getEdges());
  const incomingText = getTextFromTextNodes(incomers).join('\n');
  const hasIncoming = incomingText.length > 0;

  const placeholder = hasIncoming 
    ? "Ce que vous écrivez ici viendra s'ajouter au prompt en entrée..."
    : "Décrivez votre personnage (ex: Cyberpunk samurai with neon armor...)";
    
  const label = hasIncoming
    ? "Description additionnelle"
    : "Description du personnage";

  // Toolbar avec sélecteur de modèle - comme ImageTransform
  const toolbar = useMemo<ComponentProps<typeof NodeLayout>['toolbar']>(() => {
    return [
      {
        children: (
          <ModelSelector
            value={selectedModel}
            // On peut réutiliser T2I_MODELS mais formaté pour ModelSelector
            // Ou utiliser useAvailableModels('image') si on veut la liste complète
            options={T2I_MODELS.reduce((acc, m) => ({ 
                ...acc, 
                [m.id]: { label: m.displayName, chef: { name: 'WaveSpeed', icon: () => null }, providers: [] } 
            }), {})}
            id={id}
            className="w-[200px] rounded-full"
            onChange={(value) => updateSettings({ model: value })}
            onModelSelected={handleModelSelected}
          />
        ),
      },
    ];
  }, [selectedModel, id, updateSettings, handleModelSelected]);

  // Sauvegarder le System Prompt actuel comme défaut global
  const handleSaveDefaultSystemPrompt = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (systemPrompt) {
        localStorage.setItem(SYSTEM_PROMPT_STORAGE_KEY, systemPrompt);
        toast.success("System Prompt sauvegardé comme défaut pour tous les projets");
    }
  }, [systemPrompt]);

  const handleGenerate = useCallback(async () => {
    // 1. Construire le prompt complet : System Prompt + Input + Instructions
    const localInstructions = data.instructions || '';
    
    let finalPromptParts = [];
    
    // Ajouter le System Prompt s'il existe
    if (systemPrompt && systemPrompt.trim()) {
        finalPromptParts.push(`[SYSTEM INSTRUCTIONS]\n${systemPrompt}\n[/SYSTEM INSTRUCTIONS]`);
    }

    // Ajouter le contexte (input + local)
    const userPrompt = hasIncoming 
        ? `${incomingText}\n\n${localInstructions}`.trim()
        : localInstructions;
    
    if (userPrompt) {
        finalPromptParts.push(userPrompt);
    }

    const finalPrompt = finalPromptParts.join('\n\n');

    if (loading || !project?.id || !finalPrompt) {
      if (!finalPrompt) toast.error('Veuillez fournir une description.');
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Génération du personnage en cours...');

    try {
      const imageNodeIds = Array.from({ length: 4 }).map(() => `node-${nanoid()}`);
      
      const jobs = imageNodeIds.map((nodeId) => ({
        nodeId,
        modelPath: selectedModel,
        prompt: finalPrompt,
        params: {
          aspect_ratio: selectedRatio,
          resolution: selectedResolution,
        },
      }));

      const response = await fetch('/api/batch-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobs, projectId: project.id }),
      });

      if (!response.ok) throw new Error('Erreur lors de la génération');

      const batchResult = await response.json();
      const results = batchResult.results || [];

      if (results.length === 0) {
        toast.warning('Aucun résultat retourné par l\'API', { id: toastId });
        return;
      }

      // Création des nœuds (inchangé)
      const currentNode = getNode(id);
      if (!currentNode) {
        toast.error('Erreur: Nœud source introuvable');
        return;
      }

      const sourcePos = currentNode.position || { x: 0, y: 0 };
      const sourceWidth = currentNode.measured?.width ?? 350;
      const baseX = sourcePos.x + sourceWidth + 100;
      const baseY = sourcePos.y;
      
      const newNodes = [];
      const newEdges = [];

      results.forEach((result: any, index: number) => {
        if (result.success && result.imageUrl) {
            newNodes.push({
                id: result.nodeId,
                type: 'image',
                position: { x: baseX, y: baseY + (index * 450) },
                data: {
                    generated: {
                        url: result.imageUrl,
                        type: 'image/png',
                    },
                    instructions: finalPrompt, // On sauvegarde le prompt complet utilisé
                    model: selectedModel,
                    modelId: selectedModel,
                    isGenerated: true,
                    localPath: result.localPath,
                    updatedAt: new Date().toISOString(),
                    advancedSettings: {
                        aspect_ratio: selectedRatio,
                        resolution: selectedResolution
                    }
                },
            });
        }
      });

      const collectionId = `collection-${nanoid()}`;
      const collectionItems = results
        .filter((r: any) => r.success && r.imageUrl)
        .map((r: any) => ({
            id: nanoid(),
            type: 'image',
            enabled: true,
            url: r.imageUrl,
            width: 1024,
            height: 1024,
            name: `Variation ${r.nodeId.slice(-4)}`
        }));

      if (collectionItems.length > 0) {
          newNodes.push({
              id: collectionId,
              type: 'collection',
              position: { x: baseX + 500, y: baseY + 200 },
              data: {
                  label: 'Variations Personnage',
                  items: collectionItems,
                  activeTab: 'image',
              }
          });

          imageNodeIds.forEach((imgId) => {
              if (newNodes.find(n => n.id === imgId)) {
                  newEdges.push({
                      id: `edge-${imgId}-${collectionId}`,
                      source: imgId,
                      target: collectionId,
                      type: 'default',
                  });
              }
          });
          
          imageNodeIds.forEach((imgId) => {
               if (newNodes.find(n => n.id === imgId)) {
                  newEdges.push({
                      id: `edge-${id}-${imgId}`,
                      source: id,
                      target: imgId,
                      type: 'default',
                  });
              }
          });
      }

      addNodes(newNodes);
      addEdges(newEdges);

      if (newNodes.length > 0) {
        toast.success(`Génération réussie : ${newNodes.length} éléments créés !`, { id: toastId });
        setTimeout(() => {
            fitView({ 
                nodes: [{ id: newNodes[0].id }], 
                duration: 800, 
                padding: 0.5 
            });
        }, 100);
      } else {
        toast.warning('Génération terminée mais aucun nœud valide n\'a été créé.', { id: toastId });
      }

    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la génération', { id: toastId });
    } finally {
      setLoading(false);
    }
  }, [loading, project?.id, data.instructions, id, getNode, addNodes, addEdges, incomingText, hasIncoming, selectedModel, selectedRatio, selectedResolution, systemPrompt]);

  // Filtrage des options (inchangé)
  const t2iModel = getT2IModel(selectedModel);
  const supportedRatios = t2iModel?.supportedAspectRatios || [];
  const filteredRatios = ASPECT_RATIOS.filter(ar => supportedRatios.includes(ar.id));
  const supportedResolutions = t2iModel?.supportedResolutions || [];
  const filteredResolutions = RESOLUTIONS.filter(r => supportedResolutions.includes(r.id));

  return (
    <NodeLayout 
        id={id} 
        data={data} 
        type={type} 
        title={title}
        toolbar={toolbar}
    >
      <div className="flex flex-col gap-4 p-4 min-w-[300px]">
        
        {/* Header */}
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
            <UserIcon className="w-5 h-5" />
            <span className="text-sm font-medium">{label}</span>
            </div>
            {hasIncoming && (
                <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20">
                    Input connecté
                </span>
            )}
        </div>
        
        {/* Main Prompt Input */}
        <Textarea
          value={data.instructions || ''}
          onChange={(e) => updateNodeData(id, { instructions: e.target.value })}
          placeholder={placeholder}
          className="min-h-[80px] resize-none bg-background/50 text-xs"
        />

        {/* Panneau de configuration dépliable */}
        <div className="border border-border/50 rounded-lg overflow-hidden">
          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Settings2Icon className="w-4 h-4" />
              <span>Configuration</span>
            </div>
            {isSettingsOpen ? (
              <ChevronDownIcon className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRightIcon className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          
          {isSettingsOpen && (
            <div className="p-3 space-y-4 border-t border-border/50">
              {/* System Prompt */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">System Prompt</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSaveDefaultSystemPrompt}
                    className="h-6 px-2 text-[10px]"
                    title="Sauvegarder comme défaut"
                  >
                    <SaveIcon className="w-3 h-3 mr-1" />
                    Défaut
                  </Button>
                </div>
                <Textarea
                  value={systemPrompt}
                  onChange={(e) => updateSettings({ systemPrompt: e.target.value })}
                  placeholder="Instructions système pour le générateur..."
                  className="min-h-[60px] resize-none bg-background/50 text-[10px]"
                />
              </div>

              {/* Ratio */}
              {filteredRatios.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs">Format</Label>
                  <div className="flex flex-wrap gap-1">
                    {filteredRatios.map((ratio) => (
                      <button
                        key={ratio.id}
                        onClick={() => updateSettings({ aspectRatio: ratio.id })}
                        className={`px-2 py-1 text-[10px] rounded-md border transition-colors ${
                          selectedRatio === ratio.id
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background/50 border-border hover:bg-muted'
                        }`}
                      >
                        {ratio.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Résolution */}
              {filteredResolutions.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs">Résolution</Label>
                  <div className="flex flex-wrap gap-1">
                    {filteredResolutions.map((res) => (
                      <button
                        key={res.id}
                        onClick={() => updateSettings({ resolution: res.id })}
                        className={`px-2 py-1 text-[10px] rounded-md border transition-colors ${
                          selectedResolution === res.id
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background/50 border-border hover:bg-muted'
                        }`}
                      >
                        {res.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <Button 
            onClick={handleGenerate} 
            disabled={loading || (!data.instructions && !hasIncoming)}
            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-500/20"
        >
            {loading ? (
                <>
                    <Loader2Icon className="w-4 h-4 mr-2 animate-spin" />
                    Génération...
                </>
            ) : (
                <>
                    <UserIcon className="w-4 h-4 mr-2" />
                    Générer Variations
                </>
            )}
        </Button>
      </div>
    </NodeLayout>
  );
};
