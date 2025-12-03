'use client';

/**
 * Panneau de génération séquentielle des médias
 * 
 * Affiché dans le canvas après génération d'un projet depuis un brief.
 * Permet de :
 * - Lancer la génération automatique des images et vidéos
 * - Voir la progression en temps réel
 * - Annuler la génération
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
  PauseIcon,
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
  updateLocalProject, 
  type GenerationSequence 
} from '@/lib/local-projects-store';

interface GenerationStep {
  id: string;
  type: 'image' | 'video' | 'collection' | 'dvr';
  status: 'pending' | 'generating' | 'done' | 'error';
  nodeId: string;
  label: string;
  error?: string;
  // Infos supplémentaires pour le retry
  videoInfo?: {
    prompt: string;
    characterCollectionIds: string[];
    locationCollectionId?: string;
  };
  collectionSourceIds?: string[]; // Pour les collections
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
    } else {
      console.log('[GenerationPanel] No generation sequence found');
    }
  }, [projectId]);

  // Calculer les stats
  const stats = sequence ? {
    totalImages: 
      sequence.characterImages.reduce((acc, c) => acc + c.imageNodeIds.length, 0) +
      sequence.locationImages.reduce((acc, l) => acc + l.imageNodeIds.length, 0),
    totalCollections: sequence.characterCollections.length + sequence.locationCollections.length,
    totalVideos: sequence.videos.length,
  } : { totalImages: 0, totalCollections: 0, totalVideos: 0 };

  const totalSteps = stats.totalImages + stats.totalCollections + stats.totalVideos + (sendToDVR ? stats.totalVideos : 0);
  const progress = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;

  // ========== UTILITAIRES ==========
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const waitForNodeRender = async (nodeId: string, timeout = 60000): Promise<boolean> => {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (aborted) return false;
      
      const nodes = getNodes();
      const node = nodes.find(n => n.id === nodeId);
      
      if (node?.data?.generated?.url || node?.data?.url) {
        return true;
      }
      
      await delay(1000);
    }
    
    return false;
  };

  const updateStep = (stepId: string, updates: Partial<GenerationStep>) => {
    setSteps(prev => prev.map(s => s.id === stepId ? { ...s, ...updates } : s));
  };

  // ========== GÉNÉRATION ==========
  const generateImage = async (nodeId: string): Promise<boolean> => {
    try {
      const nodes = getNodes();
      const node = nodes.find(n => n.id === nodeId);
      const prompt = node?.data?.instructions || node?.data?.label || '';

      console.log(`[GenerationPanel] Génération image pour ${nodeId} avec prompt: ${prompt.substring(0, 50)}...`);

      // Déclencher la génération via l'API
      const response = await fetch('/api/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId,
          prompt,
          model: 'nano-banana-pro-wavespeed',
          projectId: projectId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[GenerationPanel] Erreur API image:', errorText);
        return false;
      }

      const result = await response.json();
      console.log('[GenerationPanel] Résultat génération image:', result);

      // Mettre à jour le nœud avec l'URL générée
      if (result.nodeData?.generated?.url) {
        updateNodeData(nodeId, {
          generated: result.nodeData.generated,
          url: result.nodeData.generated.url,
        });
        console.log(`[GenerationPanel] Nœud ${nodeId} mis à jour avec URL: ${result.nodeData.generated.url}`);
        return true;
      }

      // Si nodeData contient directement l'URL
      if (result.nodeData?.url) {
        updateNodeData(nodeId, {
          url: result.nodeData.url,
          generated: { url: result.nodeData.url, type: 'image/png' },
        });
        return true;
      }

      console.warn('[GenerationPanel] Pas d\'URL dans le résultat:', result);
      return false;
    } catch (error) {
      console.error('Erreur génération image:', error);
      return false;
    }
  };

  const generateVideo = async (nodeId: string, videoInfo?: { 
    prompt: string; 
    characterCollectionIds: string[]; 
    locationCollectionId?: string; 
  }): Promise<boolean> => {
    try {
      const nodes = getNodes();
      const node = nodes.find(n => n.id === nodeId);
      
      // Utiliser le prompt de la séquence ou celui du nœud
      const prompt = videoInfo?.prompt || node?.data?.instructions || node?.data?.label || '';

      console.log(`[GenerationPanel] Génération vidéo pour ${nodeId}`);
      console.log(`[GenerationPanel] Prompt: ${prompt.substring(0, 100)}...`);

      // Récupérer les images des collections référencées
      const images: { url: string; type: string }[] = [];
      
      // Images des personnages
      if (videoInfo?.characterCollectionIds) {
        for (const collectionId of videoInfo.characterCollectionIds) {
          const collectionNode = nodes.find(n => n.id === collectionId);
          if (collectionNode?.data?.items) {
            for (const item of collectionNode.data.items) {
              if (item.enabled && item.url) {
                images.push({ url: item.url, type: item.type || 'image/png' });
                console.log(`[GenerationPanel] Image perso ajoutée: ${item.url.substring(0, 50)}...`);
              }
            }
          }
        }
      }

      // Image du lieu
      if (videoInfo?.locationCollectionId) {
        const locCollectionNode = nodes.find(n => n.id === videoInfo.locationCollectionId);
        if (locCollectionNode?.data?.items) {
          // Prendre la première image activée du lieu
          const enabledItem = locCollectionNode.data.items.find((item: any) => item.enabled && item.url);
          if (enabledItem) {
            images.push({ url: enabledItem.url, type: enabledItem.type || 'image/png' });
            console.log(`[GenerationPanel] Image lieu ajoutée: ${enabledItem.url.substring(0, 50)}...`);
          }
        }
      }

      console.log(`[GenerationPanel] ${images.length} images à envoyer pour la vidéo`);

      // CHAQUE NŒUD = 1 VIDÉO (plus de copies multiples ici)
      const response = await fetch('/api/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId,
          prompt,
          model: 'kling-o1-i2v',
          copies: 1, // 1 seule vidéo par nœud (les copies sont des nœuds distincts)
          projectId: projectId,
          images, // Passer les images des collections
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[GenerationPanel] Erreur API vidéo:', errorText);
        return false;
      }

      const result = await response.json();
      console.log('[GenerationPanel] Résultat génération vidéo:', result);

      // Mettre à jour le nœud avec l'URL générée
      if (result.results && result.results.length > 0) {
        const firstSuccess = result.results.find((r: any) => r.success && r.nodeData?.generated?.url);
        if (firstSuccess) {
          updateNodeData(nodeId, {
            generated: firstSuccess.nodeData.generated,
            url: firstSuccess.nodeData.generated.url,
          });
          return true;
        }
      }

      console.warn('[GenerationPanel] Pas de vidéo réussie dans le résultat');
      return false;
    } catch (error) {
      console.error('Erreur génération vidéo:', error);
      return false;
    }
  };

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

      // Même si vide, on considère que c'est OK (images pas encore générées)
      return true;
    } catch (error) {
      console.error('Erreur population collection:', error);
      return false;
    }
  };

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
    
    // Mettre à jour le statut
    updateStep(step.id, { status: 'generating', error: undefined });

    let success = false;

    try {
      switch (step.type) {
        case 'image':
          success = await generateImage(step.nodeId);
          break;

        case 'video':
          // Mettre le nœud en état de génération pour afficher le spinner
          const startTime = Date.now();
          updateNodeData(step.nodeId, { 
            generating: true,
            generatingStartTime: startTime,
          });

          // Utiliser l'API batch même pour un seul retry
          const nodes = getNodes();
          const images: { url: string; type: string }[] = [];
          
          // Collecter les images des collections
          if (step.videoInfo?.characterCollectionIds) {
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
          }
          if (step.videoInfo?.locationCollectionId) {
            const locNode = nodes.find(n => n.id === step.videoInfo!.locationCollectionId);
            if (locNode?.data?.items) {
              const enabledItem = locNode.data.items.find((item: any) => item.enabled && item.url);
              if (enabledItem) {
                images.push({ url: enabledItem.url, type: enabledItem.type || 'image/png' });
              }
            }
          }

          try {
            const response = await fetch('/api/batch-generate-video', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                jobs: [{
                  nodeId: step.nodeId,
                  modelId: 'kling-o1-i2v',
                  prompt: step.videoInfo?.prompt || '',
                  images,
                }],
                projectId,
              }),
            });

            if (response.ok) {
              const result = await response.json();
              const videoResult = result.results?.[0];
              if (videoResult?.success && videoResult?.videoUrl) {
                updateNodeData(step.nodeId, {
                  generated: { url: videoResult.videoUrl, type: 'video/mp4' },
                  generating: false,
                  generatingStartTime: undefined,
                });
                success = true;
              }
            }
          } finally {
            if (!success) {
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
        toast.success(`${step.type === 'video' ? 'Vidéo' : step.type === 'image' ? 'Image' : 'Étape'} régénérée !`);
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

  // ========== LANCEMENT ==========
  const startGeneration = useCallback(async () => {
    if (!sequence || isGenerating) return;

    setAborted(false);
    setIsGenerating(true);
    setCurrentStep(0);

    // Préparer les étapes
    const allSteps: GenerationStep[] = [];

    // Images personnages
    for (const { characterId, imageNodeIds } of sequence.characterImages) {
      for (const nodeId of imageNodeIds) {
        allSteps.push({
          id: `img-${nodeId}`,
          type: 'image',
          status: 'pending',
          nodeId,
          label: `Image perso`,
        });
      }
    }

    // Collections personnages
    for (const [charId, collectionId] of sequence.characterCollections) {
      // Trouver les IDs des images sources
      const charData = sequence.characterImages.find(c => c.characterId === charId);
      allSteps.push({
        id: `coll-${collectionId}`,
        type: 'collection',
        status: 'pending',
        nodeId: collectionId,
        label: `Collection perso`,
        collectionSourceIds: charData?.imageNodeIds || [],
      });
    }

    // Images lieux
    for (const { locationId, imageNodeIds } of sequence.locationImages) {
      for (const nodeId of imageNodeIds) {
        allSteps.push({
          id: `img-${nodeId}`,
          type: 'image',
          status: 'pending',
          nodeId,
          label: `Image lieu`,
        });
      }
    }

    // Collections lieux
    for (const [locId, collectionId] of sequence.locationCollections) {
      // Trouver les IDs des images sources
      const locData = sequence.locationImages.find(l => l.locationId === locId);
      allSteps.push({
        id: `coll-${collectionId}`,
        type: 'collection',
        status: 'pending',
        nodeId: collectionId,
        label: `Collection lieu`,
        collectionSourceIds: locData?.imageNodeIds || [],
      });
    }

    // Vidéos (CHAQUE COPIE est un nœud distinct)
    for (const videoData of sequence.videos) {
      // videoNodeIds est maintenant un tableau (1 nœud par copie)
      const videoNodeIds = videoData.videoNodeIds || [videoData.videoNodeId].filter(Boolean);
      
      // Préparer les infos pour retry
      const videoInfo = {
        prompt: videoData.prompt || '',
        characterCollectionIds: videoData.characterCollectionIds || [],
        locationCollectionId: videoData.locationCollectionId,
      };
      
      for (let copyIdx = 0; copyIdx < videoNodeIds.length; copyIdx++) {
        const videoNodeId = videoNodeIds[copyIdx];
        allSteps.push({
          id: `video-${videoNodeId}`,
          type: 'video',
          status: 'pending',
          nodeId: videoNodeId,
          label: `Vidéo ${videoData.planId?.split('-')[0] || 'plan'} - Copie ${copyIdx + 1}`,
          videoInfo, // Pour le retry
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
      // ========== PHASE 1 : Images personnages ==========
      setCurrentPhase('🖼️ Images personnages');
      toast.info('Génération des images de personnages...');

      for (const { characterId, imageNodeIds } of sequence.characterImages) {
        if (aborted) break;

        for (const nodeId of imageNodeIds) {
          if (aborted) break;

          const stepId = `img-${nodeId}`;
          updateStep(stepId, { status: 'generating' });
          setCurrentStep(++stepIdx);

          const success = await generateImage(nodeId);
          
          updateStep(stepId, { status: success ? 'done' : 'error' });
          if (success) successCount++;
          else errorCount++;

          await delay(300);
        }
      }

      // ========== PHASE 2 : Collections personnages ==========
      if (!aborted) {
        setCurrentPhase('📁 Collections personnages');
        toast.info('Création des collections personnages...');

        for (const [charId, collectionId] of sequence.characterCollections) {
          if (aborted) break;

          const stepId = `coll-${collectionId}`;
          updateStep(stepId, { status: 'generating' });
          setCurrentStep(++stepIdx);

          const imageNodeIds = sequence.characterImages.find(c => c.characterId === charId)?.imageNodeIds || [];
          const success = await populateCollection(collectionId, imageNodeIds);

          updateStep(stepId, { status: success ? 'done' : 'error' });
          if (success) successCount++;
          else errorCount++;
        }
      }

      // ========== PHASE 3 : Images lieux ==========
      if (!aborted) {
        setCurrentPhase('🏠 Images lieux');
        toast.info('Génération des images de lieux...');

        for (const { locationId, imageNodeIds } of sequence.locationImages) {
          if (aborted) break;

          for (const nodeId of imageNodeIds) {
            if (aborted) break;

            const stepId = `img-${nodeId}`;
            updateStep(stepId, { status: 'generating' });
            setCurrentStep(++stepIdx);

            const success = await generateImage(nodeId);
            
            updateStep(stepId, { status: success ? 'done' : 'error' });
            if (success) successCount++;
            else errorCount++;

            await delay(300);
          }
        }
      }

      // ========== PHASE 4 : Collections lieux ==========
      if (!aborted) {
        setCurrentPhase('📁 Collections lieux');
        toast.info('Création des collections lieux...');

        for (const [locId, collectionId] of sequence.locationCollections) {
          if (aborted) break;

          const stepId = `coll-${collectionId}`;
          updateStep(stepId, { status: 'generating' });
          setCurrentStep(++stepIdx);

          const imageNodeIds = sequence.locationImages.find(l => l.locationId === locId)?.imageNodeIds || [];
          const success = await populateCollection(collectionId, imageNodeIds);

          updateStep(stepId, { status: success ? 'done' : 'error' });
          if (success) successCount++;
          else errorCount++;
        }
      }

      // ========== PHASE 5 : Vidéos EN PARALLÈLE ==========
      if (!aborted) {
        setCurrentPhase('🎬 Vidéos (parallèle)');
        
        // Collecter TOUS les jobs vidéo
        const videoJobs: { 
          nodeId: string; 
          stepId: string;
          prompt: string; 
          images: { url: string; type: string }[];
        }[] = [];

        const nodes = getNodes();

        for (const videoData of sequence.videos) {
          const { prompt, characterCollectionIds, locationCollectionId } = videoData;
          const videoNodeIds = videoData.videoNodeIds || [videoData.videoNodeId].filter(Boolean);
          
          // Collecter les images des collections pour ce plan
          const images: { url: string; type: string }[] = [];
          
          // Images des personnages
          if (characterCollectionIds) {
            for (const collectionId of characterCollectionIds) {
              const collectionNode = nodes.find(n => n.id === collectionId);
              if (collectionNode?.data?.items) {
                for (const item of collectionNode.data.items) {
                  if (item.enabled && item.url) {
                    images.push({ url: item.url, type: item.type || 'image/png' });
                  }
                }
              }
            }
          }

          // Image du lieu
          if (locationCollectionId) {
            const locCollectionNode = nodes.find(n => n.id === locationCollectionId);
            if (locCollectionNode?.data?.items) {
              const enabledItem = locCollectionNode.data.items.find((item: any) => item.enabled && item.url);
              if (enabledItem) {
                images.push({ url: enabledItem.url, type: enabledItem.type || 'image/png' });
              }
            }
          }

          // Ajouter chaque nœud vidéo comme job
          for (const videoNodeId of videoNodeIds) {
            videoJobs.push({
              nodeId: videoNodeId,
              stepId: `video-${videoNodeId}`,
              prompt: prompt || '',
              images,
            });
          }
        }

        if (videoJobs.length > 0) {
          toast.info(`🎬 Lancement de ${videoJobs.length} vidéo${videoJobs.length > 1 ? 's' : ''} en parallèle...`);

          // Mettre TOUS les nœuds vidéo en état "generating" MAINTENANT
          const startTime = Date.now();
          for (const job of videoJobs) {
            updateStep(job.stepId, { status: 'generating' });
            updateNodeData(job.nodeId, { 
              generating: true,
              generatingStartTime: startTime,
            });
          }
          setCurrentStep(stepIdx + videoJobs.length);

          // Appeler l'API batch pour générer en PARALLÈLE
          try {
            const batchJobs = videoJobs.map(job => ({
              nodeId: job.nodeId,
              modelId: 'kling-o1-i2v',
              prompt: job.prompt,
              images: job.images,
            }));

            console.log(`[GenerationPanel] Envoi de ${batchJobs.length} jobs vidéo en parallèle`);

            const response = await fetch('/api/batch-generate-video', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ jobs: batchJobs, projectId }),
            });

            if (!response.ok) {
              throw new Error(`Batch API error: ${response.status}`);
            }

            const batchResult = await response.json();
            console.log(`[GenerationPanel] Résultats batch:`, batchResult);

            // Mettre à jour chaque nœud avec son résultat
            for (const result of batchResult.results || []) {
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

          } catch (error: any) {
            console.error('[GenerationPanel] Erreur batch vidéo:', error);
            
            // Marquer tous les jobs comme erreur
            for (const job of videoJobs) {
              updateNodeData(job.nodeId, {
                generating: false,
                generatingStartTime: undefined,
              });
              updateStep(job.stepId, { status: 'error', error: error.message });
              errorCount++;
            }
          }
        }
      }

      // ========== TERMINÉ ==========
      setCurrentPhase('✅ Terminé');
      
      const toastContent = `
🎉 Génération terminée !

✅ ${successCount} succès
${errorCount > 0 ? `❌ ${errorCount} erreurs` : ''}
      `.trim();

      toast.success(toastContent, { duration: 10000 });

    } catch (error: any) {
      console.error('Erreur génération:', error);
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  }, [sequence, isGenerating, aborted, sendToDVR, videoCopies, getNodes, updateNodeData]);

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
      case 'image': return <ImageIcon size={14} className="text-muted-foreground" />;
      case 'video': return <VideoIcon size={14} className="text-muted-foreground" />;
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
            Génère automatiquement tous les médias du projet
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

            <div className="flex items-center gap-3 rounded-lg bg-muted/20 p-3">
              <label className="text-sm font-medium">Copies par vidéo :</label>
              <select
                value={videoCopies}
                onChange={(e) => setVideoCopies(parseInt(e.target.value))}
                disabled={isGenerating}
                className="rounded-md bg-background border border-border px-2 py-1 text-sm"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={4}>4</option>
                <option value={8}>8</option>
              </select>
            </div>
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
          
          {/* Spacer pour éviter que le contenu colle au bas */}
          <div className="h-4" />
        </div>
      </SheetContent>
    </Sheet>
  );
}

