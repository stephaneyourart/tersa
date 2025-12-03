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

  // Calculer les stats
  const stats = sequence ? {
    totalImages: 
      sequence.characterImages.reduce((acc, c) => acc + (c.imageNodeIds?.length || 0), 0) +
      sequence.locationImages.reduce((acc, l) => acc + (l.imageNodeIds?.length || 0), 0),
    totalCollections: sequence.characterCollections.length + sequence.locationCollections.length,
    totalVideos: sequence.videos.reduce((acc, v) => acc + (v.videoNodeIds?.length || 0), 0),
  } : { totalImages: 0, totalCollections: 0, totalVideos: 0 };

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
        return null;
      }

      const result = await response.json();
      const imageUrl = result.nodeData?.generated?.url || result.nodeData?.url;
      
      if (imageUrl) {
        updateNodeData(nodeId, {
          generated: result.nodeData?.generated || { url: imageUrl, type: 'image/png' },
          url: imageUrl,
        });
        console.log(`[GenerationPanel] Image T2I générée: ${imageUrl.substring(0, 50)}...`);
        return imageUrl;
      }

      return null;
    } catch (error) {
      console.error('Erreur génération image T2I:', error);
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
        return null;
      }

      const result = await response.json();
      const imageUrl = result.nodeData?.generated?.url || result.nodeData?.url;
      
      if (imageUrl) {
        updateNodeData(nodeId, {
          generated: result.nodeData?.generated || { url: imageUrl, type: 'image/png' },
          url: imageUrl,
        });
        console.log(`[GenerationPanel] Image Edit générée: ${imageUrl.substring(0, 50)}...`);
        return imageUrl;
      }

      return null;
    } catch (error) {
      console.error('Erreur génération image Edit:', error);
      return null;
    }
  };

  // ========== GÉNÉRATION VIDÉO (via batch) ==========
  const generateVideoBatch = async (jobs: {
    nodeId: string;
    prompt: string;
    images: { url: string; type: string }[];
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
  const populateCollection = async (collectionNodeId: string, sourceNodeIds: string[]): Promise<boolean> => {
    try {
      const nodes = getNodes();
      const items: any[] = [];

      for (const sourceId of sourceNodeIds) {
        const sourceNode = nodes.find(n => n.id === sourceId);
        const url = sourceNode?.data?.generated?.url || sourceNode?.data?.url;
        
        if (url) {
          items.push({
            id: sourceId,
            type: 'image',
            enabled: true,
            url,
            width: sourceNode?.data?.generated?.width || 512,
            height: sourceNode?.data?.generated?.height || 512,
            name: sourceNode?.data?.label || 'Image',
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

      if (!url) return false;

      const response = await fetch('/api/davinci-resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'import',
          url,
          name: node?.data?.label || 'Video',
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Erreur DVR:', error);
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
            const images: { url: string; type: string }[] = [];
            
            // Collecter les images des collections
            for (const collectionId of step.videoInfo.characterCollectionIds) {
              const collectionNode = nodes.find(n => n.id === collectionId);
              if (collectionNode?.data?.items) {
                for (const item of collectionNode.data.items) {
                  if (item.enabled && item.url) {
                    images.push({ url: item.url, type: item.type || 'image/png' });
                  }
                }
              }
            }
            if (step.videoInfo.locationCollectionId) {
              const locNode = nodes.find(n => n.id === step.videoInfo!.locationCollectionId);
              if (locNode?.data?.items) {
                const enabledItem = locNode.data.items.find((item: any) => item.enabled && item.url);
                if (enabledItem) {
                  images.push({ url: enabledItem.url, type: enabledItem.type || 'image/png' });
                }
              }
            }

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
              });
              success = true;
            } else {
              updateNodeData(step.nodeId, {
                generating: false,
                generatingStartTime: undefined,
              });
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

    // ========== IMAGES LIEUX ==========
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

    // Collections lieux
    for (const [locId, collectionId] of sequence.locationCollections) {
      const locData = sequence.locationImages.find(l => l.locationId === locId);
      allSteps.push({
        id: `coll-${collectionId}`,
        type: 'collection',
        status: 'pending',
        nodeId: collectionId,
        label: `📁 Collection lieu`,
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
      // ========== PHASE 1 : Images de référence (T2I) ==========
      setCurrentPhase('🎨 Images de référence');
      toast.info('Génération des images de référence (fond noir, studio)...');

      const referenceSteps = allSteps.filter(s => s.type === 'image');
      const referenceImageUrls: Record<string, string> = {};

      for (const step of referenceSteps) {
        if (aborted) break;

        updateStep(step.id, { status: 'generating' });
        setCurrentStep(++stepIdx);

        if (step.imageInfo) {
          const url = await generateImageTextToImage(
            step.nodeId,
            step.imageInfo.prompt,
            step.imageInfo.aspectRatio
          );
          
          if (url) {
            referenceImageUrls[step.nodeId] = url;
            updateStep(step.id, { status: 'done' });
            successCount++;
          } else {
            updateStep(step.id, { status: 'error', error: 'Échec génération' });
            errorCount++;
          }
        }

        await delay(500); // Petit délai entre les appels
      }

      // ========== PHASE 2 : Images variantes (Edit-Multi) ==========
      if (!aborted) {
        setCurrentPhase('✏️ Variantes (edit-multi)');
        toast.info('Génération des variantes à partir des références...');

        const editSteps = allSteps.filter(s => s.type === 'image-edit');

        for (const step of editSteps) {
          if (aborted) break;

          updateStep(step.id, { status: 'generating' });
          setCurrentStep(++stepIdx);

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
              
              if (url) {
                updateStep(step.id, { status: 'done' });
                successCount++;
              } else {
                updateStep(step.id, { status: 'error', error: 'Échec edit' });
                errorCount++;
              }
            } else {
              updateStep(step.id, { status: 'error', error: 'Image ref manquante' });
              errorCount++;
            }
          }

          await delay(500);
        }
      }

      // ========== PHASE 3 : Collections ==========
      if (!aborted) {
        setCurrentPhase('📁 Collections');
        toast.info('Population des collections...');

        const collectionSteps = allSteps.filter(s => s.type === 'collection');

        for (const step of collectionSteps) {
          if (aborted) break;

          updateStep(step.id, { status: 'generating' });
          setCurrentStep(++stepIdx);

          if (step.collectionSourceIds) {
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
            images: { url: string; type: string }[];
            duration: number;
            aspectRatio: string;
          }[] = [];

          const nodes = getNodes();

          for (const step of videoSteps) {
            if (!step.videoInfo) continue;

            updateStep(step.id, { status: 'generating' });
            updateNodeData(step.nodeId, { 
              generating: true,
              generatingStartTime: Date.now(),
            });

            // Collecter les images des collections
            const images: { url: string; type: string }[] = [];
            
            for (const collectionId of step.videoInfo.characterCollectionIds) {
              const collectionNode = nodes.find(n => n.id === collectionId);
              if (collectionNode?.data?.items) {
                for (const item of collectionNode.data.items) {
                  if (item.enabled && item.url) {
                    images.push({ url: item.url, type: item.type || 'image/png' });
                  }
                }
              }
            }

            if (step.videoInfo.locationCollectionId) {
              const locNode = nodes.find(n => n.id === step.videoInfo!.locationCollectionId);
              if (locNode?.data?.items) {
                const enabledItem = locNode.data.items.find((item: any) => item.enabled && item.url);
                if (enabledItem) {
                  images.push({ url: enabledItem.url, type: enabledItem.type || 'image/png' });
                }
              }
            }

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
              updateNodeData(result.nodeId, {
                generating: false,
                generatingStartTime: undefined,
              });
              updateStep(job.stepId, { status: 'error', error: result.error || 'Échec' });
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
    }
  }, [sequence, isGenerating, aborted, sendToDVR, videoCopies, getNodes, updateNodeData, projectId]);

  const cancelGeneration = () => {
    setAborted(true);
    setIsGenerating(false);
    toast.warning('Génération annulée');
  };

  // Ne pas afficher si pas de séquence
  if (!sequence) {
    return null;
  }

  const getStepIcon = (step: GenerationStep) => {
    if (step.status === 'generating') {
      return <Loader2Icon size={14} className="animate-spin text-blue-400" />;
    }
    if (step.status === 'done') {
      return <CheckCircle2Icon size={14} className="text-emerald-400" />;
    }
    if (step.status === 'error') {
      return <AlertCircleIcon size={14} className="text-red-400" />;
    }
    
    switch (step.type) {
      case 'image': return <ImageIcon size={14} className="text-violet-400" />;
      case 'image-edit': return <ImageIcon size={14} className="text-amber-400" />;
      case 'video': return <VideoIcon size={14} className="text-emerald-400" />;
      case 'collection': return <FolderIcon size={14} className="text-muted-foreground" />;
      case 'dvr': return <SendIcon size={14} className="text-muted-foreground" />;
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
          Générer les médias
          <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-xs">
            {stats.totalImages + stats.totalVideos}
          </span>
        </Button>
      </SheetTrigger>
      
      <SheetContent side="right" className="w-[450px] sm:w-[540px] flex flex-col p-6">
        <SheetHeader className="flex-shrink-0 pr-10">
          <SheetTitle className="flex items-center gap-2">
            <SparklesIcon className="text-violet-400" />
            Génération automatique
          </SheetTitle>
          <SheetDescription>
            Images cohérentes (edit-multi) + Vidéos 10s 16:9
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6 flex-1 overflow-y-auto pr-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-muted/30 p-3 text-center">
              <ImageIcon size={20} className="mx-auto mb-1 text-violet-400" />
              <p className="text-lg font-bold">{stats.totalImages}</p>
              <p className="text-xs text-muted-foreground">Images</p>
            </div>
            <div className="rounded-lg bg-muted/30 p-3 text-center">
              <FolderIcon size={20} className="mx-auto mb-1 text-amber-400" />
              <p className="text-lg font-bold">{stats.totalCollections}</p>
              <p className="text-xs text-muted-foreground">Collections</p>
            </div>
            <div className="rounded-lg bg-muted/30 p-3 text-center">
              <VideoIcon size={20} className="mx-auto mb-1 text-emerald-400" />
              <p className="text-lg font-bold">{stats.totalVideos}</p>
              <p className="text-xs text-muted-foreground">Vidéos</p>
            </div>
          </div>

          {/* Info nouvelle logique */}
          <div className="rounded-lg bg-violet-500/10 border border-violet-500/20 p-3 text-sm">
            <p className="font-medium text-violet-300 mb-1">✨ Nouvelle logique de génération</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Personnages : fond noir, studio neutre, expression neutre</li>
              <li>• 1ère image de référence, puis variantes cohérentes (edit-multi)</li>
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
