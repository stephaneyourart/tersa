import { generateVideoAction } from '@/app/actions/video/create';
import { NodeLayout } from '@/components/nodes/layout';
import { Button } from '@/components/ui/button';
import { GeneratingSkeleton } from '@/components/nodes/generating-skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useAnalytics } from '@/hooks/use-analytics';
import { download } from '@/lib/download';
import { handleError } from '@/lib/error/handle';
import { videoModels } from '@/lib/models/video';
import { getImagesFromImageNodes, getTextFromTextNodes } from '@/lib/xyflow';
import { useProject } from '@/providers/project';
import { getIncomers, useReactFlow, useStore } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import {
  ClockIcon,
  DownloadIcon,
  Loader2Icon,
  PlayIcon,
  RotateCcwIcon,
} from 'lucide-react';
import { type ChangeEventHandler, type ComponentProps, useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { mutate } from 'swr';
import type { VideoNodeProps } from '.';
import { ModelSelector } from '../model-selector';
import { VideoAdvancedSettingsPanel, DEFAULT_VIDEO_SETTINGS, type VideoAdvancedSettings } from './advanced-settings';

type VideoTransformProps = VideoNodeProps & {
  title: string;
};

const getDefaultModel = (models: typeof videoModels) => {
  const defaultModel = Object.entries(models).find(
    ([_, model]) => model.default
  );

  if (!defaultModel) {
    throw new Error('No default model found');
  }

  return defaultModel[0];
};

export const VideoTransform = ({
  data,
  id,
  type,
  title,
}: VideoTransformProps) => {
  const { updateNodeData, getNodes, getEdges, getNode, addNodes, addEdges } = useReactFlow();
  const [loading, setLoading] = useState(false);
  const [advancedSettings, setAdvancedSettings] = useState<VideoAdvancedSettings>(
    data.advancedSettings || DEFAULT_VIDEO_SETTINGS
  );
  const project = useProject();
  const modelId = data.model ?? getDefaultModel(videoModels);
  const analytics = useAnalytics();

  // Récupérer le modèle sélectionné et son path
  const selectedModel = videoModels[modelId];
  const modelPath = useMemo(() => {
    if (!selectedModel) return '';
    const provider = selectedModel.providers[0];
    if (!provider) return '';
    const modelObj = provider.model;
    return modelObj?.modelId || '';
  }, [selectedModel]);

  // Récupérer les images connectées (réactif via useStore)
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  
  const connectedImages = useMemo(() => {
    const incomers = getIncomers({ id }, nodes, edges);
    const images = getImagesFromImageNodes(incomers);
    // Extraire les URLs et filtrer les vides
    return images
      .map((img) => (typeof img === 'string' ? img : img?.url))
      .filter((url): url is string => typeof url === 'string' && url.length > 0);
  }, [id, nodes, edges]);

  const handleGenerate = useCallback(async () => {
    if (loading || !project?.id) {
      return;
    }

    try {
      const incomers = getIncomers({ id }, getNodes(), getEdges());
      const textPrompts = getTextFromTextNodes(incomers);
      const images = getImagesFromImageNodes(incomers);

      if (!textPrompts.length && !images.length) {
        throw new Error('No prompts found');
      }

      setLoading(true);

      analytics.track('canvas', 'node', 'generate', {
        type,
        promptLength: textPrompts.join('\n').length,
        model: modelId,
        instructionsLength: data.instructions?.length ?? 0,
        imageCount: images.length,
      });

      // Envoyer toutes les images connectées (first frame + last frame si plusieurs)
      // getImagesFromImageNodes retourne { url, type }[]
      const formattedImages = images.map(img => ({
        url: typeof img === 'string' ? img : img?.url || '',
        type: typeof img === 'string' ? 'image/jpeg' : img?.type || 'image/jpeg',
      })).filter(img => img.url);

      console.log(`[Video Transform] Sending ${formattedImages.length} images:`, formattedImages.map(i => i.url.substring(0, 50)));

      const response = await generateVideoAction({
        modelId,
        prompt: [data.instructions ?? '', ...textPrompts].join('\n'),
        images: formattedImages,
        nodeId: id,
        projectId: project.id,
      });

      if ('error' in response) {
        throw new Error(response.error);
      }

      updateNodeData(id, response.nodeData);

      toast.success('Video generated successfully');

      setTimeout(() => mutate('credits'), 5000);
    } catch (error) {
      handleError('Error generating video', error);
    } finally {
      setLoading(false);
    }
  }, [loading, project?.id, id, getNodes, getEdges, analytics, type, modelId, data.instructions, updateNodeData]);

  // Handler pour le batch : duplique le nœud N-1 fois et lance N générations en parallèle
  const handleBatchRun = useCallback(async (count: number) => {
    console.log(`[Video Batch] handleBatchRun called with count: ${count}`);
    
    if (loading) return;
    if (!project?.id) return;
    if (count < 1) return;

    const currentNode = getNode(id);
    if (!currentNode) return;
    
    console.log('[Video Batch] Starting batch run for node:', id);

    const incomers = getIncomers({ id }, getNodes(), getEdges());
    const textNodes = getTextFromTextNodes(incomers);
    const images = getImagesFromImageNodes(incomers);

    // Collecter tous les nœuds (original + à dupliquer)
    const nodeIds: string[] = [id];
    const incomingEdges = getEdges().filter((e: Edge) => e.target === id);
    
    // Le prompt
    const promptText = textNodes.join('\n') || data.instructions || '';
    
    // Mettre à jour le nœud original
    updateNodeData(id, { instructions: promptText });
    
    // Dupliquer le nœud N-1 fois HORIZONTALEMENT
    for (let i = 1; i < count; i++) {
      const newNodeId = `${id}-batch-${i}-${Date.now()}`;
      const offsetX = (currentNode.measured?.width ?? 400) + 50;
      
      const newNode: Node = {
        ...currentNode,
        id: newNodeId,
        type: currentNode.type,
        position: {
          x: currentNode.position.x + (offsetX * i),
          y: currentNode.position.y,
        },
        selected: false,
        data: { 
          ...currentNode.data,
          instructions: promptText,
        },
      };
      
      console.log(`[Video Batch] Creating node ${i}:`, newNode.id);
      addNodes(newNode);

      // Dupliquer les connexions entrantes
      for (const edge of incomingEdges) {
        const newEdge: Edge = {
          ...edge,
          id: `${edge.id}-batch-${i}-${Date.now()}`,
          target: newNodeId,
        };
        addEdges(newEdge);
      }

      nodeIds.push(newNodeId);
    }
    
    console.log(`[Video Batch] Total nodes to generate:`, nodeIds);

    toast.info(`🎬 Lancement de ${count} génération${count > 1 ? 's' : ''} vidéo en parallèle...`, {
      duration: 3000,
    });

    // Mettre TOUS les nœuds en état de chargement avec timestamp
    const startTime = Date.now();
    nodeIds.forEach((nodeId) => {
      updateNodeData(nodeId, { 
        generating: true,
        generatingStartTime: startTime,
      });
    });

    // Formater les images pour l'API
    const formattedImages = images.map(img => ({
      url: typeof img === 'string' ? img : img?.url || '',
      type: typeof img === 'string' ? 'image/jpeg' : img?.type || 'image/jpeg',
    })).filter(img => img.url);

    // Préparer les jobs pour l'API batch
    const jobs = nodeIds.map((nodeId) => ({
      nodeId,
      modelId,
      prompt: promptText,
      images: formattedImages,
    }));

    console.log(`[Video Batch] Sending ${jobs.length} jobs to /api/batch-generate-video`);

    try {
      // Appeler l'API batch qui exécute en PARALLÈLE
      const response = await fetch('/api/batch-generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobs, projectId: project.id }),
      });

      if (!response.ok) {
        throw new Error(`Batch API error: ${response.status}`);
      }

      const batchResult = await response.json();
      console.log(`[Video Batch] API response:`, batchResult);

      // Mettre à jour chaque nœud avec son résultat
      const results = batchResult.results || [];
      let successCount = 0;
      
      for (const result of results) {
        if (result.success && result.videoUrl) {
          updateNodeData(result.nodeId, {
            generated: {
              url: result.videoUrl,
              type: 'video/mp4',
            },
            generating: false,
            generatingStartTime: undefined,
          });
          successCount++;
        } else {
          updateNodeData(result.nodeId, { 
            generating: false,
            generatingStartTime: undefined,
          });
          if (result.error) {
            toast.error(`Erreur nœud ${result.nodeId}: ${result.error}`);
          }
        }
      }

      toast.success(`✅ ${successCount}/${count} vidéo${successCount > 1 ? 's' : ''} générée${successCount > 1 ? 's' : ''}`);
    } catch (error) {
      console.error('[Video Batch] Error:', error);
      // Réinitialiser l'état de tous les nœuds
      nodeIds.forEach((nodeId) => {
        updateNodeData(nodeId, { 
          generating: false,
          generatingStartTime: undefined,
        });
      });
      handleError('Erreur génération batch', error);
    }
    
    setTimeout(() => mutate('credits'), 5000);
  }, [loading, project?.id, id, getNode, getNodes, getEdges, addNodes, addEdges, updateNodeData, modelId, data.instructions]);

  const toolbar: ComponentProps<typeof NodeLayout>['toolbar'] = useMemo(() => {
    const items: ComponentProps<typeof NodeLayout>['toolbar'] = [
      {
        children: (
          <ModelSelector
            value={modelId}
            options={videoModels}
            key={id}
            className="w-[200px] rounded-full"
            onChange={(value) => updateNodeData(id, { model: value })}
          />
        ),
      },
    ];

    // Bouton paramètres avancés vidéo
    items.push({
      tooltip: 'Paramètres avancés',
      children: (
        <VideoAdvancedSettingsPanel
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
    if (loading || data.generating) {
      items.push({
        tooltip: 'Generating...',
        children: (
          <Button size="icon" variant="ghost" className="rounded-full" disabled>
            <Loader2Icon className="animate-spin" size={12} />
          </Button>
        ),
      });
    }

    // Download button
    if (data.generated?.url) {
      items.push({
        tooltip: 'Download',
        children: (
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => download(data.generated, id, 'mp4')}
          >
            <DownloadIcon size={12} />
          </Button>
        ),
      });
    }

    // Last updated
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
  }, [modelId, id, updateNodeData, advancedSettings, modelPath, loading, data.generating, data.generated, data.updatedAt, project?.id, handleGenerate]);

  const handleInstructionsChange: ChangeEventHandler<HTMLTextAreaElement> = (
    event
  ) => updateNodeData(id, { instructions: event.target.value });

  return (
    <NodeLayout id={id} data={data} type={type} title={title} toolbar={toolbar} onBatchRun={handleBatchRun}>
      {/* Vignettes first/last frame des images connectées */}
      {connectedImages.length > 0 && !loading && !data.generating && (
        <div className="flex items-center gap-2 p-3 bg-secondary/50 border-b border-border/50">
          {connectedImages.map((imageUrl, index) => (
            <div key={`frame-${index}`} className="relative">
              <div className="w-14 h-14 rounded-lg overflow-hidden border-2 border-primary/50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt={`Frame ${index + 1}`}
                  className="object-cover w-full h-full"
                />
              </div>
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-background/90 rounded text-[9px] font-medium whitespace-nowrap border border-border/50">
                {connectedImages.length === 1 
                  ? 'Frame' 
                  : index === 0 
                    ? 'First' 
                    : index === connectedImages.length - 1 
                      ? 'Last' 
                      : `#${index + 1}`}
              </span>
            </div>
          ))}
          <span className="text-xs text-muted-foreground ml-1">
            {connectedImages.length === 1 ? 'Image → Video' : 'First → Last'}
          </span>
        </div>
      )}

      {(loading || data.generating) && (
        <GeneratingSkeleton 
          className="rounded-b-xl"
          estimatedDuration={60} // Vidéo ~60 secondes
          startTime={data.generatingStartTime}
        />
      )}
      {!loading && !data.generating && !data.generated?.url && (
        <div className="flex aspect-video w-full items-center justify-center rounded-b-xl bg-secondary">
          <p className="text-muted-foreground text-sm text-center">
            {connectedImages.length > 0 
              ? `${connectedImages.length} image${connectedImages.length > 1 ? 's' : ''} connectée${connectedImages.length > 1 ? 's' : ''}`
              : 'Press ▷ to generate video'}
          </p>
        </div>
      )}
      {data.generated?.url && !loading && !data.generating && (
        <video
          src={data.generated.url}
          width={data.width ?? 800}
          height={data.height ?? 450}
          autoPlay
          muted
          loop
          playsInline
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
