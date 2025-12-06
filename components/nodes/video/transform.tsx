import { generateVideoAction } from '@/app/actions/video/create';
import { NodeLayout } from '@/components/nodes/layout';
import { Button } from '@/components/ui/button';
import { GeneratingSkeleton } from '@/components/nodes/generating-skeleton';
import { ExpiredMedia, useMediaExpired, isLocalUrl } from '@/components/nodes/expired-media';
import { Textarea } from '@/components/ui/textarea';
import { useAnalytics } from '@/hooks/use-analytics';
import { useGenerationTracker } from '@/hooks/use-generation-tracker';
import { download } from '@/lib/download';
import { handleError, handleGenerationError } from '@/lib/error/handle';
import { useAvailableModels } from '@/hooks/use-available-models';
import { useModelParamsSidebar } from '@/components/model-params-sidebar';
import { usePerformanceModeStore } from '@/lib/performance-mode-store';
import { useVideoVisibility, useVideoHover } from '@/hooks/use-video-visibility';
import { useShouldRenderContent } from '@/hooks/use-viewport-activity';
import { getImagesFromImageNodes, getTextFromTextNodes, getAllImagesFromNodes } from '@/lib/xyflow';
import { useProject } from '@/providers/project';
import { getIncomers, useReactFlow, useStore } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import { ChevronDownIcon, ChevronUpIcon, ClockIcon, PlayIcon as PlayIconLucide, RotateCcwIcon, XIcon } from 'lucide-react';
import { MediaPlaceholder } from '@/components/nodes/media-placeholder';
import {
  type ChangeEventHandler,
  type ComponentProps,
  useCallback,
  useMemo,
  useState,
  useRef,
  useEffect,
  memo,
} from 'react';
import { toast } from 'sonner';
import { mutate } from 'swr';
import type { VideoNodeProps } from '.';
import { ModelSelector } from '../model-selector';
import { DurationBadge } from './video-indicators';
import { MediaFullscreenViewer } from '@/components/media-fullscreen-viewer';

// Composant vidéo stabilisé avec mode poster (play au hover)
// Utilise useRef pour éviter les re-renders mais accepte les nouvelles URLs
const StableVideo = memo(function StableVideo({ 
  src, 
  onError,
  className,
  shouldPlay,
}: { 
  src: string; 
  onError?: () => void;
  className?: string;
  shouldPlay: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Contrôler la lecture de la vidéo
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    if (shouldPlay) {
      video.play().catch(() => {
        // Ignorer les erreurs de lecture (ex: pas encore de données)
      });
    } else {
      video.pause();
    }
  }, [shouldPlay]);
  
  return (
    <video
      ref={videoRef}
      src={src}
      muted
      loop
      playsInline
      preload="metadata"
      className={className}
      onError={onError}
    />
  );
}, (prevProps, nextProps) => {
  // Re-render seulement si l'URL ou shouldPlay change
  return prevProps.src === nextProps.src && prevProps.shouldPlay === nextProps.shouldPlay;
});

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
  
  // IMPORTANT: Pour l'affichage du modèle utilisé lors de la génération,
  // on utilise data.generated?.model (le modèle REELLEMENT utilisé, stocké par l'API)
  // Si pas disponible, on fallback sur data.model ou data.modelId (le modèle SELECTIONNE)
  // Priorité: generated.model > model > modelId > fallback
  const actualModelUsed = (data.generated as { model?: string } | undefined)?.model || data.model || (data as any).modelId;
  
  // Pour la SÉLECTION, on vérifie si le modèle est dispo, sinon fallback
  const modelId = actualModelUsed && availableModels[actualModelUsed] 
    ? actualModelUsed 
    : (actualModelUsed || getFallbackModel(availableModels));
  
  const analytics = useAnalytics();

  // Récupérer le modèle sélectionné (ou null si modèle inconnu/legacy)
  const selectedModel = availableModels[modelId];
  
  // Pour l'AFFICHAGE du modèle réellement utilisé (sous le nœud),
  // on cherche d'abord dans availableModels, sinon on montre le nom brut
  const displayModelLabel = useMemo(() => {
    if (actualModelUsed && availableModels[actualModelUsed]) {
      return availableModels[actualModelUsed].label;
    }
    // Si le modèle n'est pas dans availableModels, afficher son ID de façon lisible
    if (actualModelUsed) {
      // Nettoyer l'ID pour l'affichage (ex: kwaivgi/kling-v2.5 -> Kling v2.5)
      const parts = actualModelUsed.split('/');
      const name = parts[parts.length - 1] || actualModelUsed;
      return name
        .replace(/-/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
    }
    return selectedModel?.label;
  }, [actualModelUsed, availableModels, selectedModel]);

  // Si le modèle actuel n'est pas dans la liste (ex: désactivé ou legacy), on l'ajoute artificiellement
  // pour que le ModelSelector puisse l'afficher correctement
  const effectiveAvailableModels = useMemo(() => {
    if (actualModelUsed && !availableModels[actualModelUsed]) {
        return {
            ...availableModels,
            [actualModelUsed]: {
                label: displayModelLabel || actualModelUsed,
                chef: { name: 'Custom', icon: () => null }, // Mock
                providers: []
            }
        } as any; // Cast as any pour éviter les erreurs de type strict sur TersaModel
    }
    return availableModels;
  }, [availableModels, actualModelUsed, displayModelLabel]);

  const modelPath = useMemo(() => {
    if (!selectedModel) return actualModelUsed || '';
    const provider = selectedModel.providers[0];
    if (!provider) return '';
    const modelObj = provider.model;
    return modelObj?.modelId || '';
  }, [selectedModel, actualModelUsed]);

  // OPTIMISÉ: Sélecteur stable - ne re-render que si les images connectées changent réellement
  // Au lieu d'observer tous les nodes/edges, on calcule un hash des URLs d'images connectées
  const allConnectedImages = useStore(
    useCallback((s) => {
      const incomers = getIncomers({ id }, s.nodes, s.edges);
      const images = getAllImagesFromNodes(incomers);
      return images
        .map((img) => (typeof img === 'string' ? img : img?.url))
        .filter((url): url is string => typeof url === 'string' && url.length > 0);
    }, [id]),
    // Comparateur personnalisé : ne re-render que si le tableau d'URLs change
    (prev, next) => {
      if (prev.length !== next.length) return false;
      return prev.every((url, i) => url === next[i]);
    }
  );
  
  // Images exclues (stockées dans data.excludedImages)
  const excludedImages = (data.excludedImages as string[]) || [];
  
  // Filtrer les images exclues
  const connectedImages = useMemo(() => {
    return allConnectedImages.filter(url => !excludedImages.includes(url));
  }, [allConnectedImages, excludedImages]);
  
  // Fonction pour exclure une image
  const handleExcludeImage = useCallback((imageUrl: string) => {
    const newExcluded = [...excludedImages, imageUrl];
    updateNodeData(id, { excludedImages: newExcluded });
  }, [id, excludedImages, updateNodeData]);
  
  // Fonction pour réinclure toutes les images
  const handleResetExcluded = useCallback(() => {
    updateNodeData(id, { excludedImages: [] });
  }, [id, updateNodeData]);
  
  // Hook pour détecter si la vidéo est expirée (URL WaveSpeed plus accessible)
  const videoUrl = data.generated?.url;
  const isLocal = videoUrl ? isLocalUrl(videoUrl) : true;
  const { isExpired, markAsExpired, retry: retryCheck } = useMediaExpired(videoUrl, isLocal);

  // Constante pour le nombre max de tentatives
  const MAX_RETRY_ATTEMPTS = 2;

  const handleGenerate = useCallback(async (isRetry = false) => {
    if (loading || !project?.id) {
      return;
    }

    // Récupérer le nombre de tentatives actuel
    const currentAttempt = (data.retryCount ?? 0) + 1;
    
    // Si c'est un retry, mettre à jour le compteur
    if (isRetry) {
      updateNodeData(id, { retryCount: currentAttempt });
    }

    const startTime = Date.now();

    try {
      const incomers = getIncomers({ id }, getNodes(), getEdges());
      const textPrompts = getTextFromTextNodes(incomers);
      // Utiliser getAllImagesFromNodes pour inclure les images des collections
      const images = getAllImagesFromNodes(incomers);

      console.log(`[Video Transform] Found ${incomers.length} incomers, ${images.length} images from nodes/collections`);

      if (!textPrompts.length && !images.length) {
        throw new Error('No prompts found');
      }

      setLoading(true);
      
      // Effacer l'erreur précédente au lancement d'une nouvelle génération
      updateNodeData(id, { error: undefined, generating: true, generatingStartTime: Date.now() });

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

      // Succès ! Reset le compteur de retry et merger les données
      updateNodeData(id, { ...data, ...response.nodeData, retryCount: 0 });

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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Vérifier si on peut retry (tentative actuelle < max)
      if (currentAttempt < MAX_RETRY_ATTEMPTS) {
        console.log(`[Video Transform] Échec tentative ${currentAttempt}/${MAX_RETRY_ATTEMPTS}, retry automatique...`);
        
        toast.warning(`🔄 Retry automatique (${currentAttempt}/${MAX_RETRY_ATTEMPTS})`, {
          description: `Erreur: ${errorMessage.substring(0, 100)}...`,
          duration: 5000,
        });
        
        // Mettre à jour le compteur et relancer après un court délai
        updateNodeData(id, { retryCount: currentAttempt });
        setLoading(false);
        
        // Attendre 2 secondes avant de retry
        setTimeout(() => {
          handleGenerate(true);
        }, 2000);
        return;
      }
      
      // Max tentatives atteint - échec définitif
      console.error(`[Video Transform] Échec après ${currentAttempt} tentatives`);
      
      // Afficher l'erreur complète en toast (expire après 1 min)
      handleGenerationError(
        (data as { customName?: string }).customName || 'Vidéo',
        `Échec après ${currentAttempt} tentatives: ${errorMessage}`,
        { nodeId: id, model: selectedModel?.label || modelId, prompt: data.instructions?.substring(0, 100) }
      );
      
      // Reset le compteur et marquer l'erreur
      updateNodeData(id, { 
        retryCount: 0, 
        generating: false,
        generatingStartTime: undefined,
        error: errorMessage,
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
        error: errorMessage,
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
    // Utiliser getAllImagesFromNodes pour inclure les images des collections
    const images = getAllImagesFromNodes(incomers);

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
      const failedNodesToRetry: { nodeId: string; error: string; retryCount: number }[] = [];
      
      for (const result of results) {
        if (result.success && result.videoUrl) {
          updateNodeData(result.nodeId, {
            generated: {
              url: result.videoUrl,
              type: 'video/mp4',
            },
            generating: false,
            generatingStartTime: undefined,
            retryCount: 0,
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
          // Récupérer le compteur de retry du nœud
          const node = getNode(result.nodeId);
          const currentRetryCount = (node?.data?.retryCount as number) ?? 0;
          
          if (currentRetryCount < MAX_RETRY_ATTEMPTS - 1) {
            // On peut retry ce nœud
            failedNodesToRetry.push({
              nodeId: result.nodeId,
              error: result.error || 'Unknown error',
              retryCount: currentRetryCount + 1,
            });
            // Garder le nœud en état "generating" pour le retry
            updateNodeData(result.nodeId, { 
              retryCount: currentRetryCount + 1,
            });
          } else {
            // Max tentatives atteint - échec définitif
            updateNodeData(result.nodeId, { 
              generating: false,
              generatingStartTime: undefined,
              retryCount: 0,
              error: result.error,
            });
            
            toast.error(`❌ Échec définitif nœud après ${MAX_RETRY_ATTEMPTS} tentatives`, {
              description: result.error?.substring(0, 100),
              duration: 10000,
            });
            
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
      }
      
      // Retry automatique des nœuds échoués qui peuvent être retryés
      if (failedNodesToRetry.length > 0) {
        toast.warning(`🔄 Retry automatique de ${failedNodesToRetry.length} nœud(s) échoué(s)...`, {
          description: failedNodesToRetry.map(n => `Tentative ${n.retryCount + 1}/${MAX_RETRY_ATTEMPTS}`).join(', '),
          duration: 5000,
        });
        
        // Relancer les jobs échoués après un délai
        setTimeout(async () => {
          const retryJobs = failedNodesToRetry.map(failed => ({
            nodeId: failed.nodeId,
            modelId,
            prompt: promptText,
            images: formattedImages,
          }));
          
          console.log(`[Video Batch] Retrying ${retryJobs.length} failed jobs...`);
          
          try {
            const retryResponse = await fetch('/api/batch-generate-video', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ jobs: retryJobs, projectId: project.id }),
            });
            
            if (retryResponse.ok) {
              const retryResult = await retryResponse.json();
              let retrySuccessCount = 0;
              
              for (const result of retryResult.results || []) {
                if (result.success && result.videoUrl) {
                  updateNodeData(result.nodeId, {
                    generated: { url: result.videoUrl, type: 'video/mp4' },
                    generating: false,
                    generatingStartTime: undefined,
                    retryCount: 0,
                  });
                  retrySuccessCount++;
                } else {
                  updateNodeData(result.nodeId, {
                    generating: false,
                    generatingStartTime: undefined,
                    error: result.error,
                  });
                }
              }
              
              if (retrySuccessCount > 0) {
                toast.success(`✅ ${retrySuccessCount} vidéo(s) récupérée(s) après retry !`);
              }
            }
          } catch (retryError) {
            console.error('[Video Batch] Retry failed:', retryError);
          }
        }, 3000);
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
      // Bouton Generate / Regenerate
      {
        tooltip: data.generated?.url ? 'Régénérer la vidéo' : 'Générer la vidéo',
        children: (
          <Button
            size="icon"
            variant="ghost"
            className="rounded-full"
            onClick={() => handleGenerate(false)}
            disabled={loading || !project?.id}
          >
            {data.generated?.url ? (
              <RotateCcwIcon size={12} />
            ) : (
              <PlayIconLucide size={12} />
            )}
          </Button>
        ),
      },
      {
        children: (
          <ModelSelector
            value={modelId}
            options={effectiveAvailableModels}
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
  }, [modelId, id, updateNodeData, availableModels, data.updatedAt, handleModelSelected, data.generated?.url, loading, project?.id, handleGenerate]);

  const handleInstructionsChange: ChangeEventHandler<HTMLTextAreaElement> = (
    event
  ) => updateNodeData(id, { instructions: event.target.value });

  const [isNodeHovered, setIsNodeHovered] = useState(false);
  // Mode collapsed par défaut pour les prompts longs
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  // Fullscreen viewer
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Mode performance global
  const isPerformanceMode = usePerformanceModeStore((s) => s.isPerformanceMode);
  
  // Détection visibilité dans viewport
  const { ref: visibilityRef, isVisible } = useVideoVisibility();
  
  // Hover pour lecture vidéo
  const { isHovered: isVideoHovered, hoverProps: videoHoverProps } = useVideoHover();
  
  // Level of Detail: afficher placeholder si zoom out ou en mouvement
  const { shouldRender, isZoomedOut, isMoving } = useShouldRenderContent();
  
  // La vidéo joue SEULEMENT si : visible + hover + pas en mode performance + contenu rendu
  const shouldPlayVideo = isVisible && isVideoHovered && !isPerformanceMode && shouldRender;
  
  // Handler pour double-clic => fullscreen
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.generated?.url) {
      setIsFullscreen(true);
    }
  }, [data.generated?.url]);
  
  // AMÉLIORATION: Considérer "en génération" si:
  // 1. loading local est true, OU
  // 2. data.generating est true, OU
  // 3. generatingStartTime existe ET pas encore de vidéo (génération en cours après refresh)
  const isGenerating = loading || data.generating || (data.generatingStartTime && !data.generated?.url);
  const hasContent = isGenerating || data.generated?.url;
  const hasPrompt = Boolean(data.instructions?.trim());
  // Tronquer le prompt à 80 caractères pour le mode collapsed
  const truncatedPrompt = useMemo(() => {
    const text = data.instructions ?? '';
    if (text.length <= 80) return text;
    return text.substring(0, 77) + '...';
  }, [data.instructions]);

  return (
    <NodeLayout 
      id={id} 
      data={data} 
      type={type} 
      title={title} 
      toolbar={toolbar} 
      onBatchRun={handleBatchRun}
      modelLabel={displayModelLabel}
    >
      {/* Vignettes first/last frame des images connectées */}
      {/* Vignettes des images connectées */}
      {allConnectedImages.length > 0 && !isGenerating && !data.generated?.url && (
        <div className="p-2 bg-secondary/50 border-b border-border/50">
          {/* Header avec compteur et bouton reset */}
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs text-muted-foreground">
              {connectedImages.length}/{allConnectedImages.length} images
              {connectedImages.length > 10 && (
                <span className="text-amber-500 ml-1">(max 10 pour Kling)</span>
              )}
            </span>
            {excludedImages.length > 0 && (
              <button
                onClick={handleResetExcluded}
                className="text-xs text-blue-400 hover:text-blue-300 underline"
              >
                Tout réafficher
              </button>
            )}
          </div>
          {/* Grille de vignettes */}
          <div className="flex flex-wrap gap-1">
            {connectedImages.map((imageUrl, index) => (
              <div key={`frame-${index}`} className="relative group">
                {/* Bouton X pour supprimer */}
                <button
                  onClick={() => handleExcludeImage(imageUrl)}
                  className="absolute -top-1 -right-1 z-10 w-4 h-4 bg-red-500 hover:bg-red-400 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <XIcon className="w-3 h-3 text-white" />
                </button>
                {/* Vignette */}
                <div className="w-10 h-10 rounded overflow-hidden border border-primary/30 hover:border-primary/60 transition-colors">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt={`Frame ${index + 1}`}
                    className="object-cover w-full h-full"
                  />
                </div>
                {/* Label */}
                <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 px-1 py-0 bg-background/90 rounded text-[7px] font-medium whitespace-nowrap">
                  {index === 0 
                    ? 'First' 
                    : index === connectedImages.length - 1 
                      ? 'Last' 
                      : `#${index + 1}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isGenerating && (
        <div className="relative">
          {/* Badge durée en haut à droite */}
          <DurationBadge duration={advancedSettings.duration || 5} position="top-right" />
          
          {/* Code couleur unifié : Vidéos = Fuchsia */}
          <GeneratingSkeleton 
            className="rounded-b-xl"
            estimatedDuration={300} // Kling prend ~5 minutes (300s)
            startTime={data.generatingStartTime}
            color="video"
          />
        </div>
      )}
      {!isGenerating && !data.generated?.url && (
        <div className="relative flex aspect-video w-full items-center justify-center rounded-b-xl bg-secondary">
          {/* Badge durée en haut à droite */}
          <DurationBadge duration={advancedSettings.duration || 5} position="top-right" />
          
          {/* Afficher l'erreur si présente */}
          {data.error ? (
            <div className="p-3 text-center">
              <p className="text-red-400 text-xs font-medium mb-1">❌ Erreur</p>
              <p className="text-red-300/80 text-[10px] leading-tight max-w-full overflow-hidden break-words">
                {typeof data.error === 'string' ? data.error : JSON.stringify(data.error)}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm text-center">
              {connectedImages.length > 0 
                ? `${connectedImages.length} image${connectedImages.length > 1 ? 's' : ''} connectée${connectedImages.length > 1 ? 's' : ''}`
                : 'Press ▷ to generate video'}
            </p>
          )}
        </div>
      )}
      {data.generated?.url && !isGenerating && (
        <>
          {/* Placeholder quand zoom out ou en mouvement */}
          {!shouldRender ? (
            <div className="relative aspect-video">
              <MediaPlaceholder isMoving={isMoving} isZoomedOut={isZoomedOut} />
            </div>
          ) : isExpired ? (
            <ExpiredMedia 
              onRetry={retryCheck}
              message="La vidéo a expiré sur WaveSpeed et n'a pas été téléchargée"
            />
          ) : (
            <div 
              ref={visibilityRef as React.RefObject<HTMLDivElement>}
              className="relative cursor-pointer"
              onMouseEnter={() => setIsNodeHovered(true)}
              onMouseLeave={() => setIsNodeHovered(false)}
              onDoubleClick={handleDoubleClick}
              {...videoHoverProps}
            >
              {/* Badge durée en haut à droite */}
              <DurationBadge duration={advancedSettings.duration || 5} position="top-right" />
              
              <StableVideo
                src={data.generated.url}
                className="w-full rounded-b-xl block"
                onError={() => markAsExpired()}
                shouldPlay={shouldPlayVideo}
              />
              
              {/* Overlay "Play" quand la vidéo est en pause */}
              {!shouldPlayVideo && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-b-xl transition-opacity pointer-events-none">
                  <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                    <PlayIconLucide className="w-6 h-6 text-black ml-0.5" />
                  </div>
                </div>
              )}
              
              {/* Overlay du prompt au hover (quand vidéo joue) */}
              {hasPrompt && isNodeHovered && shouldPlayVideo && (
                <div className="absolute inset-0 flex items-end rounded-b-xl bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pb-14 transition-opacity pointer-events-none">
                  <p className="text-white text-xs leading-relaxed line-clamp-4 drop-shadow-lg">
                    {data.instructions}
                  </p>
                </div>
              )}
              
              {/* Hint double-clic */}
              {isNodeHovered && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                  <span className="text-[10px] text-white/60 bg-black/50 px-2 py-0.5 rounded-full">
                    Double-clic: plein écran
                  </span>
                </div>
              )}
            </div>
          )}
          
          {/* Fullscreen viewer */}
          <MediaFullscreenViewer
            open={isFullscreen}
            onOpenChange={setIsFullscreen}
            mediaUrl={data.generated.url}
            mediaType="video"
            title={(data as { customName?: string }).customName}
          />
        </>
      )}
      {/* Prompt section - collapsable par défaut */}
      {!hasContent && (
        <div className="flex flex-col">
          {/* Header avec toggle */}
          {hasPrompt && (
            <button
              type="button"
              onClick={() => setIsPromptExpanded(!isPromptExpanded)}
              className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:bg-white/5 transition-colors border-t border-white/10"
            >
              <span className="truncate flex-1 text-left">
                {isPromptExpanded ? 'Prompt' : truncatedPrompt}
              </span>
              {isPromptExpanded ? (
                <ChevronUpIcon className="h-4 w-4 ml-2 shrink-0" />
              ) : (
                <ChevronDownIcon className="h-4 w-4 ml-2 shrink-0" />
              )}
            </button>
          )}
          {/* Textarea - visible quand expanded ou quand pas de prompt */}
          {(isPromptExpanded || !hasPrompt) && (
            <Textarea
              value={data.instructions ?? ''}
              onChange={handleInstructionsChange}
              placeholder="Promptez..."
              className="nodrag nowheel shrink-0 resize-none rounded-none border-none bg-transparent! shadow-none focus-visible:ring-0"
              rows={isPromptExpanded ? 6 : 2}
            />
          )}
        </div>
      )}
    </NodeLayout>
  );
};
