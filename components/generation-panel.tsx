'use client';

/**
 * Panneau de génération séquentielle des médias
 * 
 * NOUVELLE LOGIQUE :
 * - Personnages : 1ère image (fullBody) avec text-to-image-ultra, puis edit-multi pour les variantes
 * - Lieux : 1ère image (angle1) avec text-to-image-ultra, puis edit-multi pour les variantes
 * - Vidéos : en parallèle avec durée et aspect ratio configurables
 */

import { useState, useEffect, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  SparklesIcon,
  PlayIcon,
  XIcon,
  CheckCircle2Icon,
  Loader2Icon,
  AlertCircleIcon,
  ImageIcon,
  VideoIcon,
  FolderIcon,
  SendIcon,
  RotateCcwIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { 
  getLocalProjectById, 
  type GenerationSequence 
} from '@/lib/local-projects-store';
import { useMediaLibraryStore } from '@/lib/media-library-store';

interface GenerationStep {
  id: string;
  type: 'image' | 'image-edit' | 'video' | 'collection' | 'dvr';
  status: 'pending' | 'generating' | 'done' | 'error';
  nodeId: string;
  label: string;
  error?: string;
  // Infos supplémentaires pour le retry
  imageInfo?: {
    prompt: string;
    aspectRatio: string;
    isReference: boolean;
    referenceNodeId?: string; // Node ID de l'image de référence pour edit-multi
  };
  videoInfo?: {
    prompt: string;
    characterCollectionIds: string[];
    locationCollectionId?: string;
    duration: number;
    aspectRatio: string;
  };
  collectionSourceIds?: string[];
}

interface GenerationPanelProps {
  projectId: string;
}

export function GenerationPanel({ projectId }: GenerationPanelProps) {
  const { getNodes, updateNodeData } = useReactFlow();
  
  // Hook pour rafraîchir la bibliothèque de médias après génération
  const { fetchMedias } = useMediaLibraryStore();
  
  const [isOpen, setIsOpen] = useState(false);
  const [sequence, setSequence] = useState<GenerationSequence | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<string>('');
  const [steps, setSteps] = useState<GenerationStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [aborted, setAborted] = useState(false);
  
  // Config
  const [sendToDVR, setSendToDVR] = useState(false);
  const [videoCopies, setVideoCopies] = useState(4);

  // Charger la séquence depuis le projet
  useEffect(() => {
    const project = getLocalProjectById(projectId);
    console.log('[GenerationPanel] Loading project:', projectId, project?.data);
    if (project?.data?.generationSequence) {
      console.log('[GenerationPanel] Found generation sequence:', project.data.generationSequence);
      setSequence(project.data.generationSequence as GenerationSequence);
      
      // Extraire le nombre de copies depuis la séquence
      if ((project.data.generationSequence as any).videoCopies) {
        setVideoCopies((project.data.generationSequence as any).videoCopies);
      }
    } else {
      console.log('[GenerationPanel] No generation sequence found');
    }
  }, [projectId]);

  // Analyser les nœuds du canvas pour trouver ce qui peut être généré
  const analyzeCanvasNodes = useCallback(() => {
    const nodes = getNodes();
    let imageNodes = 0;
    let videoNodes = 0;
    let emptyImages = 0;
    let emptyVideos = 0;
    let errorImages = 0;
    let errorVideos = 0;
    
    for (const node of nodes) {
      if (node.type === 'image') {
        imageNodes++;
        const hasImage = node.data?.generated?.url || node.data?.generated?.urls?.length > 0;
        if (!hasImage) emptyImages++;
        if (node.data?.error) errorImages++;
      } else if (node.type === 'video') {
        videoNodes++;
        const hasVideo = node.data?.generated?.url;
        if (!hasVideo) emptyVideos++;
        if (node.data?.error) errorVideos++;
      }
    }
    
    return {
      totalImages: imageNodes,
      totalVideos: videoNodes,
      emptyImages,
      emptyVideos,
      errorImages,
      errorVideos,
      generatableImages: emptyImages + errorImages,
      generatableVideos: emptyVideos + errorVideos,
    };
  }, [getNodes]);

  // Stats depuis la séquence OU depuis l'analyse des nœuds
  const [canvasStats, setCanvasStats] = useState({ 
    totalImages: 0, totalVideos: 0, emptyImages: 0, emptyVideos: 0,
    errorImages: 0, errorVideos: 0, generatableImages: 0, generatableVideos: 0
  });

  // Mettre à jour les stats quand le panel s'ouvre
  useEffect(() => {
    if (isOpen) {
      setCanvasStats(analyzeCanvasNodes());
    }
  }, [isOpen, analyzeCanvasNodes]);

  // Calculer les stats (priorité à la séquence si disponible)
  const stats = sequence ? {
    totalImages: 
      sequence.characterImages.reduce((acc, c) => acc + (c.imageNodeIds?.length || 0), 0) +
      sequence.locationImages.reduce((acc, l) => acc + (l.imageNodeIds?.length || 0), 0),
    totalCollections: sequence.characterCollections.length + sequence.locationCollections.length,
    totalVideos: sequence.videos.reduce((acc, v) => acc + (v.videoNodeIds?.length || 0), 0),
  } : { 
    totalImages: canvasStats.totalImages, 
    totalCollections: 0, 
    totalVideos: canvasStats.totalVideos 
  };

  const totalSteps = stats.totalImages + stats.totalCollections + stats.totalVideos + (sendToDVR ? stats.totalVideos : 0);
  const progress = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;

  // ========== UTILITAIRES ==========
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const updateStep = (stepId: string, updates: Partial<GenerationStep>) => {
    setSteps(prev => prev.map(s => s.id === stepId ? { ...s, ...updates } : s));
  };

  // ========== GÉNÉRATION D'IMAGE (Text-to-Image) ==========
  const generateImageTextToImage = async (nodeId: string, prompt: string, aspectRatio: string): Promise<string | null> => {
    try {
      console.log(`[GenerationPanel] Génération image T2I pour ${nodeId}, AR: ${aspectRatio}`);

      const response = await fetch('/api/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId,
          prompt,
          model: 'nano-banana-pro-ultra-wavespeed', // text-to-image-ultra
          projectId,
          aspectRatio,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[GenerationPanel] Erreur API image T2I:', errorText);
        // IMPORTANT: Retirer le flag generating même en cas d'erreur
        updateNodeData(nodeId, {
          generating: false,
          generatingStartTime: undefined,
        });
        return null;
      }

      const result = await response.json();
      const imageUrl = result.nodeData?.generated?.url || result.nodeData?.url;
      
      if (imageUrl) {
        // IMPORTANT: Combiner TOUTES les mises à jour en UN SEUL appel
        // pour éviter que les appels séparés s'écrasent
        updateNodeData(nodeId, {
          generated: result.nodeData?.generated || { url: imageUrl, type: 'image/png' },
          url: imageUrl,
          generating: false,
          generatingStartTime: undefined,
        });
        console.log(`[GenerationPanel] Image T2I générée: ${imageUrl.substring(0, 50)}...`);
        return imageUrl;
      }

      // Pas d'URL = échec, retirer le flag
      updateNodeData(nodeId, {
        generating: false,
        generatingStartTime: undefined,
      });
      return null;
    } catch (error) {
      console.error('Erreur génération image T2I:', error);
      // Retirer le flag en cas d'exception
      updateNodeData(nodeId, {
        generating: false,
        generatingStartTime: undefined,
      });
      return null;
    }
  };

  // ========== GÉNÉRATION D'IMAGE (Edit-Multi) ==========
  const generateImageEditMulti = async (
    nodeId: string, 
    prompt: string, 
    aspectRatio: string,
    sourceImageUrl: string
  ): Promise<string | null> => {
    try {
      console.log(`[GenerationPanel] Génération image Edit-Multi pour ${nodeId}, AR: ${aspectRatio}`);
      console.log(`[GenerationPanel] Source image: ${sourceImageUrl.substring(0, 50)}...`);

      const response = await fetch('/api/image/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId,
          prompt,
          model: 'nano-banana-pro-edit-multi-wavespeed',
          projectId,
          sourceImages: [sourceImageUrl],
          aspectRatio,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[GenerationPanel] Erreur API image Edit:', errorText);
        // IMPORTANT: Retirer le flag generating même en cas d'erreur
        updateNodeData(nodeId, {
          generating: false,
          generatingStartTime: undefined,
        });
        return null;
      }

      const result = await response.json();
      const imageUrl = result.nodeData?.generated?.url || result.nodeData?.url;
      
      if (imageUrl) {
        // IMPORTANT: Combiner TOUTES les mises à jour en UN SEUL appel
        updateNodeData(nodeId, {
          generated: result.nodeData?.generated || { url: imageUrl, type: 'image/png' },
          url: imageUrl,
          generating: false,
          generatingStartTime: undefined,
        });
        console.log(`[GenerationPanel] Image Edit générée: ${imageUrl.substring(0, 50)}...`);
        return imageUrl;
      }

      // Pas d'URL = échec, retirer le flag
      updateNodeData(nodeId, {
        generating: false,
        generatingStartTime: undefined,
      });
      return null;
    } catch (error) {
      console.error('Erreur génération image Edit:', error);
      // Retirer le flag en cas d'exception
      updateNodeData(nodeId, {
        generating: false,
        generatingStartTime: undefined,
      });
      return null;
    }
  };

  // ========== GÉNÉRATION VIDÉO (via batch) ==========
  const generateVideoBatch = async (jobs: {
    nodeId: string;
    prompt: string;
    images: { url: string; type: string; originalUrl?: string }[];
    duration: number;
    aspectRatio: string;
  }[]): Promise<{ nodeId: string; success: boolean; videoUrl?: string; error?: string }[]> => {
    try {
      console.log(`[GenerationPanel] Génération batch de ${jobs.length} vidéos`);

      const response = await fetch('/api/batch-generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobs: jobs.map(j => ({
            nodeId: j.nodeId,
            modelId: 'kling-o1-i2v',
            prompt: j.prompt,
            images: j.images,
            duration: j.duration,
            aspectRatio: j.aspectRatio,
          })),
          projectId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[GenerationPanel] Erreur batch vidéo:', errorText);
        return jobs.map(j => ({ nodeId: j.nodeId, success: false, error: errorText }));
      }

      const result = await response.json();
      return result.results || [];
    } catch (error) {
      console.error('Erreur batch vidéo:', error);
      return jobs.map(j => ({ 
        nodeId: j.nodeId, 
        success: false, 
        error: error instanceof Error ? error.message : 'Erreur inconnue' 
      }));
    }
  };

  // ========== POPULATION COLLECTION ==========
  // Collection contient TOUTES les images (4 par personnage, 4 par décor)
  // LIMITE KLING : Max 7 images de référence pour vidéo
  // Images ACTIVÉES par défaut (pour vidéo) :
  //   - Personnages : primary + face (2/4)
  //   - Décors : primary + angle2 + plongee (3/4)
  // Images DÉSACTIVÉES par défaut (dans collection mais pas pour vidéo) :
  //   - Personnages : profile, back
  //   - Décors : contrePlongee
  const DISABLED_VIEW_TYPES = ['profile', 'back', 'contrePlongee'];
  
  const populateCollection = async (collectionNodeId: string, sourceNodeIds: string[]): Promise<boolean> => {
    try {
      const nodes = getNodes();
      const items: any[] = [];

      for (const sourceId of sourceNodeIds) {
        const sourceNode = nodes.find(n => n.id === sourceId);
        const url = sourceNode?.data?.generated?.url || sourceNode?.data?.url;
        const originalUrl = sourceNode?.data?.generated?.originalUrl; // URL CloudFront pour WaveSpeed video
        
        if (url) {
          // Vérifier si ce type de vue doit être désactivé par défaut
          const viewType = sourceNode?.data?.viewType as string | undefined;
          const shouldBeEnabled = !viewType || !DISABLED_VIEW_TYPES.includes(viewType);
          
          items.push({
            id: sourceId,
            type: 'image',
            enabled: shouldBeEnabled, // OFF pour profile, back, contrePlongee
            url,
            originalUrl, // URL CloudFront pour l'API WaveSpeed video
            width: sourceNode?.data?.generated?.width || 512,
            height: sourceNode?.data?.generated?.height || 512,
            name: sourceNode?.data?.label || 'Image',
            viewType, // Conserver le type de vue pour référence
          });
        }
      }

      if (items.length > 0) {
        updateNodeData(collectionNodeId, { items, collapsed: false });
        return true;
      }

      return true; // OK même si vide
    } catch (error) {
      console.error('Erreur population collection:', error);
      return false;
    }
  };

  // ========== ENVOI DVR ==========
  const sendVideoToDVR = async (nodeId: string): Promise<boolean> => {
    try {
      const nodes = getNodes();
      const node = nodes.find(n => n.id === nodeId);
      const url = node?.data?.generated?.url || node?.data?.url;

      if (!url) {
        console.error('[DVR] Pas d\'URL vidéo pour le nœud:', nodeId);
        return false;
      }

      const response = await fetch('/api/davinci-resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'import',
          filePath: url, // L'API attend "filePath", pas "url"
          clipName: node?.data?.label || 'Video',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[DVR] Erreur import:', errorData);
      }

      return response.ok;
    } catch (error) {
      console.error('[DVR] Erreur:', error);
      return false;
    }
  };

  // ========== RETRY ==========
  const retryStep = async (step: GenerationStep) => {
    console.log(`[GenerationPanel] Retry step: ${step.id} (${step.type})`);
    
    updateStep(step.id, { status: 'generating', error: undefined });

    let success = false;

    try {
      switch (step.type) {
        case 'image':
          if (step.imageInfo) {
            const result = await generateImageTextToImage(
              step.nodeId,
              step.imageInfo.prompt,
              step.imageInfo.aspectRatio
            );
            success = result !== null;
          }
          break;

        case 'image-edit':
          if (step.imageInfo?.referenceNodeId) {
            const nodes = getNodes();
            const refNode = nodes.find(n => n.id === step.imageInfo!.referenceNodeId);
            const refUrl = refNode?.data?.generated?.url || refNode?.data?.url;
            
            if (refUrl) {
              const result = await generateImageEditMulti(
                step.nodeId,
                step.imageInfo.prompt,
                step.imageInfo.aspectRatio,
                refUrl
              );
              success = result !== null;
            }
          }
          break;

        case 'video':
          if (step.videoInfo) {
            updateNodeData(step.nodeId, { 
              generating: true,
              generatingStartTime: Date.now(),
            });

            const nodes = getNodes();
            const images: { url: string; type: string; originalUrl?: string }[] = [];
            
            // Collecter les images des collections (enabled !== false pour inclure undefined)
            for (const collectionId of step.videoInfo.characterCollectionIds) {
              const collectionNode = nodes.find(n => n.id === collectionId);
              if (collectionNode?.data?.items) {
                for (const item of collectionNode.data.items as { enabled?: boolean; url?: string; type?: string; originalUrl?: string }[]) {
                  if (item.enabled !== false && item.url) {
                    images.push({ url: item.url, type: item.type || 'image/png', originalUrl: item.originalUrl });
                  }
                }
              }
            }
            if (step.videoInfo.locationCollectionId) {
              const locNode = nodes.find(n => n.id === step.videoInfo!.locationCollectionId);
              if (locNode?.data?.items) {
                const items = locNode.data.items as { enabled?: boolean; url?: string; type?: string; originalUrl?: string }[];
                const enabledItem = items.find(item => item.enabled !== false && item.url);
                if (enabledItem?.url) {
                  images.push({ url: enabledItem.url, type: enabledItem.type || 'image/png', originalUrl: enabledItem.originalUrl });
                }
              }
            }
            
            console.log(`[GenerationPanel] Vidéo individuelle ${step.nodeId} : ${images.length} images collectées`);

            const results = await generateVideoBatch([{
              nodeId: step.nodeId,
              prompt: step.videoInfo.prompt,
              images,
              duration: step.videoInfo.duration,
              aspectRatio: step.videoInfo.aspectRatio,
            }]);

            const result = results[0];
            if (result?.success && result.videoUrl) {
              updateNodeData(step.nodeId, {
                generated: { url: result.videoUrl, type: 'video/mp4' },
                generating: false,
                generatingStartTime: undefined,
                error: undefined, // Effacer l'erreur précédente
              });
              success = true;
            } else {
              // Capturer l'erreur complète de WaveSpeed
              const videoError = result?.error || 'Erreur vidéo inconnue';
              updateNodeData(step.nodeId, {
                generating: false,
                generatingStartTime: undefined,
                error: videoError, // Stocker l'erreur dans le nœud
              });
              // Mettre à jour le step avec l'erreur complète
              updateStep(step.id, { 
                status: 'error',
                error: videoError 
              });
              toast.error(`Erreur vidéo: ${videoError}`);
              return; // Sortir tôt, on a déjà géré l'erreur
            }
          }
          break;

        case 'collection':
          if (step.collectionSourceIds) {
            success = await populateCollection(step.nodeId, step.collectionSourceIds);
          }
          break;

        case 'dvr':
          success = await sendVideoToDVR(step.nodeId);
          break;
      }

      updateStep(step.id, { 
        status: success ? 'done' : 'error',
        error: success ? undefined : 'Échec du retry'
      });

      if (success) {
        toast.success(`Régénération réussie !`);
      } else {
        toast.error(`Échec du retry pour ${step.label}`);
      }
    } catch (error) {
      console.error('[GenerationPanel] Erreur retry:', error);
      updateStep(step.id, { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Erreur inconnue' 
      });
      toast.error(`Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  };

  // ========== LANCEMENT PRINCIPAL ==========
  const startGeneration = useCallback(async () => {
    if (!sequence || isGenerating) return;

    setAborted(false);
    setIsGenerating(true);
    setCurrentStep(0);

    // Préparer les étapes
    const allSteps: GenerationStep[] = [];
    
    // Récupérer les paramètres vidéo
    const videoSettings = (sequence as any).videoSettings || { duration: 10, aspectRatio: '16:9' };

    // ========== IMAGES PERSONNAGES ==========
    // Pour chaque personnage : 1ère image (fullBody) en T2I, puis les autres en Edit-Multi
    for (const charData of sequence.characterImages) {
      const order = charData.order || ['fullBody', 'face', 'profile', 'back'];
      const prompts = charData.prompts || {};
      const aspectRatios = charData.aspectRatios || {};
      
      // Map viewType -> nodeId
      const nodes = getNodes();
      const nodeIdsByView: Record<string, string> = {};
      for (const nodeId of charData.imageNodeIds || []) {
        const node = nodes.find(n => n.id === nodeId);
        if (node?.data?.viewType) {
          nodeIdsByView[node.data.viewType] = nodeId;
        }
      }
      
      let referenceNodeId: string | undefined;
      
      for (let i = 0; i < order.length; i++) {
        const viewType = order[i];
        const nodeId = nodeIdsByView[viewType];
        if (!nodeId) continue;
        
        const isReference = i === 0;
        
        if (isReference) {
          // Première image : Text-to-Image
          allSteps.push({
            id: `img-t2i-${nodeId}`,
            type: 'image',
            status: 'pending',
            nodeId,
            label: `🎨 ${viewType} (référence)`,
            imageInfo: {
              prompt: prompts[viewType] || '',
              aspectRatio: aspectRatios[viewType] || '9:16',
              isReference: true,
            },
          });
          referenceNodeId = nodeId;
        } else {
          // Autres images : Edit-Multi basé sur la référence
          allSteps.push({
            id: `img-edit-${nodeId}`,
            type: 'image-edit',
            status: 'pending',
            nodeId,
            label: `✏️ ${viewType} (variante)`,
            imageInfo: {
              prompt: prompts[viewType] || '',
              aspectRatio: aspectRatios[viewType] || '1:1',
              isReference: false,
              referenceNodeId,
            },
          });
        }
      }
    }

    // Collections personnages
    for (const [charId, collectionId] of sequence.characterCollections) {
      const charData = sequence.characterImages.find(c => c.characterId === charId);
      allSteps.push({
        id: `coll-${collectionId}`,
        type: 'collection',
        status: 'pending',
        nodeId: collectionId,
        label: `📁 Collection perso`,
        collectionSourceIds: charData?.imageNodeIds || [],
      });
    }

    // ========== IMAGES DÉCORS ==========
    for (const locData of sequence.locationImages) {
      const order = locData.order || ['angle1', 'angle2', 'angle3', 'angle4'];
      const prompts = locData.prompts || {};
      const aspectRatios = locData.aspectRatios || {};
      
      const nodes = getNodes();
      const nodeIdsByView: Record<string, string> = {};
      for (const nodeId of locData.imageNodeIds || []) {
        const node = nodes.find(n => n.id === nodeId);
        if (node?.data?.viewType) {
          nodeIdsByView[node.data.viewType] = nodeId;
        }
      }
      
      let referenceNodeId: string | undefined;
      
      for (let i = 0; i < order.length; i++) {
        const viewType = order[i];
        const nodeId = nodeIdsByView[viewType];
        if (!nodeId) continue;
        
        const isReference = i === 0;
        
        if (isReference) {
          allSteps.push({
            id: `img-t2i-${nodeId}`,
            type: 'image',
            status: 'pending',
            nodeId,
            label: `🎨 ${viewType} (référence)`,
            imageInfo: {
              prompt: prompts[viewType] || '',
              aspectRatio: aspectRatios[viewType] || '16:9',
              isReference: true,
            },
          });
          referenceNodeId = nodeId;
        } else {
          allSteps.push({
            id: `img-edit-${nodeId}`,
            type: 'image-edit',
            status: 'pending',
            nodeId,
            label: `✏️ ${viewType} (variante)`,
            imageInfo: {
              prompt: prompts[viewType] || '',
              aspectRatio: aspectRatios[viewType] || '16:9',
              isReference: false,
              referenceNodeId,
            },
          });
        }
      }
    }

    // Collections décors
    for (const [locId, collectionId] of sequence.locationCollections) {
      const locData = sequence.locationImages.find(l => l.locationId === locId);
      allSteps.push({
        id: `coll-${collectionId}`,
        type: 'collection',
        status: 'pending',
        nodeId: collectionId,
        label: `📁 Collection décor`,
        collectionSourceIds: locData?.imageNodeIds || [],
      });
    }

    // ========== VIDÉOS ==========
    for (const videoData of sequence.videos) {
      const videoNodeIds = videoData.videoNodeIds || [];
      
      for (let copyIdx = 0; copyIdx < videoNodeIds.length; copyIdx++) {
        const videoNodeId = videoNodeIds[copyIdx];
        allSteps.push({
          id: `video-${videoNodeId}`,
          type: 'video',
          status: 'pending',
          nodeId: videoNodeId,
          label: `🎬 Vidéo ${copyIdx + 1}`,
          videoInfo: {
            prompt: videoData.prompt || '',
            characterCollectionIds: videoData.characterCollectionIds || [],
            locationCollectionId: videoData.locationCollectionId,
            duration: videoSettings.duration,
            aspectRatio: videoSettings.aspectRatio,
          },
        });

        if (sendToDVR) {
          allSteps.push({
            id: `dvr-${videoNodeId}`,
            type: 'dvr',
            status: 'pending',
            nodeId: videoNodeId,
            label: `→ DVR`,
          });
        }
      }
    }

    setSteps(allSteps);

    let stepIdx = 0;
    let successCount = 0;
    let errorCount = 0;

    try {
      // ========== PHASE 1 : TOUTES les images PRIMAIRES EN PARALLÈLE ==========
      setCurrentPhase('🎨 Images PRIMAIRES (parallèle)');
      toast.info(`🚀 Lancement de TOUTES les images primaires EN PARALLÈLE !`);

      const referenceSteps = allSteps.filter(s => s.type === 'image');
      const referenceImageUrls: Record<string, string> = {};

      // Marquer TOUTES les primaires comme "generating" immédiatement
      // 1. Mettre à jour les steps (pour le panneau)
      // 2. Mettre à jour les nœuds ReactFlow (pour l'affichage visuel avec skeleton coloré)
      const primaryStartTime = Date.now();
      for (const step of referenceSteps) {
        updateStep(step.id, { status: 'generating' });
        updateNodeData(step.nodeId, { 
          generating: true, 
          generatingStartTime: primaryStartTime,
          isReference: true, // Pour la couleur violet du skeleton
        });
      }

      // Lancer TOUTES les primaires EN PARALLÈLE avec Promise.all
      console.log(`[GenerationPanel] 🚀 Lancement de ${referenceSteps.length} images primaires EN PARALLÈLE`);
      
      const primaryResults = await Promise.all(
        referenceSteps.map(async (step) => {
          if (aborted) return { step, url: null };
          
          if (step.imageInfo) {
            const url = await generateImageTextToImage(
              step.nodeId,
              step.imageInfo.prompt,
              step.imageInfo.aspectRatio
            );
            return { step, url };
          }
          return { step, url: null };
        })
      );

      // Traiter les résultats des primaires
      // Note: generateImageTextToImage gère déjà le flag generating dans updateNodeData
      for (const { step, url } of primaryResults) {
        if (url) {
          referenceImageUrls[step.nodeId] = url;
          updateStep(step.id, { status: 'done' });
          successCount++;
        } else {
          updateStep(step.id, { status: 'error', error: 'Échec génération' });
          errorCount++;
        }
        stepIdx++;
      }
      setCurrentStep(stepIdx);

      // ========== PHASE 2 : TOUTES les variantes EN PARALLÈLE ==========
      if (!aborted) {
        setCurrentPhase('✏️ Variantes (parallèle)');
        toast.info(`🚀 Lancement de TOUTES les variantes EN PARALLÈLE !`);

        const editSteps = allSteps.filter(s => s.type === 'image-edit');

        // Marquer TOUTES les variantes comme "generating" immédiatement
        // 1. Mettre à jour les steps (pour le panneau)
        // 2. Mettre à jour les nœuds ReactFlow (pour l'affichage visuel avec skeleton AMBRE)
        const variantStartTime = Date.now();
        for (const step of editSteps) {
          updateStep(step.id, { status: 'generating' });
          updateNodeData(step.nodeId, { 
            generating: true, 
            generatingStartTime: variantStartTime,
            isReference: false, // Pour la couleur AMBRE du skeleton (variante)
          });
        }

        // Lancer TOUTES les variantes EN PARALLÈLE avec Promise.all
        console.log(`[GenerationPanel] 🚀 Lancement de ${editSteps.length} variantes EN PARALLÈLE`);
        
        const variantResults = await Promise.all(
          editSteps.map(async (step) => {
            if (aborted) return { step, url: null, error: 'Annulé' };
            
            if (step.imageInfo?.referenceNodeId) {
              // Récupérer l'URL de l'image de référence
              const nodes = getNodes();
              const refNode = nodes.find(n => n.id === step.imageInfo!.referenceNodeId);
              const refUrl = refNode?.data?.generated?.url || refNode?.data?.url || referenceImageUrls[step.imageInfo.referenceNodeId];

              if (refUrl) {
                const url = await generateImageEditMulti(
                  step.nodeId,
                  step.imageInfo.prompt,
                  step.imageInfo.aspectRatio,
                  refUrl
                );
                return { step, url, error: url ? null : 'Échec edit' };
              } else {
                return { step, url: null, error: 'Image ref manquante' };
              }
            }
            return { step, url: null, error: 'Pas de référence' };
          })
        );

        // Traiter les résultats des variantes
        // Note: generateImageEditMulti gère déjà le flag generating dans updateNodeData
        for (const { step, url, error } of variantResults) {
          if (url) {
            updateStep(step.id, { status: 'done' });
            successCount++;
          } else {
            updateStep(step.id, { status: 'error', error: error || 'Échec' });
            errorCount++;
          }
          stepIdx++;
        }
        setCurrentStep(stepIdx);
      }

      // ========== PHASE 3 : Collections ==========
      // IMPORTANT: On stocke les items des collections localement pour éviter les problèmes de sync React
      // On ne stocke QUE les images activées (enabled) pour la génération vidéo
      // On inclut l'originalUrl (CloudFront) pour l'API WaveSpeed video
      const collectionItemsMap: Record<string, { url: string; type: string; originalUrl?: string }[]> = {};
      
      if (!aborted) {
        setCurrentPhase('📁 Collections');
        toast.info('Population des collections...');

        const collectionSteps = allSteps.filter(s => s.type === 'collection');
        const nodes = getNodes();

        for (const step of collectionSteps) {
          if (aborted) break;

          updateStep(step.id, { status: 'generating' });
          setCurrentStep(++stepIdx);

          if (step.collectionSourceIds) {
            // Récupérer les URLs des images sources (SEULEMENT celles activées pour la vidéo)
            const enabledItems: { url: string; type: string; originalUrl?: string }[] = [];
            
            for (const sourceId of step.collectionSourceIds) {
              const sourceNode = nodes.find(n => n.id === sourceId);
              const url = sourceNode?.data?.generated?.url || sourceNode?.data?.url;
              const originalUrl = sourceNode?.data?.generated?.originalUrl; // URL CloudFront pour WaveSpeed
              const viewType = sourceNode?.data?.viewType as string | undefined;
              
              // Filtrer les vues désactivées pour la vidéo (profile, back, contrePlongee)
              const shouldBeEnabled = !viewType || !DISABLED_VIEW_TYPES.includes(viewType);
              
              if (url && shouldBeEnabled) {
                enabledItems.push({ url, type: 'image/png', originalUrl });
              }
            }
            
            // Stocker localement SEULEMENT les images activées pour la phase vidéo
            collectionItemsMap[step.nodeId] = enabledItems;
            console.log(`[GenerationPanel] Collection ${step.nodeId} : ${enabledItems.length} images activées (sur ${step.collectionSourceIds.length} total, avec ${enabledItems.filter(i => i.originalUrl).length} URLs CloudFront)`);
            
            // Peupler aussi le nœud ReactFlow (avec TOUTES les images, enabled=true/false)
            const success = await populateCollection(step.nodeId, step.collectionSourceIds);
            updateStep(step.id, { status: success ? 'done' : 'error' });
            if (success) successCount++;
            else errorCount++;
          }
        }
      }

      // ========== PHASE 4 : Vidéos (en parallèle) ==========
      if (!aborted) {
        setCurrentPhase('🎬 Vidéos (parallèle)');
        
        const videoSteps = allSteps.filter(s => s.type === 'video');
        
        if (videoSteps.length > 0) {
          toast.info(`🎬 Lancement de ${videoSteps.length} vidéo${videoSteps.length > 1 ? 's' : ''} en parallèle...`);

          // Préparer tous les jobs
          const videoJobs: {
            nodeId: string;
            stepId: string;
            prompt: string;
            images: { url: string; type: string; originalUrl?: string }[];
            duration: number;
            aspectRatio: string;
          }[] = [];

          for (const step of videoSteps) {
            if (!step.videoInfo) continue;

            updateStep(step.id, { status: 'generating' });
            updateNodeData(step.nodeId, { 
              generating: true,
              generatingStartTime: Date.now(),
            });

            // Collecter les images - d'abord depuis la map locale, sinon depuis les nœuds ReactFlow
            const images: { url: string; type: string; originalUrl?: string }[] = [];
            const nodes = getNodes();
            
            for (const collectionId of step.videoInfo.characterCollectionIds) {
              // Essayer d'abord depuis collectionItemsMap (rempli pendant cette session)
              const collectionItems = collectionItemsMap[collectionId];
              if (collectionItems && collectionItems.length > 0) {
                images.push(...collectionItems);
              } else {
                // Sinon, récupérer depuis le nœud ReactFlow (projet existant)
                const collectionNode = nodes.find(n => n.id === collectionId);
                if (collectionNode?.data?.items) {
                  for (const item of collectionNode.data.items as { enabled?: boolean; url?: string; type?: string; originalUrl?: string }[]) {
                    if (item.enabled !== false && item.url) {
                      images.push({ url: item.url, type: item.type || 'image/png', originalUrl: item.originalUrl });
                    }
                  }
                }
              }
            }

            if (step.videoInfo.locationCollectionId) {
              const locItems = collectionItemsMap[step.videoInfo.locationCollectionId];
              if (locItems && locItems.length > 0) {
                images.push(locItems[0]);
              } else {
                // Sinon, récupérer depuis le nœud ReactFlow
                const locNode = nodes.find(n => n.id === step.videoInfo!.locationCollectionId);
                if (locNode?.data?.items) {
                  const items = locNode.data.items as { enabled?: boolean; url?: string; type?: string; originalUrl?: string }[];
                  const enabledItem = items.find(i => i.enabled !== false && i.url);
                  if (enabledItem?.url) {
                    images.push({ url: enabledItem.url, type: enabledItem.type || 'image/png', originalUrl: enabledItem.originalUrl });
                  }
                }
              }
            }

            console.log(`[GenerationPanel] Vidéo ${step.nodeId} : ${images.length} images collectées depuis ${collectionItemsMap[step.videoInfo.characterCollectionIds[0]] ? 'map locale' : 'nœuds ReactFlow'}`);

            videoJobs.push({
              nodeId: step.nodeId,
              stepId: step.id,
              prompt: step.videoInfo.prompt,
              images,
              duration: step.videoInfo.duration,
              aspectRatio: step.videoInfo.aspectRatio,
            });
          }

          setCurrentStep(stepIdx + videoJobs.length);

          // Lancer le batch
          const results = await generateVideoBatch(videoJobs.map(j => ({
            nodeId: j.nodeId,
            prompt: j.prompt,
            images: j.images,
            duration: j.duration,
            aspectRatio: j.aspectRatio,
          })));

          // Traiter les résultats
          for (const result of results) {
            const job = videoJobs.find(j => j.nodeId === result.nodeId);
            if (!job) continue;

            if (result.success && result.videoUrl) {
              updateNodeData(result.nodeId, {
                generated: { url: result.videoUrl, type: 'video/mp4' },
                generating: false,
                generatingStartTime: undefined,
              });
              updateStep(job.stepId, { status: 'done' });
              successCount++;

              // DVR si activé
              if (sendToDVR && !aborted) {
                const dvrStepId = `dvr-${result.nodeId}`;
                updateStep(dvrStepId, { status: 'generating' });
                const dvrSuccess = await sendVideoToDVR(result.nodeId);
                updateStep(dvrStepId, { status: dvrSuccess ? 'done' : 'error' });
                if (dvrSuccess) successCount++;
                else errorCount++;
              }
            } else {
              // Stocker l'erreur complète de WaveSpeed dans le nœud
              const videoError = result.error || 'Erreur vidéo inconnue';
              updateNodeData(result.nodeId, {
                generating: false,
                generatingStartTime: undefined,
                error: videoError, // Visible dans le nœud
              });
              updateStep(job.stepId, { status: 'error', error: videoError });
              console.error(`[GenerationPanel] Erreur vidéo ${result.nodeId}: ${videoError}`);
              errorCount++;
            }
          }

          stepIdx += videoJobs.length;
        }
      }

      // ========== TERMINÉ ==========
      setCurrentPhase('✅ Terminé');
      
      toast.success(`🎉 Génération terminée !\n✅ ${successCount} succès${errorCount > 0 ? `\n❌ ${errorCount} erreurs` : ''}`, { duration: 10000 });

    } catch (error: any) {
      console.error('Erreur génération:', error);
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setIsGenerating(false);
      
      // Rafraîchir la bibliothèque de médias pour afficher les nouveaux fichiers
      console.log('[GenerationPanel] Rafraîchissement de la bibliothèque de médias...');
      fetchMedias();
    }
  }, [sequence, isGenerating, aborted, sendToDVR, videoCopies, getNodes, updateNodeData, projectId, fetchMedias]);

  const cancelGeneration = () => {
    setAborted(true);
    setIsGenerating(false);
    toast.warning('Génération annulée');
  };

  // Nombre total de médias générables
  const totalGeneratable = sequence 
    ? stats.totalImages + stats.totalVideos
    : canvasStats.generatableImages + canvasStats.generatableVideos;

  // CODE COULEUR UNIFIÉ : Images = Vert Matrix, Vidéos = Fuchsia
  const getStepIcon = (step: GenerationStep) => {
    const isImage = step.type === 'image' || step.type === 'image-edit';
    const isVideo = step.type === 'video';
    
    if (step.status === 'generating') {
      const color = isImage ? 'text-[#00ff41]' : isVideo ? 'text-fuchsia-400' : 'text-blue-400';
      return <Loader2Icon size={14} className={`animate-spin ${color}`} />;
    }
    if (step.status === 'done') {
      const color = isImage ? 'text-[#00ff41]' : isVideo ? 'text-fuchsia-400' : 'text-emerald-400';
      return <CheckCircle2Icon size={14} className={color} />;
    }
    if (step.status === 'error') {
      return <AlertCircleIcon size={14} className="text-red-400" />;
    }
    
    switch (step.type) {
      case 'image': return <ImageIcon size={14} className="text-[#00ff41]" />;
      case 'image-edit': return <ImageIcon size={14} className="text-[#00ff41]" />;
      case 'video': return <VideoIcon size={14} className="text-fuchsia-400" />;
      case 'collection': return <FolderIcon size={14} className="text-zinc-500" />;
      case 'dvr': return <SendIcon size={14} className="text-zinc-500" />;
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          className="fixed bottom-24 right-6 z-50 gap-2 shadow-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500"
          size="lg"
        >
          <SparklesIcon size={18} />
          Générer
          {totalGeneratable > 0 && (
            <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-xs">
              {totalGeneratable}
            </span>
          )}
        </Button>
      </SheetTrigger>
      
      <SheetContent side="right" className="w-[450px] sm:w-[540px] flex flex-col p-6 bg-zinc-950 border-zinc-800">
        <SheetHeader className="flex-shrink-0 pr-10">
          <SheetTitle className="flex items-center gap-2 text-white">
            <SparklesIcon className="text-[#00ff41]" />
            Génération des médias
          </SheetTitle>
          <SheetDescription className="text-zinc-400">
            {sequence ? 'Séquence de génération disponible' : 'Analyse des nœuds du canvas'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6 flex-1 overflow-y-auto pr-4">
          {/* Stats - Code couleur unifié */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-[#00ff41]/10 border border-[#00ff41]/30 p-3 text-center">
              <ImageIcon size={20} className="mx-auto mb-1 text-[#00ff41]" />
              <p className="text-lg font-bold text-[#00ff41]">{stats.totalImages}</p>
              <p className="text-xs text-zinc-400">Images</p>
              {!sequence && canvasStats.generatableImages > 0 && (
                <p className="text-[10px] text-[#00ff41]/70 mt-1">
                  {canvasStats.generatableImages} à générer
                </p>
              )}
            </div>
            <div className="rounded-lg bg-zinc-800/50 p-3 text-center">
              <FolderIcon size={20} className="mx-auto mb-1 text-zinc-400" />
              <p className="text-lg font-bold text-zinc-300">{stats.totalCollections}</p>
              <p className="text-xs text-muted-foreground">Collections</p>
            </div>
            <div className="rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/30 p-3 text-center">
              <VideoIcon size={20} className="mx-auto mb-1 text-fuchsia-400" />
              <p className="text-lg font-bold text-fuchsia-400">{stats.totalVideos}</p>
              <p className="text-xs text-zinc-400">Vidéos</p>
              {!sequence && canvasStats.generatableVideos > 0 && (
                <p className="text-[10px] text-fuchsia-400/70 mt-1">
                  {canvasStats.generatableVideos} à générer
                </p>
              )}
            </div>
          </div>

          {/* Message si pas de séquence */}
          {!sequence && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-4">
              <p className="text-sm text-amber-400 font-medium mb-2">
                ⚠️ Pas de séquence de génération
              </p>
              <p className="text-xs text-zinc-400">
                Ce projet n'a pas été créé via un brief. Pour régénérer des médias :
              </p>
              <ul className="text-xs text-zinc-400 mt-2 space-y-1">
                <li>• Cliquez sur un nœud image et utilisez le bouton "Générer"</li>
                <li>• Cliquez sur un nœud vidéo et utilisez le bouton "Générer"</li>
              </ul>
              <p className="text-xs text-zinc-500 mt-3">
                {canvasStats.totalImages} images • {canvasStats.totalVideos} vidéos dans le canvas
              </p>
            </div>
          )}

          {/* Info génération */}
          <div className="rounded-lg bg-zinc-900/50 p-3 text-sm">
            <p className="font-medium text-zinc-300 mb-1">✨ Génération intelligente</p>
            <ul className="text-xs text-zinc-500 space-y-1">
              <li>• Images primaires → variantes cohérentes</li>
              <li>• Vidéos : 10s en 16:9 par défaut</li>
            </ul>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 rounded-lg bg-muted/20 p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={sendToDVR}
                onChange={(e) => setSendToDVR(e.target.checked)}
                className="h-4 w-4 rounded border-border"
                disabled={isGenerating}
              />
              <div>
                <p className="font-medium">Envoyer à DaVinci Resolve</p>
                <p className="text-xs text-muted-foreground">Importe automatiquement les vidéos</p>
              </div>
            </label>
          </div>

          {/* Boutons */}
          <div className="flex gap-3">
            {!isGenerating ? (
              <Button
                onClick={startGeneration}
                className="flex-1 gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600"
              >
                <PlayIcon size={16} />
                Lancer la génération
              </Button>
            ) : (
              <Button
                onClick={cancelGeneration}
                variant="destructive"
                className="flex-1 gap-2"
              >
                <XIcon size={16} />
                Annuler
              </Button>
            )}
          </div>

          {/* Progression */}
          {isGenerating && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{currentPhase}</span>
                <span className="text-muted-foreground">
                  {currentStep} / {totalSteps}
                </span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Liste des étapes */}
          {steps.length > 0 && (
            <ScrollArea className="max-h-[40vh] rounded-lg border border-border/50 p-3">
              <div className="space-y-1">
                {steps.map((step) => (
                  <div
                    key={step.id}
                    className={cn(
                      'flex items-center gap-2 rounded px-2 py-1 text-sm',
                      step.status === 'generating' && 'bg-blue-500/10',
                      step.status === 'done' && 'text-emerald-400/70',
                      step.status === 'error' && 'text-red-400/70 bg-red-500/5'
                    )}
                  >
                    {getStepIcon(step)}
                    <span className="flex-1">{step.label}</span>
                    {step.status === 'error' && !isGenerating && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs hover:bg-red-500/20"
                        onClick={() => retryStep(step)}
                      >
                        <RotateCcwIcon size={12} className="mr-1" />
                        Retry
                      </Button>
                    )}
                    {step.error && (
                      <span className="text-xs text-red-400 ml-1 max-w-[100px] truncate" title={step.error}>
                        {step.error}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
          
          <div className="h-4" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
