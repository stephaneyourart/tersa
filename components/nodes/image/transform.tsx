import { generateImageAction } from '@/app/actions/image/create';
import { editImageAction } from '@/app/actions/image/edit';
import { NodeLayout } from '@/components/nodes/layout';
import { Button } from '@/components/ui/button';
import { GeneratingSkeleton } from '@/components/nodes/generating-skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useAnalytics } from '@/hooks/use-analytics';
import { useGenerationTracker } from '@/hooks/use-generation-tracker';
import { download } from '@/lib/download';
import { handleError } from '@/lib/error/handle';
import { imageModels } from '@/lib/models/image';
import { getImagesFromImageNodes, getTextFromTextNodes } from '@/lib/xyflow';
import { useProject } from '@/providers/project';
import { getIncomers, useReactFlow } from '@xyflow/react';
import {
  ArrowUpIcon,
  ClockIcon,
  DownloadIcon,
  Loader2Icon,
  RotateCcwIcon,
} from 'lucide-react';
import Image from 'next/image';
import {
  type ChangeEventHandler,
  type ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { toast } from 'sonner';
import { mutate } from 'swr';
import type { ImageNodeProps } from '.';
import { ModelSelector } from '../model-selector';
import { AdvancedSettingsPanel, DEFAULT_SETTINGS, type ImageAdvancedSettings } from './advanced-settings';

type ImageTransformProps = ImageNodeProps & {
  title: string;
};

const getDefaultModel = (models: typeof imageModels) => {
  const defaultModel = Object.entries(models).find(
    ([_, model]) => model.default
  );

  if (!defaultModel) {
    throw new Error('No default model found');
  }

  return defaultModel[0];
};

export const ImageTransform = ({
  data,
  id,
  type,
  title,
}: ImageTransformProps) => {
  const { updateNodeData, getNodes, getEdges, addNodes, addEdges, getNode } = useReactFlow();
  const [loading, setLoading] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [advancedSettings, setAdvancedSettings] = useState<ImageAdvancedSettings>(
    data.advancedSettings ?? DEFAULT_SETTINGS
  );
  const project = useProject();
  const { trackGeneration } = useGenerationTracker();

  // État de génération: soit local (single run), soit batch
  const isGenerating = loading || data.batchGenerating === true;
  const generationStartTime = data.batchStartTime ?? null;

  // Timer pour afficher le temps écoulé pendant la génération
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating) {
      // Si on a un batchStartTime, calculer depuis celui-ci
      if (generationStartTime) {
        const updateTime = () => {
          setElapsedTime(Math.floor((Date.now() - generationStartTime) / 1000));
        };
        updateTime();
        interval = setInterval(updateTime, 1000);
      } else {
        // Sinon, compteur local
        setElapsedTime(0);
        interval = setInterval(() => {
          setElapsedTime((prev) => prev + 1);
        }, 1000);
      }
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isGenerating, generationStartTime]);
  const hasIncomingImageNodes =
    getImagesFromImageNodes(getIncomers({ id }, getNodes(), getEdges()))
      .length > 0;
  const modelId = data.model ?? getDefaultModel(imageModels);
  const analytics = useAnalytics();
  const selectedModel = imageModels[modelId];
  
  // Extraire le chemin WaveSpeed du modèle (ex: 'google/nano-banana/text-to-image')
  const modelPath = useMemo(() => {
    const modelObj = selectedModel?.providers?.[0]?.model as { modelId?: string } | undefined;
    return modelObj?.modelId || '';
  }, [selectedModel]);

  // Calculer la taille à partir des settings
  const sizeFromSettings = useMemo(() => {
    // Pour les nouveaux settings WaveSpeed, on n'a plus width/height
    // On utilise l'aspect_ratio pour calculer une taille par défaut
    if (advancedSettings.aspect_ratio) {
      // Mapping simple aspect ratio -> dimensions
      const sizeMap: Record<string, string> = {
        '1:1': '1024x1024',
        '16:9': '1344x768',
        '9:16': '768x1344',
        '4:3': '1152x896',
        '3:4': '896x1152',
        '3:2': '1216x832',
        '2:3': '832x1216',
        '21:9': '1536x640',
        '9:21': '640x1536',
        '4:5': '896x1120',
        '5:4': '1120x896',
      };
      return sizeMap[advancedSettings.aspect_ratio] || '1024x1024';
    }
    return '1024x1024';
  }, [advancedSettings.aspect_ratio]);

  const handleGenerate = useCallback(async () => {
    if (loading || !project?.id) {
      return;
    }

    const startTime = Date.now();
    const incomers = getIncomers({ id }, getNodes(), getEdges());
    const textNodes = getTextFromTextNodes(incomers);
    const imageNodes = getImagesFromImageNodes(incomers);

    try {
      if (!textNodes.length && !imageNodes.length) {
        throw new Error('No input provided');
      }

      setLoading(true);

      analytics.track('canvas', 'node', 'generate', {
        type,
        textPromptsLength: textNodes.length,
        imagePromptsLength: imageNodes.length,
        model: modelId,
        instructionsLength: data.instructions?.length ?? 0,
      });

      const response = imageNodes.length
        ? await editImageAction({
            images: imageNodes,
            instructions: data.instructions,
            nodeId: id,
            projectId: project.id,
            modelId,
            size: sizeFromSettings,
          })
        : await generateImageAction({
            prompt: textNodes.join('\n'),
            modelId,
            instructions: data.instructions,
            projectId: project.id,
            nodeId: id,
            size: sizeFromSettings,
          });

      if ('error' in response) {
        throw new Error(response.error);
      }

      updateNodeData(id, response.nodeData);

      // Calculer le temps écoulé et le coût estimé
      const duration = Math.round((Date.now() - startTime) / 1000);
      const provider = selectedModel?.providers?.[0];
      const cost = provider?.getCost?.({ size: sizeFromSettings }) ?? 0;
      
      // Tracker la génération
      trackGeneration({
        type: 'image',
        model: modelId,
        modelLabel: selectedModel?.label,
        prompt: data.instructions,
        duration,
        cost,
        status: 'success',
        outputUrl: response.nodeData?.generated?.url,
        nodeId: id,
        nodeName: (data as { customName?: string }).customName,
        size: sizeFromSettings,
      });
      
      toast.success('Image générée !', {
        description: `⏱️ ${duration}s • 💰 ~$${cost.toFixed(3)}`,
        duration: Infinity,
        closeButton: true,
      });

      setTimeout(() => mutate('credits'), 5000);
    } catch (error) {
      handleError('Error generating image', error);
      
      // Tracker l'erreur
      trackGeneration({
        type: 'image',
        model: modelId,
        modelLabel: selectedModel?.label,
        prompt: data.instructions,
        duration: Math.round((Date.now() - startTime) / 1000),
        cost: 0,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        nodeId: id,
        nodeName: (data as { customName?: string }).customName,
      });
    } finally {
      setLoading(false);
    }
  }, [
    loading,
    project?.id,
    sizeFromSettings,
    id,
    analytics,
    type,
    data.instructions,
    getEdges,
    modelId,
    selectedModel,
    getNodes,
    updateNodeData,
    trackGeneration,
  ]);

  // Handler pour le batch : duplique le nœud N-1 fois et lance N générations en parallèle
  const handleBatchRun = useCallback(async (count: number) => {
    console.log(`[Batch] handleBatchRun called with count: ${count}`);
    
    if (loading) {
      console.log('[Batch] Blocked: already loading');
      return;
    }
    if (!project?.id) {
      console.log('[Batch] Blocked: no project id');
      return;
    }
    if (count < 1) {
      console.log('[Batch] Blocked: count < 1');
      return;
    }

    const currentNode = getNode(id);
    if (!currentNode) {
      console.log('[Batch] Blocked: node not found');
      return;
    }
    
    console.log('[Batch] Starting batch run for node:', id, 'type:', currentNode.type);

    const incomers = getIncomers({ id }, getNodes(), getEdges());
    const textNodes = getTextFromTextNodes(incomers);
    const imageNodes = getImagesFromImageNodes(incomers);

    if (!textNodes.length && !imageNodes.length) {
      handleError('Error', new Error('No input provided'));
      return;
    }

    // Collecter tous les nœuds (original + à dupliquer)
    const nodeIds: string[] = [id];
    const edges = getEdges().filter(e => e.target === id);
    
    // Le prompt à afficher dans "Enter instructions"
    const promptText = textNodes.join('\n');
    
    // Mettre à jour le nœud original avec le prompt dans les instructions
    updateNodeData(id, { instructions: promptText });
    
    // Dupliquer le nœud N-1 fois HORIZONTALEMENT (comme Flora)
    for (let i = 1; i < count; i++) {
      const newNodeId = `${id}-batch-${i}-${Date.now()}`;
      const offsetX = (currentNode.measured?.width ?? 400) + 50; // Horizontal spacing
      
      // Créer le nœud dupliqué avec le prompt dans les instructions
      const newNode = {
        ...currentNode,
        id: newNodeId,
        type: currentNode.type,
        position: {
          x: currentNode.position.x + (offsetX * i), // Horizontal offset
          y: currentNode.position.y,
        },
        selected: false,
        data: { 
          ...currentNode.data,
          instructions: promptText, // Copier le prompt dans les instructions
        },
      };
      
      console.log(`[Batch] Creating node ${i}:`, newNode.id, 'at', newNode.position);
      addNodes(newNode);

      // Dupliquer les connexions entrantes
      for (const edge of edges) {
        const newEdge = {
          ...edge,
          id: `${edge.id}-batch-${i}-${Date.now()}`,
          target: newNodeId,
        };
        console.log(`[Batch] Creating edge:`, newEdge.id);
        addEdges(newEdge);
      }

      nodeIds.push(newNodeId);
    }
    
    console.log(`[Batch] Total nodes to generate:`, nodeIds);

    toast.info(`🚀 Lancement de ${count} génération${count > 1 ? 's' : ''} en PARALLÈLE via API batch...`, {
      duration: 3000,
    });

    // ÉTAPE 1: Mettre TOUS les nœuds en état de chargement AVANT de lancer les appels
    const startTime = Date.now();
    nodeIds.forEach((nodeId) => {
      updateNodeData(nodeId, {
        batchGenerating: true,
        batchStartTime: startTime,
      });
    });

    // ÉTAPE 2: Préparer les jobs pour l'API batch
    const isEdit = imageNodes.length > 0;
    
    // Extraire les URLs des images (WaveSpeed attend un tableau de strings, pas d'objets)
    const imageUrls = imageNodes.map(img => img.url);
    
    console.log(`[Batch] Model path: ${modelPath}`);
    console.log(`[Batch] Is edit mode: ${isEdit}`);
    console.log(`[Batch] Image URLs:`, imageUrls);
    console.log(`[Batch] Advanced settings:`, advancedSettings);
    
    // Les params sont directement ceux de advancedSettings (format WaveSpeed)
    const jobs = nodeIds.map((nodeId) => ({
      nodeId,
      modelPath: modelPath,
      prompt: isEdit ? (data.instructions || textNodes.join('\n')) : textNodes.join('\n'),
      images: isEdit ? imageUrls : undefined, // URLs uniquement, pas d'objets
      params: {
        aspect_ratio: advancedSettings.aspect_ratio,
        resolution: advancedSettings.resolution,
        output_format: advancedSettings.output_format,
        seed: advancedSettings.seed,
        guidance_scale: advancedSettings.guidance_scale,
        num_inference_steps: advancedSettings.num_inference_steps,
        negative_prompt: advancedSettings.negative_prompt,
      },
    }));

    console.log(`[Batch] Sending ${jobs.length} jobs to /api/batch-generate`);
    console.log(`[Batch] Model path: ${modelPath}`);

    // ÉTAPE 3: Appeler l'API batch qui fait les appels en PARALLÈLE côté serveur
    try {
      const response = await fetch('/api/batch-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobs, projectId: project.id }),
      });

      if (!response.ok) {
        throw new Error(`Batch API error: ${response.status}`);
      }

      const batchResult = await response.json();
      console.log(`[Batch] API response:`, batchResult);

      // Mettre à jour chaque nœud avec son résultat
      const results = batchResult.results || [];
      const duration = batchResult.totalDuration || Math.round((Date.now() - startTime) / 1000);
      const provider = selectedModel?.providers?.[0];
      const costPerImage = provider?.getCost?.({ size: sizeFromSettings }) ?? 0;
      
      for (const result of results) {
        if (result.success && result.imageUrl) {
          updateNodeData(result.nodeId, {
            generated: {
              url: result.imageUrl,
              type: 'image/png',
            },
            batchGenerating: false,
            batchStartTime: undefined,
            updatedAt: new Date().toISOString(),
          });
          
          // Tracker la génération réussie
          trackGeneration({
            type: 'image',
            model: modelId,
            modelLabel: selectedModel?.label,
            prompt: textNodes.join('\n') || data.instructions,
            duration: Math.round(duration / count), // Durée moyenne par image
            cost: costPerImage,
            status: 'success',
            outputUrl: result.imageUrl,
            nodeId: result.nodeId,
            nodeName: (data as { customName?: string }).customName,
            size: sizeFromSettings,
          });
        } else {
          updateNodeData(result.nodeId, {
            batchGenerating: false,
            batchStartTime: undefined,
          });
          console.error(`[Batch] Failed for node ${result.nodeId}:`, result.error);
          
          // Tracker l'erreur
          trackGeneration({
            type: 'image',
            model: modelId,
            modelLabel: selectedModel?.label,
            prompt: textNodes.join('\n') || data.instructions,
            duration: Math.round(duration / count),
            cost: 0,
            status: 'error',
            error: result.error || 'Unknown error',
            nodeId: result.nodeId,
            nodeName: (data as { customName?: string }).customName,
          });
        }
      }

      const successCount = results.filter((r: { success: boolean }) => r.success).length;
      const failCount = results.filter((r: { success: boolean }) => !r.success).length;
      const totalCost = costPerImage * successCount;

      if (failCount > 0) {
        toast.warning(`${successCount}/${count} images générées en PARALLÈLE`, {
          description: `⏱️ ${duration}s total • 💰 ~$${totalCost.toFixed(3)} • ${failCount} échec(s)`,
          duration: Infinity,
          closeButton: true,
        });
      } else {
        toast.success(`✅ ${successCount} image${successCount > 1 ? 's' : ''} générée${successCount > 1 ? 's' : ''} en PARALLÈLE !`, {
          description: `⏱️ ${duration}s total • 💰 ~$${totalCost.toFixed(3)}`,
          duration: Infinity,
          closeButton: true,
        });
      }
    } catch (error) {
      console.error('[Batch] Error:', error);
      // Reset all nodes on error
      nodeIds.forEach((nodeId) => {
        updateNodeData(nodeId, {
          batchGenerating: false,
          batchStartTime: undefined,
        });
        
        // Tracker l'erreur pour chaque nœud
        trackGeneration({
          type: 'image',
          model: modelId,
          modelLabel: selectedModel?.label,
          prompt: data.instructions,
          duration: Math.round((Date.now() - startTime) / 1000),
          cost: 0,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          nodeId,
          nodeName: (data as { customName?: string }).customName,
        });
      });
      toast.error('Erreur lors du batch', {
        description: error instanceof Error ? error.message : 'Erreur inconnue',
        duration: Infinity,
        closeButton: true,
      });
    }

    setTimeout(() => mutate('credits'), 5000);
  }, [
    loading,
    project?.id,
    id,
    getNode,
    getNodes,
    getEdges,
    addNodes,
    addEdges,
    data.instructions,
    modelId,
    modelPath,
    sizeFromSettings,
    advancedSettings,
    selectedModel,
    updateNodeData,
    trackGeneration,
  ]);

  const handleInstructionsChange: ChangeEventHandler<HTMLTextAreaElement> = (
    event
  ) => updateNodeData(id, { instructions: event.target.value });

  const toolbar = useMemo<ComponentProps<typeof NodeLayout>['toolbar']>(() => {
    const availableModels = Object.fromEntries(
      Object.entries(imageModels).map(([key, model]) => [
        key,
        {
          ...model,
          disabled: hasIncomingImageNodes
            ? !model.supportsEdit
            : model.disabled,
        },
      ])
    );

    const items: ComponentProps<typeof NodeLayout>['toolbar'] = [
      {
        children: (
          <ModelSelector
            value={modelId}
            options={availableModels}
            id={id}
            className="w-[200px] rounded-full"
            onChange={(value) => updateNodeData(id, { model: value })}
          />
        ),
      },
    ];

    // Bouton paramètres avancés - affiche uniquement les params supportés par le modèle
    items.push({
      tooltip: 'Paramètres avancés',
      children: (
        <AdvancedSettingsPanel
          settings={advancedSettings}
          onSettingsChange={(settings) => {
            setAdvancedSettings(settings);
            updateNodeData(id, { advancedSettings: settings });
          }}
          modelId={modelId}
          modelPath={modelPath}
        />
      ),
    });

    // Afficher un loader dans la toolbar si en cours de génération
    if (loading) {
      items.push({
        tooltip: 'Generating...',
        children: (
          <Button size="icon" variant="ghost" className="rounded-full" disabled>
            <Loader2Icon className="animate-spin" size={12} />
          </Button>
        ),
      });
    }

    if (data.generated) {
      items.push({
        tooltip: 'Download',
        children: (
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => download(data.generated, id, 'png')}
          >
            <DownloadIcon size={12} />
          </Button>
        ),
      });
    }

    if (data.updatedAt) {
      items.push({
        tooltip: `Last updated: ${new Intl.DateTimeFormat('en-US', {
          dateStyle: 'short',
          timeStyle: 'short',
        }).format(new Date(data.updatedAt))}`,
        children: (
          <Button size="icon" variant="ghost" className="rounded-full">
            <ClockIcon size={12} />
          </Button>
        ),
      });
    }

    return items;
  }, [
    modelId,
    hasIncomingImageNodes,
    id,
    updateNodeData,
    selectedModel?.sizes,
    selectedModel?.supportsEdit,
    sizeFromSettings,
    loading,
    data.generated,
    data.updatedAt,
    handleGenerate,
    project?.id,
    advancedSettings,
  ]);

  const aspectRatio = useMemo(() => {
    // Calculer l'aspect ratio pour l'affichage
    const ratio = advancedSettings.aspect_ratio || '1:1';
    const [w, h] = ratio.split(':').map(Number);
    // Utiliser une taille de base pour le ratio d'affichage
    return `${w}/${h}`;
  }, [advancedSettings.aspect_ratio]);

  // Combiner data avec advancedSettings pour le NodeLayout
  const nodeData = useMemo(() => ({
    ...data,
    advancedSettings,
  }), [data, advancedSettings]);

  const [isHovered, setIsHovered] = useState(false);
  const hasContent = isGenerating || data.generated?.url;
  const hasPrompt = Boolean(data.instructions?.trim());

  return (
    <NodeLayout 
      id={id} 
      data={nodeData} 
      type={type} 
      title={title} 
      toolbar={toolbar}
      modelLabel={selectedModel?.label}
      onBatchRun={handleBatchRun}
    >
      {isGenerating && (
        <GeneratingSkeleton
          className="rounded-b-xl"
          estimatedDuration={30} // Image ~30 secondes
          startTime={data.batchStartTime}
        />
      )}
      {!isGenerating && !data.generated?.url && (
        <div
          className="flex w-full items-center justify-center rounded-b-xl bg-secondary p-4"
          style={{ aspectRatio }}
        >
          <p className="text-muted-foreground text-sm">
            Press <ArrowUpIcon size={12} className="-translate-y-px inline" /> to
            create an image
          </p>
        </div>
      )}
      {!isGenerating && data.generated?.url && (
        <div 
          className="relative"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <Image
            src={data.generated.url}
            alt="Generated image"
            width={1000}
            height={1000}
            className="w-full rounded-b-xl object-cover"
          />
          {/* Overlay du prompt au hover */}
          {hasPrompt && isHovered && (
            <div className="absolute inset-0 flex items-end rounded-b-xl bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 transition-opacity">
              <p className="text-white text-xs leading-relaxed line-clamp-4 drop-shadow-lg">
                {data.instructions}
              </p>
            </div>
          )}
        </div>
      )}
      {/* Textarea visible uniquement quand pas de contenu */}
      {!hasContent && (
        <Textarea
          value={data.instructions ?? ''}
          onChange={handleInstructionsChange}
          placeholder="Enter instructions"
          className="shrink-0 resize-none rounded-none border-none bg-transparent! shadow-none focus-visible:ring-0"
        />
      )}
    </NodeLayout>
  );
};
