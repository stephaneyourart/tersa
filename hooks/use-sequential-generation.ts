/**
 * Hook pour la génération TOUT EN // des médias dans le canvas
 * 
 * ARCHITECTURE TOUT EN // :
 * 1. TOUTES les images primaires (personnages + décors) lancées SIMULTANÉMENT
 * 2. Dès qu'une primaire est prête, ses variantes sont lancées IMMÉDIATEMENT
 *    (pas d'attente que les autres primaires soient terminées)
 * 3. Une fois toutes les images terminées, populer les collections
 * 4. TOUTES les vidéos lancées EN PARALLÈLE
 */

import { useState, useCallback, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { Node } from '@xyflow/react';
import { toast } from 'sonner';

export interface GenerationStep {
  id: string;
  type: 'image' | 'image-edit' | 'video' | 'collection' | 'dvr';
  status: 'pending' | 'generating' | 'done' | 'error';
  nodeId: string;
  label: string;
  error?: string;
  imageInfo?: {
    prompt: string;
    aspectRatio: string;
    isReference?: boolean;
    referenceNodeId?: string;
  };
  videoInfo?: {
    prompt: string;
    characterCollectionIds?: string[];
    locationCollectionId?: string;
    duration?: number;
  };
  collectionSourceIds?: string[];
}

export interface GenerationProgress {
  currentStep: number;
  totalSteps: number;
  currentPhase: 'primary_images' | 'variant_images' | 'collections' | 'videos' | 'dvr' | 'done';
  steps: GenerationStep[];
  isGenerating: boolean;
  activeGenerations: number;  // Nombre de générations en cours simultanément
}

interface UseSequentialGenerationOptions {
  onComplete?: (summary: GenerationSummary) => void;
  onError?: (error: string) => void;
  videoCopies?: number;
  imageModel?: string;
  videoModel?: string;
}

export interface GenerationSummary {
  totalImages: number;
  totalVideos: number;
  totalCollections: number;
  sentToDVR: number;
  errors: string[];
  duration: number;
}

export function useSequentialGeneration(options: UseSequentialGenerationOptions = {}) {
  const {
    onComplete,
    onError,
    videoCopies = 4,
    // IDs RÉELS depuis models-registry.ts (source de vérité)
    imageModel = 'wavespeed/google/nano-banana-pro/text-to-image-ultra',
    videoModel = 'kwaivgi/kling-v2.5-turbo-pro/image-to-video',
  } = options;

  const { getNodes, setNodes, updateNodeData } = useReactFlow();
  const [progress, setProgress] = useState<GenerationProgress>({
    currentStep: 0,
    totalSteps: 0,
    currentPhase: 'primary_images',
    steps: [],
    isGenerating: false,
    activeGenerations: 0,
  });
  
  const abortRef = useRef(false);
  const startTimeRef = useRef<number>(0);
  const generatedImagesRef = useRef<Map<string, string>>(new Map()); // nodeId -> url

  // ========== UTILITAIRES ==========
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const waitForNodeRender = async (nodeId: string, timeout = 60000): Promise<string | null> => {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (abortRef.current) return null;
      
      const nodes = getNodes();
      const node = nodes.find(n => n.id === nodeId);
      
      // Vérifier si le nœud a une URL générée
      const url = node?.data?.generated?.url || node?.data?.url;
      if (url) {
        generatedImagesRef.current.set(nodeId, url);
        return url;
      }
      
      await delay(500);
    }
    
    return null;
  };

  const updateStep = (stepId: string, updates: Partial<GenerationStep>) => {
    setProgress(prev => ({
      ...prev,
      steps: prev.steps.map(s => s.id === stepId ? { ...s, ...updates } : s),
    }));
  };

  const incrementActiveGenerations = () => {
    setProgress(prev => ({ ...prev, activeGenerations: prev.activeGenerations + 1 }));
  };

  const decrementActiveGenerations = () => {
    setProgress(prev => ({ ...prev, activeGenerations: Math.max(0, prev.activeGenerations - 1) }));
  };

  const incrementCompletedSteps = () => {
    setProgress(prev => ({ ...prev, currentStep: prev.currentStep + 1 }));
  };

  // ========== GÉNÉRATION D'IMAGE TEXT-TO-IMAGE ==========
  const generateImageT2I = async (nodeId: string, prompt: string, aspectRatio: string): Promise<boolean> => {
    try {
      incrementActiveGenerations();
      
      const response = await fetch('/api/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId,
          prompt,
          model: imageModel,
          aspectRatio,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erreur génération image:', errorText);
        toast.error(`❌ Image ${nodeId.substring(0, 8)}`, {
          description: errorText.substring(0, 200),
          duration: 60_000,
          closeButton: true,
        });
        return false;
      }

      // Attendre que l'image soit rendue dans le nœud
      const url = await waitForNodeRender(nodeId);
      return url !== null;
    } catch (error: any) {
      console.error('Erreur génération image:', error);
      toast.error(`❌ Image ${nodeId.substring(0, 8)}`, {
        description: error?.message || String(error),
        duration: 60_000,
        closeButton: true,
      });
      return false;
    } finally {
      decrementActiveGenerations();
    }
  };

  // ========== GÉNÉRATION D'IMAGE EDIT (variantes) ==========
  // Dériver le modèle I2I depuis le modèle T2I
  // Source de vérité: models-registry.ts
  const getEditModel = (t2iModel: string): string => {
    // Mapping T2I → I2I depuis models-registry.ts
    if (t2iModel.includes('nano-banana-pro') && t2iModel.includes('ultra')) {
      return 'wavespeed/google/nano-banana-pro/edit-ultra';
    }
    if (t2iModel.includes('nano-banana-pro')) {
      return 'wavespeed/google/nano-banana-pro/edit';
    }
    if (t2iModel.includes('nano-banana')) {
      return 'wavespeed/google/nano-banana/edit';
    }
    // Fallback: remplacer text-to-image par edit
    return t2iModel.replace('text-to-image-ultra', 'edit-ultra').replace('text-to-image', 'edit');
  };
  
  const generateImageEdit = async (
    nodeId: string, 
    prompt: string, 
    aspectRatio: string,
    referenceImageUrl: string
  ): Promise<boolean> => {
    try {
      incrementActiveGenerations();
      
      const editModel = getEditModel(imageModel);
      
      const response = await fetch('/api/image/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId,
          prompt,
          model: editModel,
          aspectRatio,
          sourceImages: [referenceImageUrl],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erreur génération image edit:', errorText);
        toast.error(`❌ Edit ${nodeId.substring(0, 8)}`, {
          description: errorText.substring(0, 200),
          duration: 60_000,
          closeButton: true,
        });
        return false;
      }

      // Attendre que l'image soit rendue dans le nœud
      const url = await waitForNodeRender(nodeId);
      return url !== null;
    } catch (error: any) {
      console.error('Erreur génération image edit:', error);
      toast.error(`❌ Edit ${nodeId.substring(0, 8)}`, {
        description: error?.message || String(error),
        duration: 60_000,
        closeButton: true,
      });
      return false;
    } finally {
      decrementActiveGenerations();
    }
  };

  // ========== GÉNÉRATION DE VIDÉO ==========
  const generateVideo = async (nodeId: string, prompt: string): Promise<boolean> => {
    try {
      incrementActiveGenerations();
      
      const response = await fetch('/api/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId,
          prompt,
          model: videoModel,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erreur génération vidéo:', errorText);
        toast.error(`❌ Vidéo ${nodeId.substring(0, 8)}`, {
          description: `[${videoModel}] ${errorText.substring(0, 200)}`,
          duration: 60_000,
          closeButton: true,
        });
        return false;
      }

      // Attendre que la vidéo soit rendue
      const url = await waitForNodeRender(nodeId, 180000); // 3 minutes pour les vidéos
      return url !== null;
    } catch (error: any) {
      console.error('Erreur génération vidéo:', error);
      toast.error(`❌ Vidéo ${nodeId.substring(0, 8)}`, {
        description: `[${videoModel}] ${error?.message || String(error)}`,
        duration: 60_000,
        closeButton: true,
      });
      return false;
    } finally {
      decrementActiveGenerations();
    }
  };

  // ========== POPULATION DE COLLECTION ==========
  const populateCollection = async (
    collectionNodeId: string,
    sourceNodeIds: string[]
  ): Promise<boolean> => {
    try {
      const nodes = getNodes();
      const items: any[] = [];

      for (const sourceId of sourceNodeIds) {
        const sourceNode = nodes.find(n => n.id === sourceId);
        const url = sourceNode?.data?.generated?.url || sourceNode?.data?.url || generatedImagesRef.current.get(sourceId);
        
        if (url) {
          items.push({
            id: sourceId,
            type: 'image',
            enabled: true,
            url,
            width: sourceNode?.data?.generated?.width || sourceNode?.width,
            height: sourceNode?.data?.generated?.height || sourceNode?.height,
            name: sourceNode?.data?.label || 'Image',
          });
        }
      }

      if (items.length > 0) {
        updateNodeData(collectionNodeId, { items, collapsed: false });
        return true;
      }

      return false;
    } catch (error) {
      console.error('Erreur population collection:', error);
      return false;
    }
  };

  // ========== ENVOI À DVR ==========
  const sendToDVR = async (nodeId: string): Promise<boolean> => {
    try {
      const nodes = getNodes();
      const node = nodes.find(n => n.id === nodeId);
      
      if (!node?.data?.generated?.url && !node?.data?.url) {
        return false;
      }

      const response = await fetch('/api/davinci-resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'import',
          url: node.data.generated?.url || node.data.url,
          name: node.data.label || 'Media',
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Erreur envoi DVR:', error);
      return false;
    }
  };

  // ========== GÉNÉRATION PARALLÈLE PRINCIPALE ==========
  const startGeneration = useCallback(async (
    characterImageNodes: { 
      characterId: string; 
      imageNodeIds: string[];
      prompts: Record<string, string>;
      aspectRatios: Record<string, string>;
      order: string[];
      generationTypes?: Record<string, string>;
      primaryNodeId?: string;
    }[],
    locationImageNodes: { 
      locationId: string; 
      imageNodeIds: string[];
      prompts: Record<string, string>;
      aspectRatios: Record<string, string>;
      order: string[];
      generationTypes?: Record<string, string>;
      primaryNodeId?: string;
    }[],
    characterCollections: [string, string][],
    locationCollections: [string, string][],
    videoNodes: { 
      planId: string; 
      videoNodeIds: string[];
      prompt: string;
      characterCollectionIds?: string[];
      locationCollectionId?: string;
    }[],
    sendToDVRAfter: boolean = false,
    videoSettings?: { duration: number; aspectRatio: string }
  ) => {
    if (progress.isGenerating) {
      toast.error('Une génération est déjà en cours');
      return;
    }

    abortRef.current = false;
    startTimeRef.current = Date.now();
    generatedImagesRef.current.clear();

    // Préparer les étapes
    const steps: GenerationStep[] = [];
    const nodes = getNodes();
    
    // Collecter toutes les tâches d'images primaires
    const primaryImageTasks: { 
      stepId: string; 
      nodeId: string; 
      prompt: string; 
      aspectRatio: string;
      entityType: 'character' | 'location';
      entityId: string;
    }[] = [];
    
    // Collecter toutes les tâches de variantes (seront lancées après leur primaire)
    const variantImageTasks: Map<string, {
      stepId: string;
      nodeId: string;
      prompt: string;
      aspectRatio: string;
      referenceNodeId: string;
    }[]> = new Map();

    // Images personnages
    for (const charData of characterImageNodes) {
      const order = charData.order || ['primary', 'face', 'profile', 'back'];
      const nodeIdsByView: Record<string, string> = {};
      
      for (let i = 0; i < order.length; i++) {
        const viewType = order[i];
        if (charData.imageNodeIds[i]) {
          nodeIdsByView[viewType] = charData.imageNodeIds[i];
        }
      }

      for (let i = 0; i < order.length; i++) {
        const viewType = order[i];
        const nodeId = nodeIdsByView[viewType];
        if (!nodeId) continue;

        const isReference = i === 0;
        const stepId = isReference ? `img-t2i-${nodeId}` : `img-edit-${nodeId}`;
        const prompt = charData.prompts[viewType] || '';
        const aspectRatio = charData.aspectRatios[viewType] || '1:1';

        steps.push({
          id: stepId,
          type: isReference ? 'image' : 'image-edit',
          status: 'pending',
          nodeId,
          label: isReference ? `🎨 ${viewType} (référence)` : `✏️ ${viewType} (variante)`,
          imageInfo: {
            prompt,
            aspectRatio,
            isReference,
            referenceNodeId: isReference ? undefined : nodeIdsByView[order[0]],
          },
        });

        if (isReference) {
          primaryImageTasks.push({
            stepId,
            nodeId,
            prompt,
            aspectRatio,
            entityType: 'character',
            entityId: charData.characterId,
          });
        } else {
          const primaryNodeId = charData.primaryNodeId || nodeIdsByView[order[0]];
          if (!variantImageTasks.has(primaryNodeId)) {
            variantImageTasks.set(primaryNodeId, []);
          }
          variantImageTasks.get(primaryNodeId)!.push({
            stepId,
            nodeId,
            prompt,
            aspectRatio,
            referenceNodeId: primaryNodeId,
          });
        }
      }
    }

    // Images décors/lieux
    for (const locData of locationImageNodes) {
      const order = locData.order || ['primary', 'angle2', 'plongee', 'contrePlongee'];
      const nodeIdsByView: Record<string, string> = {};
      
      for (let i = 0; i < order.length; i++) {
        const viewType = order[i];
        if (locData.imageNodeIds[i]) {
          nodeIdsByView[viewType] = locData.imageNodeIds[i];
        }
      }

      for (let i = 0; i < order.length; i++) {
        const viewType = order[i];
        const nodeId = nodeIdsByView[viewType];
        if (!nodeId) continue;

        const isReference = i === 0;
        const stepId = isReference ? `img-t2i-${nodeId}` : `img-edit-${nodeId}`;
        const prompt = locData.prompts[viewType] || '';
        const aspectRatio = locData.aspectRatios[viewType] || '16:9';

        steps.push({
          id: stepId,
          type: isReference ? 'image' : 'image-edit',
          status: 'pending',
          nodeId,
          label: isReference ? `🎨 ${viewType} (référence)` : `✏️ ${viewType} (variante)`,
          imageInfo: {
            prompt,
            aspectRatio,
            isReference,
            referenceNodeId: isReference ? undefined : nodeIdsByView[order[0]],
          },
        });

        if (isReference) {
          primaryImageTasks.push({
            stepId,
            nodeId,
            prompt,
            aspectRatio,
            entityType: 'location',
            entityId: locData.locationId,
          });
        } else {
          const primaryNodeId = locData.primaryNodeId || nodeIdsByView[order[0]];
          if (!variantImageTasks.has(primaryNodeId)) {
            variantImageTasks.set(primaryNodeId, []);
          }
          variantImageTasks.get(primaryNodeId)!.push({
            stepId,
            nodeId,
            prompt,
            aspectRatio,
            referenceNodeId: primaryNodeId,
          });
        }
      }
    }

    // Collections personnages
    for (const [charId, collectionId] of characterCollections) {
      const charData = characterImageNodes.find(c => c.characterId === charId);
      steps.push({
        id: `coll-${collectionId}`,
        type: 'collection',
        status: 'pending',
        nodeId: collectionId,
        label: `📁 Collection perso`,
        collectionSourceIds: charData?.imageNodeIds || [],
      });
    }

    // Collections décors
    for (const [locId, collectionId] of locationCollections) {
      const locData = locationImageNodes.find(l => l.locationId === locId);
      steps.push({
        id: `coll-${collectionId}`,
        type: 'collection',
        status: 'pending',
        nodeId: collectionId,
        label: `📁 Collection décor`,
        collectionSourceIds: locData?.imageNodeIds || [],
      });
    }

    // Vidéos
    for (const videoData of videoNodes) {
      for (let copyIdx = 0; copyIdx < videoData.videoNodeIds.length; copyIdx++) {
        const videoNodeId = videoData.videoNodeIds[copyIdx];
        steps.push({
          id: `video-${videoNodeId}`,
          type: 'video',
          status: 'pending',
          nodeId: videoNodeId,
          label: `🎬 Vidéo ${copyIdx + 1}`,
          videoInfo: {
            prompt: videoData.prompt || '',
            characterCollectionIds: videoData.characterCollectionIds,
            locationCollectionId: videoData.locationCollectionId,
            duration: videoSettings?.duration,
          },
        });

        if (sendToDVRAfter) {
          steps.push({
            id: `dvr-${videoNodeId}`,
            type: 'dvr',
            status: 'pending',
            nodeId: videoNodeId,
            label: `📤 DVR`,
          });
        }
      }
    }

    setProgress({
      currentStep: 0,
      totalSteps: steps.length,
      currentPhase: 'primary_images',
      steps,
      isGenerating: true,
      activeGenerations: 0,
    });

    const summary: GenerationSummary = {
      totalImages: 0,
      totalVideos: 0,
      totalCollections: 0,
      sentToDVR: 0,
      errors: [],
      duration: 0,
    };

    try {
      // ========== TOUT EN // : PRIMAIRES + VARIANTES ==========
      const totalImageTasks = primaryImageTasks.length + Array.from(variantImageTasks.values()).flat().length;
      setProgress(prev => ({ ...prev, currentPhase: 'primary_images' }));
      toast.info(`🚀 TOUT EN // : ${totalImageTasks} images lancées SIMULTANÉMENT`);
      console.log(`[ParallelGen] TOUT EN // : ${primaryImageTasks.length} primaires + variantes`);

      // Lancer TOUTES les primaires, chacune lance ses variantes immédiatement
      const allImagePromises = primaryImageTasks.map(async (task) => {
        if (abortRef.current) return { task, success: false };

        updateStep(task.stepId, { status: 'generating' });

        const success = await generateImageT2I(task.nodeId, task.prompt, task.aspectRatio);

        if (success) {
          updateStep(task.stepId, { status: 'done' });
          summary.totalImages++;
          incrementCompletedSteps();

          // IMMÉDIATEMENT lancer les variantes EN PARALLÈLE
          const variants = variantImageTasks.get(task.nodeId);
          if (variants && variants.length > 0) {
            const referenceUrl = generatedImagesRef.current.get(task.nodeId);
            if (referenceUrl) {
              console.log(`[ParallelGen] 🚀 ${variants.length} variantes pour ${task.nodeId} lancées EN //`);
              
              const variantPromises = variants.map(async (variant) => {
                if (abortRef.current) return false;

                updateStep(variant.stepId, { status: 'generating' });

                const variantSuccess = await generateImageEdit(
                  variant.nodeId,
                  variant.prompt,
                  variant.aspectRatio,
                  referenceUrl
                );

                if (variantSuccess) {
                  updateStep(variant.stepId, { status: 'done' });
                  summary.totalImages++;
                  incrementCompletedSteps();
                } else {
                  updateStep(variant.stepId, { status: 'error', error: 'Échec génération' });
                  summary.errors.push(`Variante ${variant.nodeId}`);
                  incrementCompletedSteps();
                }

                return variantSuccess;
              });

              await Promise.all(variantPromises);
            }
          }
        } else {
          updateStep(task.stepId, { status: 'error', error: 'Échec génération' });
          summary.errors.push(`Primaire ${task.nodeId}`);
          incrementCompletedSteps();
        }

        return { task, success };
      });

      // Attendre que TOUT soit terminé
      await Promise.all(allImagePromises);

      if (abortRef.current) throw new Error('Génération annulée');

      // ========== PHASE 2 : COLLECTIONS ==========
      setProgress(prev => ({ ...prev, currentPhase: 'collections' }));
      toast.info('📁 Création des collections...');

      for (const step of steps.filter(s => s.type === 'collection')) {
        if (abortRef.current) break;

        updateStep(step.id, { status: 'generating' });
        
        const success = await populateCollection(step.nodeId, step.collectionSourceIds || []);

        if (success) {
          updateStep(step.id, { status: 'done' });
          summary.totalCollections++;
        } else {
          updateStep(step.id, { status: 'error', error: 'Collection vide' });
        }
        incrementCompletedSteps();
      }

      // ========== PHASE 3 : TOUTES LES VIDÉOS EN PARALLÈLE ==========
      const videoSteps = steps.filter(s => s.type === 'video');
      if (videoSteps.length > 0) {
        setProgress(prev => ({ ...prev, currentPhase: 'videos' }));
        toast.info(`🎬 Lancement de ${videoSteps.length} vidéos EN PARALLÈLE...`);
        console.log(`[ParallelGen] Phase 3: ${videoSteps.length} vidéos EN PARALLÈLE`);

        // Lancer TOUTES les vidéos SIMULTANÉMENT
        const videoPromises = videoSteps.map(async (step) => {
          if (abortRef.current) return false;

          updateStep(step.id, { status: 'generating' });

          const success = await generateVideo(step.nodeId, step.videoInfo?.prompt || '');

          if (success) {
            updateStep(step.id, { status: 'done' });
            summary.totalVideos++;

            // Envoyer à DVR si activé
            if (sendToDVRAfter) {
              const dvrStepId = `dvr-${step.nodeId}`;
              updateStep(dvrStepId, { status: 'generating' });

              const dvrSuccess = await sendToDVR(step.nodeId);

              if (dvrSuccess) {
                updateStep(dvrStepId, { status: 'done' });
                summary.sentToDVR++;
              } else {
                updateStep(dvrStepId, { status: 'error', error: 'Échec DVR' });
              }
            }
          } else {
            updateStep(step.id, { status: 'error', error: 'Échec génération' });
            summary.errors.push(`Vidéo ${step.nodeId}`);
          }

          incrementCompletedSteps();
          return success;
        });

        await Promise.all(videoPromises);
      }

      // ========== TERMINÉ ==========
      summary.duration = Date.now() - startTimeRef.current;
      
      setProgress(prev => ({ ...prev, currentPhase: 'done', isGenerating: false, activeGenerations: 0 }));

      // Toast de résumé
      const toastMessage = `
🎉 Génération PARALLÈLE terminée !

📊 Résumé :
• ${summary.totalImages} images générées
• ${summary.totalCollections} collections créées
• ${summary.totalVideos} vidéos générées
• ${summary.sentToDVR} envoyées à DVR
• ${summary.errors.length} erreurs
• Durée : ${Math.round(summary.duration / 1000)}s
      `.trim();

      toast.success(toastMessage, { duration: 10000 });

      onComplete?.(summary);
    } catch (error: any) {
      console.error('Erreur génération parallèle:', error);
      setProgress(prev => ({ ...prev, isGenerating: false, activeGenerations: 0 }));
      
      // Afficher l'erreur complète avec durée de 1 minute
      toast.error('❌ Erreur génération', {
        description: error.message,
        duration: 60_000,
        closeButton: true,
      });
      
      onError?.(error.message);
    }
  }, [progress.isGenerating, getNodes, updateNodeData, videoCopies, imageModel, videoModel, onComplete, onError]);

  // ========== ANNULER ==========
  const cancelGeneration = useCallback(() => {
    abortRef.current = true;
    setProgress(prev => ({ ...prev, isGenerating: false, activeGenerations: 0 }));
    toast.warning('Génération annulée');
  }, []);

  return {
    progress,
    startGeneration,
    cancelGeneration,
  };
}
