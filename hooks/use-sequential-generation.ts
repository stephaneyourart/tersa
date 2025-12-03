/**
 * Hook pour la génération séquentielle des médias dans le canvas
 * 
 * Séquence :
 * 1. Générer les images de personnages (4 par perso)
 * 2. Attendre que toutes soient rendues
 * 3. Populer les collections personnages
 * 4. Générer les images de lieux (3 par lieu)
 * 5. Attendre que toutes soient rendues
 * 6. Populer les collections lieux
 * 7. Générer les vidéos (avec collections en input)
 * 8. Envoyer à DVR
 */

import { useState, useCallback, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { Node } from '@xyflow/react';
import { toast } from 'sonner';

export interface GenerationStep {
  id: string;
  type: 'image' | 'video' | 'collection' | 'dvr';
  status: 'pending' | 'generating' | 'done' | 'error';
  nodeId: string;
  label: string;
  error?: string;
}

export interface GenerationProgress {
  currentStep: number;
  totalSteps: number;
  currentPhase: 'images_perso' | 'collections_perso' | 'images_lieu' | 'collections_lieu' | 'videos' | 'dvr' | 'done';
  steps: GenerationStep[];
  isGenerating: boolean;
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
    imageModel = 'nanobanana-pro',
    videoModel = 'kling-o1',
  } = options;

  const { getNodes, setNodes, updateNodeData } = useReactFlow();
  const [progress, setProgress] = useState<GenerationProgress>({
    currentStep: 0,
    totalSteps: 0,
    currentPhase: 'images_perso',
    steps: [],
    isGenerating: false,
  });
  
  const abortRef = useRef(false);
  const startTimeRef = useRef<number>(0);

  // ========== UTILITAIRES ==========
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const waitForNodeRender = async (nodeId: string, timeout = 30000): Promise<boolean> => {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (abortRef.current) return false;
      
      const nodes = getNodes();
      const node = nodes.find(n => n.id === nodeId);
      
      // Vérifier si le nœud a une URL générée
      if (node?.data?.generated?.url || node?.data?.url) {
        return true;
      }
      
      await delay(500);
    }
    
    return false;
  };

  const updateStep = (stepId: string, updates: Partial<GenerationStep>) => {
    setProgress(prev => ({
      ...prev,
      steps: prev.steps.map(s => s.id === stepId ? { ...s, ...updates } : s),
    }));
  };

  // ========== GÉNÉRATION D'IMAGE ==========
  const generateImage = async (nodeId: string, prompt: string): Promise<boolean> => {
    try {
      // Appeler l'API de génération d'image
      const response = await fetch('/api/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId,
          prompt,
          model: imageModel,
        }),
      });

      if (!response.ok) {
        console.error('Erreur génération image:', await response.text());
        return false;
      }

      // Attendre que l'image soit rendue dans le nœud
      return await waitForNodeRender(nodeId);
    } catch (error) {
      console.error('Erreur génération image:', error);
      return false;
    }
  };

  // ========== GÉNÉRATION DE VIDÉO ==========
  const generateVideo = async (nodeId: string, prompt: string, copies: number): Promise<boolean> => {
    try {
      // Appeler l'API de génération de vidéo
      const response = await fetch('/api/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId,
          prompt,
          model: videoModel,
          copies,
        }),
      });

      if (!response.ok) {
        console.error('Erreur génération vidéo:', await response.text());
        return false;
      }

      // Attendre que la vidéo soit rendue
      return await waitForNodeRender(nodeId, 120000); // 2 minutes pour les vidéos
    } catch (error) {
      console.error('Erreur génération vidéo:', error);
      return false;
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
        if (sourceNode?.data?.generated?.url || sourceNode?.data?.url) {
          items.push({
            id: sourceId,
            type: 'image',
            enabled: true,
            url: sourceNode.data.generated?.url || sourceNode.data.url,
            width: sourceNode.data.generated?.width || sourceNode.width,
            height: sourceNode.data.generated?.height || sourceNode.height,
            name: sourceNode.data.label || 'Image',
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

  // ========== GÉNÉRATION SÉQUENTIELLE PRINCIPALE ==========
  const startGeneration = useCallback(async (
    characterImageNodes: { characterId: string; imageNodeIds: string[] }[],
    locationImageNodes: { locationId: string; imageNodeIds: string[] }[],
    characterCollections: [string, string][],
    locationCollections: [string, string][],
    videoNodes: { planId: string; videoNodeId: string }[],
    sendToDVRAfter: boolean = false
  ) => {
    if (progress.isGenerating) {
      toast.error('Une génération est déjà en cours');
      return;
    }

    abortRef.current = false;
    startTimeRef.current = Date.now();

    // Préparer les étapes
    const steps: GenerationStep[] = [];
    
    // Images personnages
    for (const { characterId, imageNodeIds } of characterImageNodes) {
      for (const nodeId of imageNodeIds) {
        steps.push({
          id: `img-${nodeId}`,
          type: 'image',
          status: 'pending',
          nodeId,
          label: `Image ${characterId}`,
        });
      }
    }

    // Collections personnages
    for (const [charId, collectionId] of characterCollections) {
      steps.push({
        id: `coll-${collectionId}`,
        type: 'collection',
        status: 'pending',
        nodeId: collectionId,
        label: `Collection ${charId}`,
      });
    }

    // Images lieux
    for (const { locationId, imageNodeIds } of locationImageNodes) {
      for (const nodeId of imageNodeIds) {
        steps.push({
          id: `img-${nodeId}`,
          type: 'image',
          status: 'pending',
          nodeId,
          label: `Image ${locationId}`,
        });
      }
    }

    // Collections lieux
    for (const [locId, collectionId] of locationCollections) {
      steps.push({
        id: `coll-${collectionId}`,
        type: 'collection',
        status: 'pending',
        nodeId: collectionId,
        label: `Collection ${locId}`,
      });
    }

    // Vidéos
    for (const { planId, videoNodeId } of videoNodes) {
      steps.push({
        id: `video-${videoNodeId}`,
        type: 'video',
        status: 'pending',
        nodeId: videoNodeId,
        label: `Vidéo ${planId}`,
      });

      if (sendToDVRAfter) {
        steps.push({
          id: `dvr-${videoNodeId}`,
          type: 'dvr',
          status: 'pending',
          nodeId: videoNodeId,
          label: `DVR ${planId}`,
        });
      }
    }

    setProgress({
      currentStep: 0,
      totalSteps: steps.length,
      currentPhase: 'images_perso',
      steps,
      isGenerating: true,
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
      let stepIndex = 0;

      // ========== PHASE 1 : Images personnages ==========
      setProgress(prev => ({ ...prev, currentPhase: 'images_perso' }));
      toast.info('🖼️ Génération des images de personnages...');

      for (const { characterId, imageNodeIds } of characterImageNodes) {
        if (abortRef.current) break;

        for (const nodeId of imageNodeIds) {
          if (abortRef.current) break;

          const stepId = `img-${nodeId}`;
          updateStep(stepId, { status: 'generating' });
          setProgress(prev => ({ ...prev, currentStep: stepIndex + 1 }));

          const nodes = getNodes();
          const node = nodes.find(n => n.id === nodeId);
          const prompt = node?.data?.instructions || '';

          const success = await generateImage(nodeId, prompt);
          
          if (success) {
            updateStep(stepId, { status: 'done' });
            summary.totalImages++;
          } else {
            updateStep(stepId, { status: 'error', error: 'Échec génération' });
            summary.errors.push(`Image ${nodeId}`);
          }

          stepIndex++;
          await delay(500); // Petit délai entre les générations
        }
      }

      // ========== PHASE 2 : Collections personnages ==========
      setProgress(prev => ({ ...prev, currentPhase: 'collections_perso' }));
      toast.info('📁 Création des collections personnages...');

      for (const [charId, collectionId] of characterCollections) {
        if (abortRef.current) break;

        const stepId = `coll-${collectionId}`;
        updateStep(stepId, { status: 'generating' });
        setProgress(prev => ({ ...prev, currentStep: stepIndex + 1 }));

        const imageNodeIds = characterImageNodes.find(c => c.characterId === charId)?.imageNodeIds || [];
        const success = await populateCollection(collectionId, imageNodeIds);

        if (success) {
          updateStep(stepId, { status: 'done' });
          summary.totalCollections++;
        } else {
          updateStep(stepId, { status: 'error', error: 'Collection vide' });
        }

        stepIndex++;
      }

      // ========== PHASE 3 : Images lieux ==========
      setProgress(prev => ({ ...prev, currentPhase: 'images_lieu' }));
      toast.info('🏠 Génération des images de lieux...');

      for (const { locationId, imageNodeIds } of locationImageNodes) {
        if (abortRef.current) break;

        for (const nodeId of imageNodeIds) {
          if (abortRef.current) break;

          const stepId = `img-${nodeId}`;
          updateStep(stepId, { status: 'generating' });
          setProgress(prev => ({ ...prev, currentStep: stepIndex + 1 }));

          const nodes = getNodes();
          const node = nodes.find(n => n.id === nodeId);
          const prompt = node?.data?.instructions || '';

          const success = await generateImage(nodeId, prompt);

          if (success) {
            updateStep(stepId, { status: 'done' });
            summary.totalImages++;
          } else {
            updateStep(stepId, { status: 'error', error: 'Échec génération' });
            summary.errors.push(`Image ${nodeId}`);
          }

          stepIndex++;
          await delay(500);
        }
      }

      // ========== PHASE 4 : Collections lieux ==========
      setProgress(prev => ({ ...prev, currentPhase: 'collections_lieu' }));
      toast.info('📁 Création des collections lieux...');

      for (const [locId, collectionId] of locationCollections) {
        if (abortRef.current) break;

        const stepId = `coll-${collectionId}`;
        updateStep(stepId, { status: 'generating' });
        setProgress(prev => ({ ...prev, currentStep: stepIndex + 1 }));

        const imageNodeIds = locationImageNodes.find(l => l.locationId === locId)?.imageNodeIds || [];
        const success = await populateCollection(collectionId, imageNodeIds);

        if (success) {
          updateStep(stepId, { status: 'done' });
          summary.totalCollections++;
        } else {
          updateStep(stepId, { status: 'error', error: 'Collection vide' });
        }

        stepIndex++;
      }

      // ========== PHASE 5 : Vidéos ==========
      setProgress(prev => ({ ...prev, currentPhase: 'videos' }));
      toast.info('🎬 Génération des vidéos...');

      for (const { planId, videoNodeId } of videoNodes) {
        if (abortRef.current) break;

        const stepId = `video-${videoNodeId}`;
        updateStep(stepId, { status: 'generating' });
        setProgress(prev => ({ ...prev, currentStep: stepIndex + 1 }));

        const nodes = getNodes();
        const node = nodes.find(n => n.id === videoNodeId);
        const prompt = node?.data?.instructions || '';

        const success = await generateVideo(videoNodeId, prompt, videoCopies);

        if (success) {
          updateStep(stepId, { status: 'done' });
          summary.totalVideos++;
        } else {
          updateStep(stepId, { status: 'error', error: 'Échec génération' });
          summary.errors.push(`Vidéo ${planId}`);
        }

        stepIndex++;

        // ========== PHASE 6 : DVR (si activé) ==========
        if (sendToDVRAfter && !abortRef.current) {
          setProgress(prev => ({ ...prev, currentPhase: 'dvr' }));

          const dvrStepId = `dvr-${videoNodeId}`;
          updateStep(dvrStepId, { status: 'generating' });
          setProgress(prev => ({ ...prev, currentStep: stepIndex + 1 }));

          const dvrSuccess = await sendToDVR(videoNodeId);

          if (dvrSuccess) {
            updateStep(dvrStepId, { status: 'done' });
            summary.sentToDVR++;
          } else {
            updateStep(dvrStepId, { status: 'error', error: 'Échec DVR' });
          }

          stepIndex++;
        }
      }

      // ========== TERMINÉ ==========
      summary.duration = Date.now() - startTimeRef.current;
      
      setProgress(prev => ({ ...prev, currentPhase: 'done', isGenerating: false }));

      // Toast de résumé
      const toastMessage = `
🎉 Génération terminée !

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
      console.error('Erreur génération séquentielle:', error);
      setProgress(prev => ({ ...prev, isGenerating: false }));
      toast.error(`Erreur: ${error.message}`);
      onError?.(error.message);
    }
  }, [progress.isGenerating, getNodes, updateNodeData, videoCopies, imageModel, videoModel, onComplete, onError]);

  // ========== ANNULER ==========
  const cancelGeneration = useCallback(() => {
    abortRef.current = true;
    setProgress(prev => ({ ...prev, isGenerating: false }));
    toast.warning('Génération annulée');
  }, []);

  return {
    progress,
    startGeneration,
    cancelGeneration,
  };
}

