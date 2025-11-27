import { generateImageAction } from '@/app/actions/image/create';
import { editImageAction } from '@/app/actions/image/edit';
import { NodeLayout } from '@/components/nodes/layout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useAnalytics } from '@/hooks/use-analytics';
import { download } from '@/lib/download';
import { handleError } from '@/lib/error/handle';
import { imageModels } from '@/lib/models/image';
import { getImagesFromImageNodes, getTextFromTextNodes } from '@/lib/xyflow';
import { useProject } from '@/providers/project';
import { getIncomers, useReactFlow } from '@xyflow/react';
import {
  ClockIcon,
  DownloadIcon,
  Loader2Icon,
  PlayIcon,
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
import { getAspectRatioSize } from '@/lib/models/image/aspect-ratio';

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

  // Calculer la taille : utiliser les dimensions personnalisées si définies, sinon l'aspect ratio
  const sizeFromSettings = useMemo(() => {
    if (advancedSettings.width && advancedSettings.height) {
      return `${advancedSettings.width}x${advancedSettings.height}`;
    }
    const { width, height } = getAspectRatioSize(advancedSettings.aspectRatio);
    return `${width}x${height}`;
  }, [advancedSettings.aspectRatio, advancedSettings.width, advancedSettings.height]);

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
      
      toast.success('Image générée !', {
        description: `⏱️ ${duration}s • 💰 ~$${cost.toFixed(3)}`,
        duration: Infinity,
        closeButton: true,
      });

      setTimeout(() => mutate('credits'), 5000);
    } catch (error) {
      handleError('Error generating image', error);
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
    
    // Dupliquer le nœud N-1 fois HORIZONTALEMENT (comme Flora)
    for (let i = 1; i < count; i++) {
      const newNodeId = `${id}-batch-${i}-${Date.now()}`;
      const offsetX = (currentNode.measured?.width ?? 400) + 50; // Horizontal spacing
      
      // Créer le nœud dupliqué
      const newNode = {
        ...currentNode,
        id: newNodeId,
        type: currentNode.type,
        position: {
          x: currentNode.position.x + (offsetX * i), // Horizontal offset
          y: currentNode.position.y,
        },
        selected: false,
        data: { ...currentNode.data },
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

    toast.info(`🚀 Lancement de ${count} génération${count > 1 ? 's' : ''} en PARALLÈLE...`, {
      duration: 3000,
    });

    // ÉTAPE 1: Mettre TOUS les nœuds en état de chargement AVANT de lancer les appels
    const startTime = Date.now();
    nodeIds.forEach((nodeId) => {
      updateNodeData(nodeId, {
        batchGenerating: true,
        batchStartTime: startTime,
      });
      console.log(`[Batch] Node ${nodeId} set to loading state`);
    });

    // ÉTAPE 2: Créer TOUTES les promesses SANS await (vraiment parallèle)
    const generatePromises = nodeIds.map((nodeId) => {
      console.log(`[Batch] Starting API call for node ${nodeId}`);
      
      const apiCall = imageNodes.length
        ? editImageAction({
            images: imageNodes,
            instructions: data.instructions,
            nodeId,
            projectId: project.id,
            modelId,
            size: sizeFromSettings,
          })
        : generateImageAction({
            prompt: textNodes.join('\n'),
            modelId,
            instructions: data.instructions,
            projectId: project.id,
            nodeId,
            size: sizeFromSettings,
          });
      
      return apiCall.then((response) => {
        console.log(`[Batch] Response for node ${nodeId}`);
        if ('error' in response) {
          updateNodeData(nodeId, { batchGenerating: false, batchStartTime: undefined });
          return { success: false, nodeId, error: response.error };
        }
        updateNodeData(nodeId, {
          ...response.nodeData,
          batchGenerating: false,
          batchStartTime: undefined,
        });
        return { success: true, nodeId };
      }).catch((error) => {
        console.error(`[Batch] Error for node ${nodeId}:`, error);
        updateNodeData(nodeId, { batchGenerating: false, batchStartTime: undefined });
        return { success: false, nodeId, error };
      });
    });
    
    console.log(`[Batch] All ${generatePromises.length} API calls started in parallel!`);

    // Attendre toutes les générations
    const results = await Promise.all(generatePromises);
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    const duration = Math.round((Date.now() - startTime) / 1000);
    const provider = selectedModel?.providers?.[0];
    const costPerImage = provider?.getCost?.({ size: sizeFromSettings }) ?? 0;
    const totalCost = costPerImage * successCount;

    if (failCount > 0) {
      toast.warning(`${successCount}/${count} images générées`, {
        description: `⏱️ ${duration}s • 💰 ~$${totalCost.toFixed(3)} • ${failCount} échec(s)`,
        duration: Infinity,
        closeButton: true,
      });
    } else {
      toast.success(`${successCount} image${successCount > 1 ? 's' : ''} générée${successCount > 1 ? 's' : ''} !`, {
        description: `⏱️ ${duration}s • 💰 ~$${totalCost.toFixed(3)}`,
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
    sizeFromSettings,
    selectedModel,
    updateNodeData,
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

    // Bouton paramètres avancés (remplace le sélecteur de taille)
    items.push({
      tooltip: 'Paramètres avancés',
      children: (
        <AdvancedSettingsPanel
          settings={advancedSettings}
          onChange={(settings) => {
            setAdvancedSettings(settings);
            updateNodeData(id, { advancedSettings: settings });
          }}
          modelId={modelId}
          supportsEdit={selectedModel?.supportsEdit}
        />
      ),
    });

    items.push(
      loading
        ? {
            tooltip: 'Generating...',
            children: (
              <Button size="icon" className="rounded-full" disabled>
                <Loader2Icon className="animate-spin" size={12} />
              </Button>
            ),
          }
        : {
            tooltip: data.generated?.url ? 'Regenerate' : 'Generate',
            children: (
              <Button
                size="icon"
                className="rounded-full"
                onClick={handleGenerate}
                disabled={loading || !project?.id}
              >
                {data.generated?.url ? (
                  <RotateCcwIcon size={12} />
                ) : (
                  <PlayIcon size={12} />
                )}
              </Button>
            ),
          }
    );

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
    const { width, height } = getAspectRatioSize(advancedSettings.aspectRatio);
    return `${width}/${height}`;
  }, [advancedSettings.aspectRatio]);

  // Combiner data avec advancedSettings pour le NodeLayout
  const nodeData = useMemo(() => ({
    ...data,
    advancedSettings,
  }), [data, advancedSettings]);

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
        <Skeleton
          className="flex w-full animate-pulse items-center justify-center rounded-b-xl flex-col gap-2"
          style={{ aspectRatio }}
        >
          <Loader2Icon
            size={24}
            className="size-6 animate-spin text-muted-foreground"
          />
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">
              Génération en cours...
            </p>
            <p className="text-xs text-muted-foreground/70">
              ~{elapsedTime}s
              {elapsedTime > 10 && " • Modèles 4K: ~60-90s"}
            </p>
          </div>
        </Skeleton>
      )}
      {!isGenerating && !data.generated?.url && (
        <div
          className="flex w-full items-center justify-center rounded-b-xl bg-secondary p-4"
          style={{ aspectRatio }}
        >
          <p className="text-muted-foreground text-sm">
            Press <PlayIcon size={12} className="-translate-y-px inline" /> to
            create an image
          </p>
        </div>
      )}
      {!isGenerating && data.generated?.url && (
        <Image
          src={data.generated.url}
          alt="Generated image"
          width={1000}
          height={1000}
          className="w-full rounded-b-xl object-cover"
        />
      )}
      <Textarea
        value={data.instructions ?? ''}
        onChange={handleInstructionsChange}
        placeholder="Enter instructions"
        className="shrink-0 resize-none rounded-none border-none bg-transparent! shadow-none focus-visible:ring-0"
      />
    </NodeLayout>
  );
};
