'use client';

/**
 * Panneau de génération UNIVERSEL
 * 
 * LOGIQUE :
 * 1. Scanner TOUS les nœuds du canvas
 * 2. Calculer la PROFONDEUR de chaque nœud (basée sur le max des profondeurs des parents + 1)
 * 3. Afficher une LISTE PLATE unique (chaque nœud UNE SEULE FOIS)
 * 4. Indentation basée sur la profondeur
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  FolderIcon,
  CircleDotIcon,
  ClockIcon,
  RotateCcwIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useMediaLibraryStore } from '@/lib/media-library-store';

// ========== TYPES ==========
interface GeneratableNode {
  id: string;
  type: 'image' | 'video' | 'collection';
  label: string;
  status: 'waiting' | 'ready' | 'generating' | 'done' | 'error';
  error?: string;
  depth: number; // Profondeur pour indentation
  hasContent: boolean;
  waitingFor: string[]; // Noms des dépendances qu'il attend
  nodeData: Record<string, unknown>;
}

interface GenerationPanelProps {
  projectId: string;
}

// ========== HELPERS ==========

// Vérifier si un nœud a du contenu média
function nodeHasMediaContent(node: Node): boolean {
  const data = node.data as Record<string, unknown>;
  
  if (node.type === 'image') {
    const generated = data.generated as { url?: string } | undefined;
    const content = data.content as { url?: string } | undefined;
    return Boolean(generated?.url || content?.url || data.url);
  }
  
  if (node.type === 'video') {
    const generated = data.generated as { url?: string } | undefined;
    const content = data.content as { url?: string } | undefined;
    return Boolean(generated?.url || content?.url || data.url);
  }
  
  if (node.type === 'text') {
    const generated = data.generated as { text?: string } | undefined;
    return Boolean(generated?.text || data.content || data.text);
  }
  
  if (node.type === 'collection') {
    const items = data.items as Array<{ url?: string; enabled?: boolean }> | undefined;
    return Boolean(items && items.length > 0 && items.some(item => item.url && item.enabled !== false));
  }
  
  if (node.type === 'audio') {
    const generated = data.generated as { url?: string } | undefined;
    const content = data.content as { url?: string } | undefined;
    return Boolean(generated?.url || content?.url);
  }
  
  return false;
}

// Vérifier si un nœud est de type traçable (image, video ou collection)
function isTraceableType(node: Node): boolean {
  return node.type === 'image' || node.type === 'video' || node.type === 'collection';
}

// Obtenir le label d'un nœud
function getNodeLabel(node: Node): string {
  const data = node.data as Record<string, unknown>;
  return (data.label as string) || (data.name as string) || `${node.type} ${node.id.slice(-4)}`;
}

// Récupérer les images depuis les nœuds entrants
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

// ========== COULEURS CODIFIÉES ==========
const COLORS = {
  image: '#00ff41',
  video: '#d946ef',
  collection: '#f59e0b',
  imageBg: 'rgba(0, 255, 65, 0.08)',
  videoBg: 'rgba(217, 70, 239, 0.08)',
  collectionBg: 'rgba(245, 158, 11, 0.08)',
  imageBorder: 'rgba(0, 255, 65, 0.25)',
  videoBorder: 'rgba(217, 70, 239, 0.25)',
  collectionBorder: 'rgba(245, 158, 11, 0.25)',
};

// ========== COMPOSANT NODE ROW ==========
function NodeRow({ node }: { node: GeneratableNode }) {
  const color = node.type === 'image' ? COLORS.image : node.type === 'video' ? COLORS.video : COLORS.collection;
  const bgColor = node.type === 'image' ? COLORS.imageBg : node.type === 'video' ? COLORS.videoBg : COLORS.collectionBg;
  const borderColor = node.type === 'image' ? COLORS.imageBorder : node.type === 'video' ? COLORS.videoBorder : COLORS.collectionBorder;
  
  const Icon = node.type === 'image' ? ImageIcon : node.type === 'video' ? VideoIcon : FolderIcon;
  const typeLabel = node.type === 'image' ? 'image' : node.type === 'video' ? 'vidéo' : 'collection';
  
  return (
    <div style={{ marginLeft: node.depth * 24 }} className="mb-1">
      <div 
        className={cn(
          'rounded-md px-3 py-1.5 flex items-center gap-2 transition-all',
          node.status === 'generating' && 'animate-pulse',
        )}
        style={{
          backgroundColor: node.status === 'done' ? 'rgba(39, 39, 42, 0.3)' : bgColor,
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: node.status === 'done' ? 'transparent' : borderColor,
          opacity: node.status === 'done' ? 0.5 : 1,
        }}
      >
        {/* Icône de statut */}
        {node.status === 'generating' ? (
          <Loader2Icon size={14} className="animate-spin flex-shrink-0" style={{ color }} />
        ) : node.status === 'done' ? (
          <CheckCircle2Icon size={14} className="text-zinc-600 flex-shrink-0" />
        ) : node.status === 'error' ? (
          <AlertCircleIcon size={14} className="text-red-400 flex-shrink-0" />
        ) : node.status === 'ready' ? (
          <CircleDotIcon size={14} className="flex-shrink-0" style={{ color }} />
        ) : (
          <ClockIcon size={14} className="text-zinc-600 flex-shrink-0" />
        )}
        
        {/* Label */}
        <span className={cn(
          'flex-1 text-sm truncate',
          node.status === 'done' ? 'text-zinc-600' : 'text-zinc-200',
        )}>
          {node.label}
        </span>
        
        {/* Chip type - avec spinner si génération en cours */}
        <div 
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0"
          style={{ 
            backgroundColor: node.status === 'done' ? 'rgba(39, 39, 42, 0.5)' : bgColor,
            color: node.status === 'done' ? '#52525b' : color,
          }}
        >
          {node.status === 'generating' ? (
            <Loader2Icon size={10} className="animate-spin" />
          ) : (
            <Icon size={10} />
          )}
          <span>{typeLabel}</span>
        </div>
      </div>
      
      {/* Ce qu'il attend - une ligne par dépendance */}
      {node.status === 'waiting' && node.waitingFor.length > 0 && (
        <div className="mt-0.5 pl-6 space-y-0.5">
          {node.waitingFor.map((dep, i) => (
            <div key={i} className="text-[10px] text-amber-500/70">
              ⏳ {dep}
            </div>
          ))}
        </div>
      )}
      
      {/* Erreur */}
      {node.error && (
        <div className="text-[10px] text-red-400 mt-0.5 pl-6 truncate" title={node.error}>
          ❌ {node.error}
        </div>
      )}
    </div>
  );
}

// ========== CONSTANTES ==========
const STORAGE_KEY = 'generation-panel-width';
const DEFAULT_WIDTH = 500;
const MIN_WIDTH = 350;
const MAX_WIDTH = 1200;

// ========== COMPOSANT PRINCIPAL ==========
export function GenerationPanel({ projectId }: GenerationPanelProps) {
  const { getNodes, getEdges, updateNodeData } = useReactFlow();
  const { fetchMedias } = useMediaLibraryStore();
  
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aborted, setAborted] = useState(false);
  const [nodeList, setNodeList] = useState<GeneratableNode[]>([]);
  const [currentPhase, setCurrentPhase] = useState('');
  const [sendToDVR, setSendToDVR] = useState(false);
  
  // Redimensionnement
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  
  // Charger la largeur depuis localStorage au montage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) {
        setWidth(parsed);
      }
    }
  }, []);
  
  // Sauvegarder la largeur dans localStorage
  const saveWidth = useCallback((w: number) => {
    localStorage.setItem(STORAGE_KEY, w.toString());
  }, []);
  
  // Gestion du drag pour redimensionner
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  }, [width]);
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      
      // Le drag vers la gauche augmente la largeur (sidebar à droite)
      const deltaX = startX.current - e.clientX;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + deltaX));
      setWidth(newWidth);
    };
    
    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        saveWidth(width);
      }
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [width, saveWidth]);

  // ========== ANALYSE DU CANVAS ==========
  const analyzeCanvas = useCallback((): GeneratableNode[] => {
    const nodes = getNodes();
    const edges = getEdges();
    
    // Map pour calculer les profondeurs (mémoïsation)
    const depthCache = new Map<string, number>();
    
    // Fonction récursive pour calculer la profondeur d'un nœud
    const getDepth = (nodeId: string, visited: Set<string> = new Set()): number => {
      if (depthCache.has(nodeId)) return depthCache.get(nodeId)!;
      if (visited.has(nodeId)) return 0; // Éviter les cycles
      
      visited.add(nodeId);
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return 0;
      
      const incomers = getIncomers(node, nodes, edges);
      const traceableIncomers = incomers.filter(inc => isTraceableType(inc));
      
      if (traceableIncomers.length === 0) {
        depthCache.set(nodeId, 0);
        return 0;
      }
      
      const maxParentDepth = Math.max(...traceableIncomers.map(inc => getDepth(inc.id, new Set(visited))));
      const depth = maxParentDepth + 1;
      depthCache.set(nodeId, depth);
      return depth;
    };
    
    const result: GeneratableNode[] = [];
    
    for (const node of nodes) {
      if (!isTraceableType(node)) continue;
      
      const data = node.data as Record<string, unknown>;
      const incomers = getIncomers(node, nodes, edges);
      const hasContent = nodeHasMediaContent(node);
      const hasInstructions = Boolean(data.instructions);
      
      // Filtrer les nœuds non générables
      const isGeneratable = node.type === 'image' || node.type === 'video';
      if (!isGeneratable && node.type !== 'collection') continue;
      if (isGeneratable && incomers.length === 0 && !hasInstructions) continue;
      
      // Calculer les dépendances manquantes
      const waitingFor: string[] = [];
      for (const inc of incomers) {
        if (isTraceableType(inc) && !nodeHasMediaContent(inc)) {
          waitingFor.push(getNodeLabel(inc));
        }
      }
      
      // Calculer le statut
      let status: GeneratableNode['status'] = 'waiting';
      if (hasContent) {
        status = 'done';
      } else if (node.type === 'collection') {
        const allSourcesReady = incomers.every(inc => 
          !isTraceableType(inc) || nodeHasMediaContent(inc)
        );
        status = allSourcesReady ? 'ready' : 'waiting';
      } else if (incomers.length === 0 && hasInstructions) {
        status = 'ready';
      } else if (waitingFor.length === 0) {
        status = 'ready';
      }
      
      const depth = getDepth(node.id);
      
      result.push({
        id: node.id,
        type: node.type as 'image' | 'video' | 'collection',
        label: getNodeLabel(node),
        status,
        depth,
        hasContent,
        waitingFor,
        nodeData: data,
      });
    }
    
    // Trier : par profondeur, puis Décors avant Personnages, puis par label
    result.sort((a, b) => {
      // D'abord par profondeur
      if (a.depth !== b.depth) return a.depth - b.depth;
      
      // Ensuite Décors avant Personnages
      const isDecorA = a.label.toLowerCase().includes('décor') || a.label.toLowerCase().includes('potager') || a.label.toLowerCase().includes('decor');
      const isDecorB = b.label.toLowerCase().includes('décor') || b.label.toLowerCase().includes('potager') || b.label.toLowerCase().includes('decor');
      if (isDecorA && !isDecorB) return -1;
      if (!isDecorA && isDecorB) return 1;
      
      // Puis par type (collection avant image avant video)
      const typeOrder = { collection: 0, image: 1, video: 2 };
      if (typeOrder[a.type] !== typeOrder[b.type]) return typeOrder[a.type] - typeOrder[b.type];
      
      // Enfin par label
      return a.label.localeCompare(b.label);
    });
    
    return result;
  }, [getNodes, getEdges]);

  // Mettre à jour l'analyse quand le panel s'ouvre
  useEffect(() => {
    if (isOpen) {
      setNodeList(analyzeCanvas());
    }
  }, [isOpen, analyzeCanvas]);
  
  // Stats
  const stats = useMemo(() => {
    const generatable = nodeList.filter(n => n.type === 'image' || n.type === 'video');
    const images = generatable.filter(n => n.type === 'image');
    const videos = generatable.filter(n => n.type === 'video');
    
    return {
      totalImages: images.length,
      readyImages: images.filter(n => n.status === 'ready').length,
      doneImages: images.filter(n => n.status === 'done').length,
      totalVideos: videos.length,
      readyVideos: videos.filter(n => n.status === 'ready').length,
      doneVideos: videos.filter(n => n.status === 'done').length,
      totalReady: generatable.filter(n => n.status === 'ready').length,
      totalDone: generatable.filter(n => n.status === 'done').length,
    };
  }, [nodeList]);

  // ========== GÉNÉRATION IMAGE ==========
  const generateImage = async (nodeId: string): Promise<string | null> => {
    const nodes = getNodes();
    const edges = getEdges();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return null;
    
    const data = node.data as Record<string, unknown>;
    const incomers = getIncomers(node, nodes, edges);
    const images = getImagesFromIncomers(incomers);
    
    const textFromIncomers = getTextFromIncomers(incomers);
    const prompt = textFromIncomers || (data.instructions as string) || '';
    const aspectRatio = (data.aspectRatio as string) || '1:1';
    
    if (!prompt) {
      console.error(`[GenerationPanel] Pas de prompt pour image ${nodeId}`);
      return null;
    }
    
    try {
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
        console.error(`[GenerationPanel] Erreur API vidéo:`, await response.text());
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


  // ========== LANCEMENT PRINCIPAL ==========
  const startGeneration = useCallback(async () => {
    if (isGenerating) return;
    
    setAborted(false);
    setIsGenerating(true);
    
    let list = analyzeCanvas();
    setNodeList(list);
    
    const generatable = list.filter(n => n.type === 'image' || n.type === 'video');
    const totalToGenerate = generatable.filter(n => n.status === 'ready' || n.status === 'waiting').length;
    
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
      while (!aborted) {
        list = analyzeCanvas();
        setNodeList(list);
        
        const readyNodes = list.filter(n => n.status === 'ready' && (n.type === 'image' || n.type === 'video'));
        
        if (readyNodes.length === 0) {
          const waitingNodes = list.filter(n => n.status === 'waiting' && (n.type === 'image' || n.type === 'video'));
          if (waitingNodes.length === 0) break;
          console.log(`[GenerationPanel] ${waitingNodes.length} nœuds en attente mais aucun prêt`);
          break;
        }
        
        waveNumber++;
        const readyImages = readyNodes.filter(n => n.type === 'image');
        const readyVideos = readyNodes.filter(n => n.type === 'video');
        
        // Phase Images
        if (readyImages.length > 0) {
          setCurrentPhase(`🎨 Vague ${waveNumber} - ${readyImages.length} images`);
          toast.info(`🎨 Vague ${waveNumber} : ${readyImages.length} images en parallèle`);
          
          for (const node of readyImages) {
            updateNodeData(node.id, { generating: true, generatingStartTime: Date.now() });
          }
          
          const imageResults = await Promise.all(
            readyImages.map(async (node) => {
              if (aborted) return { node, success: false };
              const url = await generateImage(node.id);
              return { node, success: url !== null };
            })
          );
          
          for (const { node, success } of imageResults) {
            updateNodeData(node.id, { generating: false, generatingStartTime: undefined });
            if (success) successCount++;
            else errorCount++;
          }
        }
        
        // Phase Vidéos
        if (readyVideos.length > 0 && !aborted) {
          setCurrentPhase(`🎬 Vague ${waveNumber} - ${readyVideos.length} vidéos`);
          toast.info(`🎬 Vague ${waveNumber} : ${readyVideos.length} vidéos en parallèle`);
          
          for (const node of readyVideos) {
            updateNodeData(node.id, { generating: true, generatingStartTime: Date.now() });
          }
          
          const videoResults = await Promise.all(
            readyVideos.map(async (node) => {
              if (aborted) return { node, success: false };
              const url = await generateVideo(node.id);
              return { node, success: url !== null };
            })
          );
          
          for (const { node, success } of videoResults) {
            updateNodeData(node.id, { generating: false, generatingStartTime: undefined });
            if (success) {
              successCount++;
              if (sendToDVR) await sendVideoToDVR(node.id);
            } else {
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

  // Reset toutes les générations (images et vidéos uniquement)
  const resetAllGenerations = useCallback(() => {
    const nodes = getNodes();
    let resetCount = 0;
    
    for (const node of nodes) {
      if (node.type === 'image' || node.type === 'video') {
        const data = node.data as Record<string, unknown>;
        const hasGenerated = data.generated || data.url;
        
        if (hasGenerated) {
          updateNodeData(node.id, {
            generated: undefined,
            url: undefined,
            generating: false,
            generatingStartTime: undefined,
          });
          resetCount++;
        }
      }
      
      // Reset aussi les collections (vider les items générés)
      if (node.type === 'collection') {
        updateNodeData(node.id, {
          items: [],
        });
        resetCount++;
      }
    }
    
    // Rafraîchir l'analyse
    setNodeList(analyzeCanvas());
    
    toast.success(`🔄 ${resetCount} nœuds remis à zéro`);
  }, [getNodes, updateNodeData, analyzeCanvas]);

  // ========== RENDU ==========
  const generatableNodes = nodeList.filter(n => n.type === 'image' || n.type === 'video');
  const totalGeneratable = generatableNodes.filter(n => n.status !== 'done').length;
  const progress = generatableNodes.length > 0 
    ? (stats.totalDone / generatableNodes.length) * 100 
    : 0;

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
      
      <SheetContent 
        side="right" 
        className="!w-auto flex flex-col p-6 bg-zinc-950 border-zinc-800 overflow-hidden"
        style={{ width: `${width}px`, maxWidth: `${width}px`, minWidth: `${width}px` }}
      >
        {/* Handle de redimensionnement - invisible mais fonctionnel */}
        <div
          onMouseDown={handleMouseDown}
          className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize z-50 group"
        >
          {/* Ligne fine visible uniquement au hover */}
          <div className="absolute left-0 top-0 bottom-0 w-px bg-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <SheetHeader className="flex-shrink-0 pr-10">
          <SheetTitle className="flex items-center gap-2 text-white">
            <SparklesIcon className="text-[#00ff41]" />
            Génération des médias
          </SheetTitle>
          <SheetDescription className="text-zinc-400">
            Liste des nœuds par niveau de dépendance
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex-1 flex flex-col min-h-0">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 flex-shrink-0">
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

          {/* Liste des nœuds */}
          <div className="flex-1 min-h-0 flex flex-col mt-6">
            <p className="text-sm font-medium text-zinc-300 mb-2 flex-shrink-0">
              📋 Nœuds par niveau de dépendance
            </p>
            
            {nodeList.length === 0 ? (
              <div className="text-center py-8 text-zinc-500">
                <p>Aucun nœud générable trouvé</p>
                <p className="text-xs mt-2">Connectez des nœuds text/image à des nœuds image/video</p>
              </div>
            ) : (
              <ScrollArea className="flex-1 min-h-0 rounded-lg border border-zinc-800 p-3">
                <div className="py-1">
                  {nodeList.map((node) => (
                    <NodeRow key={node.id} node={node} />
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Options */}
          <div className="flex-shrink-0 space-y-3 mt-4 pt-4 border-t border-zinc-800">
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
          <div className="flex-shrink-0 flex gap-3 mt-4">
            {!isGenerating ? (
              <>
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
                
                {/* Bouton Reset */}
                {stats.totalDone > 0 && (
                  <Button
                    onClick={() => {
                      if (confirm('Remettre à zéro toutes les images et vidéos générées ?')) {
                        resetAllGenerations();
                      }
                    }}
                    variant="outline"
                    className="gap-2 border-zinc-700 hover:bg-zinc-800"
                    title="Remettre à zéro les générations"
                  >
                    <RotateCcwIcon size={16} />
                  </Button>
                )}
              </>
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
            <div className="flex-shrink-0 space-y-2 mt-4">
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
