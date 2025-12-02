import { generateVideoAction } from '@/app/actions/video/create';
import { NodeLayout } from '@/components/nodes/layout';
import { Button } from '@/components/ui/button';
import { GeneratingSkeleton } from '@/components/nodes/generating-skeleton';
import { ExpiredMedia, useMediaExpired, isLocalUrl } from '@/components/nodes/expired-media';
import { Textarea } from '@/components/ui/textarea';
import { useAnalytics } from '@/hooks/use-analytics';
import { useGenerationTracker } from '@/hooks/use-generation-tracker';
import { download } from '@/lib/download';
import { handleError } from '@/lib/error/handle';
import { useAvailableModels } from '@/hooks/use-available-models';
import { useModelParamsSidebar } from '@/components/model-params-sidebar';
import { getImagesFromImageNodes, getTextFromTextNodes } from '@/lib/xyflow';
import { useProject } from '@/providers/project';
import { getIncomers, useReactFlow, useStore } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import { ClockIcon } from 'lucide-react';
import {
  type ChangeEventHandler,
  type ComponentProps,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { toast } from 'sonner';
import { mutate } from 'swr';
import type { VideoNodeProps } from '.';
import { ModelSelector } from '../model-selector';
import { DurationBadge } from './video-indicators';

type VideoTransformProps = VideoNodeProps & {
  title: string;
};

// Helper pour trouver un défaut si le modèle actuel n'est plus dispo
const getFallbackModel = (models: Record<string, any>) => {
  return Object.keys(models)[0];
};

export const VideoTransform = ({
  data,
  id,
  type,
  title,
}: VideoTransformProps) => {
  const { updateNodeData, getNodes, getEdges, getNode, addNodes, addEdges } = useReactFlow();
  const [loading, setLoading] = useState(false);
  const [advancedSettings, setAdvancedSettings] = useState<Record<string, any>>(
    data.advancedSettings || {}
  );
  const project = useProject();
  const { trackGeneration } = useGenerationTracker();
  
  // Utiliser les modèles dynamiques filtrés
  const availableModels = useAvailableModels('video');
  const modelId = data.model && availableModels[data.model] ? data.model : getFallbackModel(availableModels);
  
  const analytics = useAnalytics();

  // Récupérer le modèle sélectionné
  const selectedModel = availableModels[modelId];
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
  
  // Hook pour détecter si la vidéo est expirée (URL WaveSpeed plus accessible)
  const videoUrl = data.generated?.url;
  const isLocal = videoUrl ? isLocalUrl(videoUrl) : true;
  const { isExpired, markAsExpired, retry: retryCheck } = useMediaExpired(videoUrl, isLocal);

  const handleGenerate = useCallback(async () => {
    if (loading || !project?.id) {
      return;
    }

    const startTime = Date.now();

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

      // Merger les nouvelles données avec les existantes (pour préserver instructions, advancedSettings, etc.)
      updateNodeData(id, { ...data, ...response.nodeData });

      // Calculer le temps écoulé et le coût
      const duration = Math.round((Date.now() - startTime) / 1000);
      const provider = selectedModel?.providers?.[0];
      // Durée vidéo par défaut 5 secondes (peut être ajusté selon les settings)
      const videoDuration = advancedSettings.duration || 5;
      const cost = provider?.getCost?.({ duration: videoDuration }) ?? 0;

      // Tracker la génération
      trackGeneration({
        type: 'video',
        model: modelId,
        modelLabel: selectedModel?.label,
        prompt: data.instructions,
        duration,
        cost,
        status: 'success',
        outputUrl: response.nodeData?.generated?.url,
        nodeId: id,
        nodeName: (data as { customName?: string }).customName,
        videoDuration,
      });

      toast.success('Vidéo générée !', {
        description: `⏱️ ${duration}s • 💰 ~$${cost.toFixed(3)}`,
        duration: Infinity,
        closeButton: true,
      });

      setTimeout(() => mutate('credits'), 5000);
    } catch (error) {
      handleError('Error generating video', error);
      
      // Tracker l'erreur
      trackGeneration({
        type: 'video',
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
  }, [loading, project?.id, id, getNodes, getEdges, analytics, type, modelId, data, updateNodeData, selectedModel, advancedSettings.duration, trackGeneration]);

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

      // Calculer le temps total et le coût
      const totalDuration = Math.round((Date.now() - startTime) / 1000);
      const provider = selectedModel?.providers?.[0];
      const videoDuration = advancedSettings.duration || 5;
      const costPerVideo = provider?.getCost?.({ duration: videoDuration }) ?? 0;
      
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
          
          // Tracker la génération réussie
          trackGeneration({
            type: 'video',
            model: modelId,
            modelLabel: selectedModel?.label,
            prompt: promptText,
            duration: Math.round(totalDuration / count),
            cost: costPerVideo,
            status: 'success',
            outputUrl: result.videoUrl,
            nodeId: result.nodeId,
            nodeName: (data as { customName?: string }).customName,
            videoDuration,
          });
        } else {
          updateNodeData(result.nodeId, { 
            generating: false,
            generatingStartTime: undefined,
          });
          if (result.error) {
            toast.error(`Erreur nœud ${result.nodeId}: ${result.error}`);
          }
          
          // Tracker l'erreur
          trackGeneration({
            type: 'video',
            model: modelId,
            modelLabel: selectedModel?.label,
            prompt: promptText,
            duration: Math.round(totalDuration / count),
            cost: 0,
            status: 'error',
            error: result.error || 'Unknown error',
            nodeId: result.nodeId,
            nodeName: (data as { customName?: string }).customName,
          });
        }
      }

      const totalCost = costPerVideo * successCount;

      const failCount = count - successCount;
      if (failCount > 0) {
        toast.warning(`${successCount}/${count} vidéo${successCount > 1 ? 's' : ''} générée${successCount > 1 ? 's' : ''}`, {
          description: `⏱️ ${totalDuration}s • 💰 ~$${totalCost.toFixed(3)} • ${failCount} échec(s)`,
          duration: Infinity,
          closeButton: true,
        });
      } else {
        toast.success(`✅ ${successCount} vidéo${successCount > 1 ? 's' : ''} générée${successCount > 1 ? 's' : ''} !`, {
          description: `⏱️ ${totalDuration}s • 💰 ~$${totalCost.toFixed(3)}`,
          duration: Infinity,
          closeButton: true,
        });
      }
    } catch (error) {
      console.error('[Video Batch] Error:', error);
      // Réinitialiser l'état de tous les nœuds
      nodeIds.forEach((nodeId) => {
        updateNodeData(nodeId, { 
          generating: false,
          generatingStartTime: undefined,
        });
        
        // Tracker l'erreur
        trackGeneration({
          type: 'video',
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
      handleError('Erreur génération batch', error);
    }
    
    setTimeout(() => mutate('credits'), 5000);
  }, [loading, project?.id, id, getNode, getNodes, getEdges, addNodes, addEdges, updateNodeData, modelId, data, selectedModel, advancedSettings.duration, trackGeneration]);

  // Hook pour la sidebar des paramètres
  const { openSidebar } = useModelParamsSidebar();
  
  // Callback appelé quand un modèle est sélectionné - ouvre automatiquement la sidebar
  const handleModelSelected = useCallback((selectedModelId: string) => {
    openSidebar(selectedModelId, id, advancedSettings, (settings) => {
      setAdvancedSettings(settings);
      updateNodeData(id, { advancedSettings: settings });
    });
  }, [id, advancedSettings, openSidebar, updateNodeData]);

  const toolbar: ComponentProps<typeof NodeLayout>['toolbar'] = useMemo(() => {
    const items: ComponentProps<typeof NodeLayout>['toolbar'] = [
      {
        children: (
          <ModelSelector
            value={modelId}
            options={availableModels}
            key={id}
            className="w-[200px] rounded-full"
            onChange={(value) => updateNodeData(id, { model: value })}
            onModelSelected={handleModelSelected}
          />
        ),
      },
    ];

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
  }, [modelId, id, updateNodeData, availableModels, data.updatedAt, handleModelSelected]);

  const handleInstructionsChange: ChangeEventHandler<HTMLTextAreaElement> = (
    event
  ) => updateNodeData(id, { instructions: event.target.value });

  const [isHovered, setIsHovered] = useState(false);
  const isGenerating = loading || data.generating;
  const hasContent = isGenerating || data.generated?.url;
  const hasPrompt = Boolean(data.instructions?.trim());

  return (
    <NodeLayout id={id} data={data} type={type} title={title} toolbar={toolbar} onBatchRun={handleBatchRun}>
      {/* Vignettes first/last frame des images connectées */}
      {connectedImages.length > 0 && !isGenerating && !data.generated?.url && (
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

      {isGenerating && (
        <div className="relative">
          {/* Badge durée en haut à droite */}
          <DurationBadge duration={advancedSettings.duration || 5} position="top-right" />
          
          <GeneratingSkeleton 
            className="rounded-b-xl"
            estimatedDuration={60} // Vidéo ~60 secondes
            startTime={data.generatingStartTime}
          />
        </div>
      )}
      {!isGenerating && !data.generated?.url && (
        <div className="relative flex aspect-video w-full items-center justify-center rounded-b-xl bg-secondary">
          {/* Badge durée en haut à droite */}
          <DurationBadge duration={advancedSettings.duration || 5} position="top-right" />
          
          <p className="text-muted-foreground text-sm text-center">
            {connectedImages.length > 0 
              ? `${connectedImages.length} image${connectedImages.length > 1 ? 's' : ''} connectée${connectedImages.length > 1 ? 's' : ''}`
              : 'Press ▷ to generate video'}
          </p>
        </div>
      )}
      {data.generated?.url && !isGenerating && (
        <>
          {/* Afficher l'icône fantôme si la vidéo est expirée */}
          {isExpired ? (
            <ExpiredMedia 
              onRetry={retryCheck}
              message="La vidéo a expiré sur WaveSpeed et n'a pas été téléchargée"
            />
          ) : (
            <div 
              className="relative"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              {/* Badge durée en haut à droite */}
              <DurationBadge duration={advancedSettings.duration || 5} position="top-right" />
              
              <video
                src={data.generated.url}
                autoPlay
                muted
                loop
                playsInline
                className="w-full rounded-b-xl block"
                onError={() => markAsExpired()}
              />
              {/* Overlay du prompt au hover */}
              {hasPrompt && isHovered && (
                <div className="absolute inset-0 flex items-end rounded-b-xl bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pb-14 transition-opacity">
                  <p className="text-white text-xs leading-relaxed line-clamp-4 drop-shadow-lg">
                    {data.instructions}
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
      {/* Textarea visible uniquement quand pas de contenu */}
      {!hasContent && (
        <Textarea
          value={data.instructions ?? ''}
          onChange={handleInstructionsChange}
          placeholder="Promptez..."
          className="shrink-0 resize-none rounded-none border-none bg-transparent! shadow-none focus-visible:ring-0"
        />
      )}
    </NodeLayout>
  );
};
