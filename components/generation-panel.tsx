'use client';

/**
 * Panneau de génération UNIVERSEL
 * 
 * LOGIQUE :
 * 1. Scanner TOUS les nœuds du canvas
 * 2. Construire un ARBRE de dépendances basé sur les edges
 * 3. Un nœud est "générable" si :
 *    - Il est de type image ou video
 *    - Il a des connexions entrantes
 *    - Il n'a pas encore de contenu généré
 * 4. Un nœud est "PRÊT" si :
 *    - Il est générable
 *    - TOUS ses nœuds entrants ont du contenu média
 * 5. PARALLÉLISATION : Tous les nœuds prêts au même niveau sont lancés en parallèle
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useReactFlow, getIncomers, type Node, type Edge } from '@xyflow/react';
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
  ChevronRightIcon,
  CircleDotIcon,
  ClockIcon,
  SendIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useMediaLibraryStore } from '@/lib/media-library-store';

// ========== TYPES ==========
interface GeneratableNode {
  id: string;
  type: 'image' | 'video';
  label: string;
  status: 'waiting' | 'ready' | 'generating' | 'done' | 'error';
  error?: string;
  depth: number; // Niveau dans l'arbre de dépendances
  incomingNodeIds: string[]; // IDs des nœuds entrants
  hasContent: boolean;
  nodeData: Record<string, unknown>;
}

interface GenerationPanelProps {
  projectId: string;
}

// ========== HELPERS ==========

// Vérifier si un nœud a du contenu média
function nodeHasMediaContent(node: Node): boolean {
  const data = node.data as Record<string, unknown>;
  
  // Image
  if (node.type === 'image') {
    const generated = data.generated as { url?: string } | undefined;
    const content = data.content as { url?: string } | undefined;
    return Boolean(generated?.url || content?.url || data.url);
  }
  
  // Video
  if (node.type === 'video') {
    const generated = data.generated as { url?: string } | undefined;
    const content = data.content as { url?: string } | undefined;
    return Boolean(generated?.url || content?.url || data.url);
  }
  
  // Text - a du contenu si generated.text ou content existe
  if (node.type === 'text') {
    const generated = data.generated as { text?: string } | undefined;
    return Boolean(generated?.text || data.content || data.text);
  }
  
  // Collection - a du contenu si items non vide avec au moins une URL
  if (node.type === 'collection') {
    const items = data.items as Array<{ url?: string; enabled?: boolean }> | undefined;
    return Boolean(items && items.length > 0 && items.some(item => item.url && item.enabled !== false));
  }
  
  // Audio
  if (node.type === 'audio') {
    const generated = data.generated as { url?: string } | undefined;
    const content = data.content as { url?: string } | undefined;
    return Boolean(generated?.url || content?.url);
  }
  
  return false;
}

// Vérifier si un nœud est de type générable (image ou video)
function isGeneratableType(node: Node): boolean {
  return node.type === 'image' || node.type === 'video';
}

// Obtenir le label d'un nœud
function getNodeLabel(node: Node): string {
  const data = node.data as Record<string, unknown>;
  return (data.label as string) || (data.name as string) || `${node.type} ${node.id.slice(-4)}`;
}

// Récupérer les images depuis les nœuds entrants (récursif pour collections)
function getImagesFromIncomers(incomers: Node[]): { url: string; type: string; originalUrl?: string }[] {
  const images: { url: string; type: string; originalUrl?: string }[] = [];
  
  for (const node of incomers) {
    const data = node.data as Record<string, unknown>;
    
    if (node.type === 'image') {
      const generated = data.generated as { url?: string; originalUrl?: string } | undefined;
      const url = generated?.url || (data.url as string);
      if (url) {
        images.push({ url, type: 'image/png', originalUrl: generated?.originalUrl });
      }
    } else if (node.type === 'collection') {
      const items = data.items as Array<{ url?: string; enabled?: boolean; type?: string; originalUrl?: string }> | undefined;
      if (items) {
        for (const item of items) {
          if (item.enabled !== false && item.url) {
            images.push({ url: item.url, type: item.type || 'image/png', originalUrl: item.originalUrl });
          }
        }
      }
    }
  }
  
  return images;
}

// Récupérer le texte depuis les nœuds entrants
function getTextFromIncomers(incomers: Node[]): string {
  const texts: string[] = [];
  
  for (const node of incomers) {
    const data = node.data as Record<string, unknown>;
    
    if (node.type === 'text') {
      const generated = data.generated as { text?: string } | undefined;
      const text = generated?.text || (data.content as string) || (data.text as string);
      if (text) texts.push(text);
    }
  }
  
  return texts.join('\n\n');
}

// ========== COMPOSANT PRINCIPAL ==========
export function GenerationPanel({ projectId }: GenerationPanelProps) {
  const { getNodes, getEdges, updateNodeData } = useReactFlow();
  const { fetchMedias } = useMediaLibraryStore();
  
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aborted, setAborted] = useState(false);
  const [generatableNodes, setGeneratableNodes] = useState<GeneratableNode[]>([]);
  const [currentPhase, setCurrentPhase] = useState('');
  const [sendToDVR, setSendToDVR] = useState(false);

  // ========== ANALYSE DU CANVAS ==========
  const analyzeCanvas = useCallback(() => {
    const nodes = getNodes();
    const edges = getEdges();
    
    const result: GeneratableNode[] = [];
    const nodeDepths = new Map<string, number>();
    
    // Calculer la profondeur de chaque nœud (distance depuis les sources)
    const calculateDepth = (nodeId: string, visited = new Set<string>()): number => {
      if (visited.has(nodeId)) return 0;
      visited.add(nodeId);
      
      if (nodeDepths.has(nodeId)) return nodeDepths.get(nodeId)!;
      
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return 0;
      
      const incomers = getIncomers(node, nodes, edges);
      if (incomers.length === 0) {
        nodeDepths.set(nodeId, 0);
        return 0;
      }
      
      const maxIncomingDepth = Math.max(...incomers.map(inc => calculateDepth(inc.id, visited)));
      const depth = maxIncomingDepth + 1;
      nodeDepths.set(nodeId, depth);
      return depth;
    };
    
    // Scanner tous les nœuds
    for (const node of nodes) {
      // Ignorer les nœuds non générables
      if (!isGeneratableType(node)) continue;
      
      const incomers = getIncomers(node, nodes, edges);
      const hasContent = nodeHasMediaContent(node);
      
      // Un nœud DOIT avoir des connexions entrantes pour être générable
      if (incomers.length === 0) continue;
      
      // Calculer la profondeur
      const depth = calculateDepth(node.id);
      
      // Vérifier si tous les entrants ont du contenu
      const allIncomersHaveContent = incomers.every(inc => nodeHasMediaContent(inc));
      
      // Déterminer le statut
      let status: GeneratableNode['status'] = 'waiting';
      if (hasContent) {
        status = 'done';
      } else if (allIncomersHaveContent) {
        status = 'ready';
      }
      
      result.push({
        id: node.id,
        type: node.type as 'image' | 'video',
        label: getNodeLabel(node),
        status,
        depth,
        incomingNodeIds: incomers.map(inc => inc.id),
        hasContent,
        nodeData: node.data as Record<string, unknown>,
      });
    }
    
    // Trier par profondeur puis par type (images avant vidéos)
    result.sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth;
      if (a.type !== b.type) return a.type === 'image' ? -1 : 1;
      return 0;
    });
    
    return result;
  }, [getNodes, getEdges]);

  // Mettre à jour l'analyse quand le panel s'ouvre
  useEffect(() => {
    if (isOpen) {
      setGeneratableNodes(analyzeCanvas());
    }
  }, [isOpen, analyzeCanvas]);

  // Stats
  const stats = useMemo(() => {
    const images = generatableNodes.filter(n => n.type === 'image');
    const videos = generatableNodes.filter(n => n.type === 'video');
    
    return {
      totalImages: images.length,
      readyImages: images.filter(n => n.status === 'ready').length,
      doneImages: images.filter(n => n.status === 'done').length,
      totalVideos: videos.length,
      readyVideos: videos.filter(n => n.status === 'ready').length,
      doneVideos: videos.filter(n => n.status === 'done').length,
      totalReady: generatableNodes.filter(n => n.status === 'ready').length,
      totalDone: generatableNodes.filter(n => n.status === 'done').length,
    };
  }, [generatableNodes]);

  // ========== GÉNÉRATION IMAGE ==========
  const generateImage = async (nodeId: string): Promise<string | null> => {
    const nodes = getNodes();
    const edges = getEdges();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return null;
    
    const incomers = getIncomers(node, nodes, edges);
    const images = getImagesFromIncomers(incomers);
    const prompt = getTextFromIncomers(incomers) || (node.data as Record<string, unknown>).instructions as string || '';
    const aspectRatio = (node.data as Record<string, unknown>).aspectRatio as string || '1:1';
    
    console.log(`[GenerationPanel] Génération image ${nodeId}, ${images.length} images sources, prompt: ${prompt.slice(0, 50)}...`);
    
    try {
      // Si on a des images sources, utiliser edit, sinon text-to-image
      const endpoint = images.length > 0 ? '/api/image/edit' : '/api/image/generate';
      const body = images.length > 0 
        ? { nodeId, prompt, model: 'nano-banana-pro-edit-multi-wavespeed', projectId, sourceImages: images.map(i => i.url), aspectRatio }
        : { nodeId, prompt, model: 'nano-banana-pro-ultra-wavespeed', projectId, aspectRatio };
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        console.error(`[GenerationPanel] Erreur API image:`, await response.text());
        return null;
      }

      const result = await response.json();
      const imageUrl = result.nodeData?.generated?.url || result.nodeData?.url;
      
      if (imageUrl) {
        updateNodeData(nodeId, {
          generated: result.nodeData?.generated || { url: imageUrl, type: 'image/png' },
          url: imageUrl,
          generating: false,
          generatingStartTime: undefined,
        });
        return imageUrl;
      }

      return null;
    } catch (error) {
      console.error(`[GenerationPanel] Erreur génération image:`, error);
      return null;
    }
  };

  // ========== GÉNÉRATION VIDÉO ==========
  const generateVideo = async (nodeId: string): Promise<string | null> => {
    const nodes = getNodes();
    const edges = getEdges();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return null;
    
    const incomers = getIncomers(node, nodes, edges);
    const images = getImagesFromIncomers(incomers);
    const prompt = getTextFromIncomers(incomers) || (node.data as Record<string, unknown>).instructions as string || '';
    const duration = (node.data as Record<string, unknown>).duration as number || 10;
    const aspectRatio = (node.data as Record<string, unknown>).aspectRatio as string || '16:9';
    
    console.log(`[GenerationPanel] Génération vidéo ${nodeId}, ${images.length} images, prompt: ${prompt.slice(0, 50)}...`);
    
    if (images.length === 0) {
      console.error(`[GenerationPanel] Pas d'images pour la vidéo ${nodeId}`);
      return null;
    }
    
    try {
      const response = await fetch('/api/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId,
          prompt,
          images: images.map(i => ({ url: i.originalUrl || i.url, type: i.type })),
          duration,
          aspectRatio,
          model: 'kling-v2.6-pro-first-last',
          projectId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[GenerationPanel] Erreur API vidéo:`, errorText);
        return null;
      }

      const result = await response.json();
      const videoUrl = result.nodeData?.generated?.url || result.nodeData?.url;
      
      if (videoUrl) {
        updateNodeData(nodeId, {
          generated: result.nodeData?.generated || { url: videoUrl, type: 'video/mp4' },
          url: videoUrl,
          generating: false,
          generatingStartTime: undefined,
        });
        return videoUrl;
      }

      return null;
    } catch (error) {
      console.error(`[GenerationPanel] Erreur génération vidéo:`, error);
      return null;
    }
  };

  // ========== ENVOI DVR ==========
  const sendVideoToDVR = async (nodeId: string): Promise<boolean> => {
      const nodes = getNodes();
      const node = nodes.find(n => n.id === nodeId);
    const data = node?.data as Record<string, unknown>;
    const generated = data?.generated as { url?: string } | undefined;
    const url = generated?.url || (data?.url as string);

    if (!url) return false;

    try {
      const response = await fetch('/api/davinci-resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'import',
          filePath: url,
          clipName: getNodeLabel(node!),
        }),
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  // ========== MISE À JOUR DU STATUT ==========
  const updateNodeStatus = (nodeId: string, status: GeneratableNode['status'], error?: string) => {
    setGeneratableNodes(prev => prev.map(n => 
      n.id === nodeId ? { ...n, status, error, hasContent: status === 'done' } : n
    ));
  };

  // ========== LANCEMENT PRINCIPAL ==========
  const startGeneration = useCallback(async () => {
    if (isGenerating) return;

    setAborted(false);
    setIsGenerating(true);
    
    // Rafraîchir l'analyse
    let currentNodes = analyzeCanvas();
    setGeneratableNodes(currentNodes);
    
    const totalToGenerate = currentNodes.filter(n => n.status === 'ready' || n.status === 'waiting').length;
    if (totalToGenerate === 0) {
      toast.info('Aucun nœud à générer');
      setIsGenerating(false);
      return;
    }
    
    toast.info(`🚀 Lancement de la génération de ${totalToGenerate} nœuds...`);
    
    let successCount = 0;
    let errorCount = 0;
    let waveNumber = 0;
    
    try {
      // Boucle tant qu'il y a des nœuds "ready"
      while (!aborted) {
        // Rafraîchir l'état des nœuds
        currentNodes = analyzeCanvas();
        setGeneratableNodes(currentNodes);
        
        // Trouver tous les nœuds prêts (images d'abord, puis vidéos)
        const readyNodes = currentNodes.filter(n => n.status === 'ready');
        
        if (readyNodes.length === 0) {
          // Vérifier s'il reste des nœuds en attente
          const waitingNodes = currentNodes.filter(n => n.status === 'waiting');
          if (waitingNodes.length === 0) {
            break; // Tout est fait
          }
          
          // Il y a des nœuds en attente mais aucun n'est prêt - on est bloqué
          console.log(`[GenerationPanel] ${waitingNodes.length} nœuds en attente mais aucun prêt - blocage`);
          break;
        }
        
        waveNumber++;
        const readyImages = readyNodes.filter(n => n.type === 'image');
        const readyVideos = readyNodes.filter(n => n.type === 'video');
        
        // Phase Images
        if (readyImages.length > 0) {
          setCurrentPhase(`🎨 Vague ${waveNumber} - ${readyImages.length} images`);
          toast.info(`🎨 Vague ${waveNumber} : ${readyImages.length} images en parallèle`);
          
          // Marquer comme generating
          for (const node of readyImages) {
            updateNodeStatus(node.id, 'generating');
            updateNodeData(node.id, { generating: true, generatingStartTime: Date.now() });
          }
          
          // Lancer en parallèle
          const imageResults = await Promise.all(
            readyImages.map(async (node) => {
              if (aborted) return { node, success: false };
              const url = await generateImage(node.id);
              return { node, success: url !== null };
            })
          );
          
          // Traiter les résultats
          for (const { node, success } of imageResults) {
            updateNodeData(node.id, { generating: false, generatingStartTime: undefined });
            if (success) {
              updateNodeStatus(node.id, 'done');
            successCount++;
          } else {
              updateNodeStatus(node.id, 'error', 'Échec génération');
            errorCount++;
          }
          }
        }
        
        // Phase Vidéos
        if (readyVideos.length > 0 && !aborted) {
          setCurrentPhase(`🎬 Vague ${waveNumber} - ${readyVideos.length} vidéos`);
          toast.info(`🎬 Vague ${waveNumber} : ${readyVideos.length} vidéos en parallèle`);
          
          // Marquer comme generating
          for (const node of readyVideos) {
            updateNodeStatus(node.id, 'generating');
            updateNodeData(node.id, { generating: true, generatingStartTime: Date.now() });
          }
          
          // Lancer en parallèle
          const videoResults = await Promise.all(
            readyVideos.map(async (node) => {
              if (aborted) return { node, success: false };
              const url = await generateVideo(node.id);
              return { node, success: url !== null };
            })
          );

          // Traiter les résultats
          for (const { node, success } of videoResults) {
            updateNodeData(node.id, { generating: false, generatingStartTime: undefined });
            if (success) {
              updateNodeStatus(node.id, 'done');
              successCount++;

              // DVR si activé
              if (sendToDVR) {
                await sendVideoToDVR(node.id);
              }
            } else {
              updateNodeStatus(node.id, 'error', 'Échec génération');
              errorCount++;
            }
          }
        }
      }

      setCurrentPhase('✅ Terminé');
      toast.success(`🎉 Génération terminée ! ✅ ${successCount} succès${errorCount > 0 ? ` • ❌ ${errorCount} erreurs` : ''}`);
      
    } catch (error) {
      console.error('[GenerationPanel] Erreur:', error);
      toast.error(`Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    } finally {
      setIsGenerating(false);
      setCurrentPhase('');
      fetchMedias();
    }
  }, [isGenerating, aborted, analyzeCanvas, sendToDVR, updateNodeData, fetchMedias]);

  const cancelGeneration = () => {
    setAborted(true);
    setIsGenerating(false);
    toast.warning('Génération annulée');
  };

  // ========== RENDU ==========
  const getNodeIcon = (node: GeneratableNode) => {
    const isImage = node.type === 'image';
    const color = isImage ? 'text-[#00ff41]' : 'text-fuchsia-400';
    
    switch (node.status) {
      case 'generating':
      return <Loader2Icon size={14} className={`animate-spin ${color}`} />;
      case 'done':
      return <CheckCircle2Icon size={14} className={color} />;
      case 'error':
      return <AlertCircleIcon size={14} className="text-red-400" />;
      case 'ready':
        return <CircleDotIcon size={14} className={color} />;
      case 'waiting':
        return <ClockIcon size={14} className="text-zinc-500" />;
    }
  };

  const totalGeneratable = generatableNodes.filter(n => n.status !== 'done').length;
  const progress = generatableNodes.length > 0 
    ? (stats.totalDone / generatableNodes.length) * 100 
    : 0;

  // Grouper par profondeur
  const nodesByDepth = useMemo(() => {
    const groups = new Map<number, GeneratableNode[]>();
    for (const node of generatableNodes) {
      if (!groups.has(node.depth)) {
        groups.set(node.depth, []);
      }
      groups.get(node.depth)!.push(node);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);
  }, [generatableNodes]);

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
            Arbre de dépendances du canvas
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6 flex-1 overflow-y-auto pr-4">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-[#00ff41]/10 border border-[#00ff41]/30 p-3 text-center">
              <ImageIcon size={20} className="mx-auto mb-1 text-[#00ff41]" />
              <p className="text-lg font-bold text-[#00ff41]">
                {stats.readyImages} <span className="text-xs font-normal text-zinc-500">/ {stats.totalImages}</span>
              </p>
              <p className="text-xs text-zinc-400">Images prêtes</p>
            </div>
            <div className="rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/30 p-3 text-center">
              <VideoIcon size={20} className="mx-auto mb-1 text-fuchsia-400" />
              <p className="text-lg font-bold text-fuchsia-400">
                {stats.readyVideos} <span className="text-xs font-normal text-zinc-500">/ {stats.totalVideos}</span>
              </p>
              <p className="text-xs text-zinc-400">Vidéos prêtes</p>
            </div>
          </div>

          {/* Arbre de dépendances */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-zinc-300">🌳 Arbre de dépendances</p>
            
            {generatableNodes.length === 0 ? (
              <div className="text-center py-8 text-zinc-500">
                <p>Aucun nœud générable trouvé</p>
                <p className="text-xs mt-2">Connectez des nœuds text/image à des nœuds image/video</p>
            </div>
            ) : (
              <ScrollArea className="max-h-[40vh] rounded-lg border border-zinc-800 p-3">
                <div className="space-y-4">
                  {nodesByDepth.map(([depth, nodes]) => (
                    <div key={depth}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-mono text-zinc-500">
                          Niveau {depth}
                        </span>
                        <span className="text-xs text-zinc-600">
                          ({nodes.filter(n => n.status === 'ready').length} prêts)
                        </span>
                      </div>
                      <div className="space-y-1 pl-4 border-l border-zinc-800">
                        {nodes.map((node) => (
                          <div
                            key={node.id}
                            className={cn(
                              'flex items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors',
                              node.status === 'generating' && 'bg-blue-500/10',
                              node.status === 'done' && 'bg-emerald-500/5',
                              node.status === 'ready' && 'bg-zinc-800/50',
                              node.status === 'error' && 'bg-red-500/10'
                            )}
                          >
                            {getNodeIcon(node)}
                            <span className={cn(
                              'flex-1 truncate',
                              node.status === 'done' && 'text-zinc-500',
                              node.status === 'waiting' && 'text-zinc-600',
                            )}>
                              {node.label}
                            </span>
                            <span className="text-xs text-zinc-600">
                              {node.type === 'image' ? '🖼️' : '🎬'}
                            </span>
                            {node.status === 'waiting' && (
                              <span className="text-[10px] text-zinc-600">
                                ⏳ attend {node.incomingNodeIds.length}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Options */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 rounded-lg bg-zinc-900/50 p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={sendToDVR}
                onChange={(e) => setSendToDVR(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-700"
                disabled={isGenerating}
              />
              <div>
                <p className="font-medium text-zinc-300">Envoyer à DaVinci Resolve</p>
                <p className="text-xs text-zinc-500">Importe automatiquement les vidéos</p>
              </div>
            </label>
          </div>

          {/* Boutons */}
          <div className="flex gap-3">
            {!isGenerating ? (
              <Button
                onClick={startGeneration}
                disabled={stats.totalReady === 0}
                className="flex-1 gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 disabled:opacity-50"
              >
                <PlayIcon size={16} />
                Lancer la génération
                {stats.totalReady > 0 && (
                  <span className="ml-1 text-xs opacity-80">
                    ({stats.totalReady} prêts)
                  </span>
                )}
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
          {isGenerating && currentPhase && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-zinc-300">{currentPhase}</span>
                <span className="text-zinc-500">
                  {stats.totalDone} / {generatableNodes.length}
                </span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
