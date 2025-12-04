import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { getProjectSettings, trackDeletion } from '@/lib/local-projects-store';
import { removeMediaReference } from '@/lib/media-references';
import { updateGenerationDVRStatus } from '@/lib/generations-store';
import { useNodeOperations } from '@/providers/node-operations';
import { useProject } from '@/providers/project';
import { useCleanupMode } from '@/providers/cleanup-mode';
import { useHoveredNodeOptional } from '@/providers/hovered-node';
import { Handle, Position, useReactFlow, useStore } from '@xyflow/react';
import { CodeIcon, CopyIcon, EyeIcon, TrashIcon } from 'lucide-react';
import { type ReactNode, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { NodeToolbar } from './toolbar';
import { BatchRunsControl } from './batch-runs-control';
import { ReplaceMediaButton } from './replace-media-button';
import { UpscaleButton, type UpscaleSettings, type UpscaleStatus } from './image/upscale-button';
import { SendToDVRButton } from './send-to-dvr-button';
import { SendToDVRModal, type DVRMediaMetadata } from './send-to-dvr-modal';
import { toast } from 'sonner';

// ========== OPTIMISATION ANTI-CLIGNOTEMENT ==========
// Hook personnalisé pour le zoom avec seuil de changement
// Ne re-render que si le zoom change de plus de 0.1 (10%)
function useThrottledZoom(): number {
  const currentZoom = useStore((state) => state.transform[2]);
  const lastZoomRef = useRef(currentZoom);
  const [stableZoom, setStableZoom] = useState(currentZoom);
  
  useEffect(() => {
    // Ne mettre à jour que si le changement est significatif (> 10%)
    const diff = Math.abs(currentZoom - lastZoomRef.current);
    if (diff > 0.1 || currentZoom < 0.3 !== lastZoomRef.current < 0.3) {
      lastZoomRef.current = currentZoom;
      setStableZoom(currentZoom);
    }
  }, [currentZoom]);
  
  return stableZoom;
}

// Types de nodes qui supportent le batch/runs parallèles
const BATCH_SUPPORTED_TYPES = ['image', 'video', 'audio', 'generate-image', 'generate-video'];

// Types de nodes qui supportent le remplacement de média
const REPLACE_SUPPORTED_TYPES = ['image', 'video'];

// Types de nodes qui supportent l'envoi vers DaVinci Resolve
const DVR_SUPPORTED_TYPES = ['image', 'video', 'audio'];

type NodeLayoutProps = {
  children: ReactNode;
  id: string;
  data?: Record<string, unknown> & {
    model?: string;
    source?: string;
    content?: { url: string; type: string };
    generated?: { url: string; type: string };
    instructions?: string; // Prompt de génération
    advancedSettings?: {
      aspectRatio?: string;
      width?: number;
      height?: number;
      quality?: string;
    };
    isGenerated?: boolean; // Si true, l'image a été générée dans le canvas (pas importée)
    upscale?: {
      status: 'idle' | 'processing' | 'completed';
      originalUrl?: string;
      upscaledUrl?: string;
      model?: string;
      scale?: number;
    };
    // Données DVR
    dvrTransferred?: boolean;    // Si true, l'élément a été envoyé vers DVR
    dvrTransferDate?: string;    // Date du transfert
    dvrProject?: string;         // Nom du projet DVR
    dvrFolder?: string;          // Dossier dans le Media Pool
    localPath?: string;          // Chemin local du fichier téléchargé
    generatedAt?: string;        // Date de génération (pour expiration)
    // Métadonnées DVR pré-calculées par l'IA
    dvrMetadata?: {
      title?: string;
      decor?: string;
      description?: string;
      analyzedAt?: string;       // Date de l'analyse
    };
  };
  title: string;
  type: string;
  toolbar?: {
    tooltip?: string;
    children: ReactNode;
  }[];
  className?: string;
  onBatchRun?: (count: number) => void;
  onUpscale?: (settings: UpscaleSettings) => void;
  onCancelUpscale?: () => void;
  modelLabel?: string; // Nom du modèle pour l'affichage
};

export const NodeLayout = ({
  children,
  type,
  id,
  data,
  toolbar,
  title,
  className,
  onBatchRun,
  onUpscale,
  onCancelUpscale,
  modelLabel,
}: NodeLayoutProps) => {
  const { deleteElements, setCenter, getNode, updateNode, addNodes, addEdges, getEdges, updateNodeData } = useReactFlow();
  const { duplicateNode } = useNodeOperations();
  const project = useProject();
  // OPTIMISÉ: Zoom avec seuil pour éviter les re-renders excessifs
  const zoom = useThrottledZoom();
  const [showData, setShowData] = useState(false);
  const [isNodeHovered, setIsNodeHovered] = useState(false);
  const [isBatchControlHovered, setIsBatchControlHovered] = useState(false);
  const [isToolbarHovered, setIsToolbarHovered] = useState(false);
  const [isReplaceHovered, setIsReplaceHovered] = useState(false);
  const [isUpscaleHovered, setIsUpscaleHovered] = useState(false);
  const [isSendHovered, setIsSendHovered] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // État pour la modale DVR
  const [showDVRModal, setShowDVRModal] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  // État pour la confirmation de suppression
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Vérifie si ce type de node supporte le batch (seulement pour images GENEREES dans le canvas)
  const supportsBatch = BATCH_SUPPORTED_TYPES.includes(type);
  
  // Le batch est affiché SEULEMENT si l'image est générée (pas importée)
  // Pour les images : si data.isGenerated est true OU si generated existe et pas content
  const isGeneratedImage = type === 'image' && (data?.isGenerated || (data?.generated?.url && !data?.content?.url));
  const showBatchForThisNode = supportsBatch && (type !== 'image' || isGeneratedImage);
  
  // Vérifie si ce type de node supporte le remplacement de média
  const supportsReplace = REPLACE_SUPPORTED_TYPES.includes(type);
  
  // Vérifie si le nœud a du contenu (uploadé ou généré) - donc pas vide
  const hasMediaContent = Boolean(data?.content?.url || data?.generated?.url);
  
  // Vérifie si le nœud supporte l'upscale (images uniquement avec du contenu)
  const supportsUpscale = type === 'image' && hasMediaContent;
  
  // Obtenir le statut d'upscale
  const upscaleStatus: UpscaleStatus = data?.upscale?.status || 'idle';
  
  // Vérifie si le nœud supporte l'envoi vers DVR
  const supportsDVR = DVR_SUPPORTED_TYPES.includes(type) && hasMediaContent;
  
  // Vérifie si l'élément a été généré (pas importé)
  // On se fie UNIQUEMENT à data.isGenerated qui est explicitement défini lors de la génération
  // Ne pas utiliser data.generated?.url car les imports peuvent aussi avoir cette propriété
  const isGenerated = Boolean(data?.isGenerated);
  
  // Vérifie si l'élément a déjà été transféré vers DVR
  const isTransferredToDVR = Boolean(data?.dvrTransferred);
  
  // Mode cleanup
  const { isCleanupMode, selectedForCleanup, toggleNodeSelection } = useCleanupMode();
  const isSelectedForCleanup = selectedForCleanup.has(id);
  
  // En mode cleanup : protéger les collections et les nœuds DVR
  const isCollection = type === 'collection';
  const isProtectedFromCleanup = isTransferredToDVR || isCollection;
  
  // Hook pour le highlight au hover des connexions
  const hoveredContext = useHoveredNodeOptional();
  const isConnectionHighlighted = hoveredContext?.isNodeHighlighted(id) ?? false;
  const isDirectlyHovered = hoveredContext?.hoveredNodeId === id;
  
  // Callback pour signaler le hover au provider
  const handleConnectionHoverEnter = useCallback(() => {
    hoveredContext?.onNodeHover(id);
  }, [hoveredContext, id]);
  
  const handleConnectionHoverLeave = useCallback(() => {
    hoveredContext?.onNodeHover(null);
  }, [hoveredContext]);
  
  // OPTIMISÉ: Mémoriser les styles dépendant du zoom pour éviter les recalculs
  // Avec support du highlight des connexions (x3 pour la bordure)
  const zoomDependentStyles = useMemo(() => {
    const baseBorderWidth = Math.max(2, Math.min(6, Math.round(2 / zoom)));
    return {
      // Bordure x3 si le nœud est highlight (hover direct ou connexion)
      borderWidth: isConnectionHighlighted ? baseBorderWidth * 3 : baseBorderWidth,
      iconScale: 1 / zoom,
      showZoomElements: zoom > 0.2,
    };
  }, [zoom, isConnectionHighlighted]);
  
  // Handler pour clic en mode cleanup
  const handleCleanupClick = useCallback((e: React.MouseEvent) => {
    if (!isCleanupMode) return;
    
    e.stopPropagation();
    e.preventDefault();
    toggleNodeSelection(id, isProtectedFromCleanup);
  }, [isCleanupMode, id, isProtectedFromCleanup, toggleNodeSelection]);
  
  // URL du média (content ou generated)
  const mediaUrl = data?.content?.url || data?.generated?.url || '';
  
  // Les contrôles sont visibles si le node OU un des contrôles est hovered
  const showControls = isNodeHovered || isBatchControlHovered || isToolbarHovered || isReplaceHovered || isUpscaleHovered || isSendHovered;

  // Handlers de hover avec délai
  const handleNodeMouseEnter = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setIsNodeHovered(true);
  };

  const handleNodeMouseLeave = () => {
    // Délai de 300ms pour laisser le temps d'aller sur le contrôle
    hideTimeoutRef.current = setTimeout(() => {
      setIsNodeHovered(false);
    }, 300);
  };

  // Cleanup du timeout
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  // Handler pour le batch run
  const handleBatchRun = async (count: number) => {
    if (onBatchRun) {
      // Utiliser le callback fourni par le composant parent
      onBatchRun(count);
    } else {
      // Comportement par défaut: dupliquer le node N-1 fois
      const currentNode = getNode(id);
      if (!currentNode) return;

      const edges = getEdges().filter(e => e.target === id || e.source === id);
      
      for (let i = 1; i < count; i++) {
        const newNodeId = `${id}-batch-${i}-${Date.now()}`;
        const offsetY = (currentNode.measured?.height ?? 200) + 50;
        
        // Dupliquer le node
        addNodes({
          ...currentNode,
          id: newNodeId,
          position: {
            x: currentNode.position.x,
            y: currentNode.position.y + (offsetY * i),
          },
          selected: false,
        });

        // Dupliquer les connections
        for (const edge of edges) {
          addEdges({
            ...edge,
            id: `${edge.id}-batch-${i}`,
            source: edge.source === id ? newNodeId : edge.source,
            target: edge.target === id ? newNodeId : edge.target,
          });
        }
      }
    }
  };

  // Handler pour ouvrir la modale DVR
  const handleOpenDVRModal = useCallback(async () => {
    setShowDVRModal(true);
    
    // Vérifier si les métadonnées ont déjà été calculées
    const existingMetadata = data?.dvrMetadata as { title?: string; decor?: string; description?: string; analyzedAt?: string } | undefined;
    
    // Si les données existent déjà, ne rien faire - elles sont passées via initialMetadata
    if (existingMetadata?.analyzedAt) {
      return;
    }
    
    // Lancer l'analyse IA pour TOUS les éléments (générés ET importés)
    // Pour les importés, on analyse visuellement l'image/vidéo
    setIsAnalyzing(true);
    
    try {
      // Récupérer le system prompt personnalisé du projet si disponible
      let customSystemPrompt: string | undefined;
      if (project?.id) {
        const projectSettings = getProjectSettings(project.id);
        customSystemPrompt = projectSettings?.dvrAnalysisSystemPrompt;
      }
      
      const response = await fetch('/api/analyze-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaType: type as 'image' | 'video' | 'audio',
          prompt: data?.instructions || '', // Peut être vide pour les imports
          mediaUrl: mediaUrl,
          customSystemPrompt,
          isImported: !isGenerated, // Indiquer si c'est un import pour l'analyse
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.analysis) {
          // Stocker les métadonnées dans le nœud pour ne pas les recalculer
          updateNodeData(id, {
            dvrMetadata: {
              title: result.analysis.title,
              decor: result.analysis.decor,
              description: result.analysis.description,
              analyzedAt: new Date().toISOString(),
            },
          });
          
          // Émettre un événement pour mettre à jour les champs de la modale (première analyse)
          window.dispatchEvent(
            new CustomEvent('dvr-ai-analysis-complete', {
              detail: result.analysis,
            })
          );
        }
      }
    } catch (error) {
      console.error('Erreur analyse IA:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [isGenerated, data?.instructions, data?.dvrMetadata, type, mediaUrl, project?.id, id, updateNodeData]);

  // Handler pour envoyer vers DVR
  const handleSendToDVR = useCallback(async (metadata: DVRMediaMetadata) => {
    setIsSending(true);
    
    try {
      // 1. D'abord, télécharger le fichier localement s'il vient d'une URL externe
      let localFilePath = data?.localPath;
      
      if (!localFilePath && mediaUrl) {
        // Télécharger le fichier via l'API de stockage local
        const downloadResponse = await fetch('/api/upload-local', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: metadata.title,
            sourceUrl: mediaUrl,
            bucket: type === 'video' ? 'videos' : type === 'audio' ? 'audio' : 'images',
          }),
        });
        
        if (!downloadResponse.ok) {
          throw new Error('Échec du téléchargement local');
        }
        
        const downloadResult = await downloadResponse.json();
        localFilePath = downloadResult.path;
      }
      
      if (!localFilePath) {
        throw new Error('Impossible de déterminer le chemin local du fichier');
      }
      
      // 2. Importer dans DVR avec les métadonnées
      // Les imports vont dans "TersaFork/Imports from disk", les générés dans "TersaFork"
      const targetFolder = isGenerated ? 'TersaFork' : 'TersaFork/Imports from disk';
      
      const dvrResponse = await fetch('/api/davinci-resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'import',
          filePath: localFilePath,
          targetFolder,
          clipName: metadata.title,
          metadata: {
            scene: metadata.scene,
            comments: metadata.decor,
            description: metadata.description,
          },
        }),
      });
      
      const dvrResult = await dvrResponse.json();
      
      if (!dvrResult.success) {
        throw new Error(dvrResult.error || 'Échec de l\'import DVR');
      }
      
      // 3. Mettre à jour les données du nœud
      const transferDate = new Date().toISOString();
      updateNodeData(id, {
        dvrTransferred: true,
        dvrTransferDate: transferDate,
        dvrProject: dvrResult.project,
        dvrFolder: dvrResult.folder,
        localPath: localFilePath,
      });
      
      // 4. Mettre à jour le generations-store pour le dashboard
      updateGenerationDVRStatus(id, {
        dvrTransferred: true,
        dvrTransferDate: transferDate,
        dvrProject: dvrResult.project,
        localPath: localFilePath,
      });
      
      // 5. Fermer la modale et afficher le toast
      setShowDVRModal(false);
      toast.success('Envoyé vers DaVinci Resolve', {
        description: `Projet: ${dvrResult.project} • Dossier: ${dvrResult.folder}`,
      });
      
    } catch (error) {
      console.error('Erreur envoi DVR:', error);
      toast.error('Échec de l\'envoi vers DaVinci Resolve', {
        description: error instanceof Error ? error.message : 'Erreur inconnue',
      });
    } finally {
      setIsSending(false);
    }
  }, [id, mediaUrl, data?.localPath, type, updateNodeData, isGenerated]);

  const handleFocus = () => {
    const node = getNode(id);

    if (!node) {
      return;
    }

    const { x, y } = node.position;
    const width = node.measured?.width ?? 0;

    setCenter(x + width / 2, y, {
      duration: 1000,
    });
  };

  // Extraire le chemin local depuis l'URL ou localPath
  // Retourne l'URL relative pour l'API, ou le chemin absolu si disponible
  const getLocalFilePath = useCallback((): string | null => {
    // D'abord vérifier localPath (pour les éléments générés avec chemin absolu)
    if (data?.localPath) {
      return data.localPath as string;
    }
    
    // Sinon, utiliser l'URL locale (pour les éléments importés)
    // L'API convertira /api/storage/... en chemin absolu
    const url = data?.content?.url || data?.generated?.url;
    if (url && typeof url === 'string' && url.startsWith('/api/storage/')) {
      return url; // L'API gère la conversion
    }
    
    return null;
  }, [data?.localPath, data?.content?.url, data?.generated?.url]);
  
  // État pour stocker le chemin absolu résolu
  const [resolvedFilePath, setResolvedFilePath] = useState<string | null>(null);
  
  // Résoudre le chemin absolu quand le dialog s'ouvre
  useEffect(() => {
    if (showData) {
      const localPath = getLocalFilePath();
      if (localPath && localPath.startsWith('/api/storage/')) {
        // Appeler l'API pour résoudre le chemin
        fetch('/api/resolve-path', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: localPath }),
        })
          .then(res => res.json())
          .then(data => {
            if (data.absolutePath) {
              setResolvedFilePath(data.absolutePath);
            }
          })
          .catch(() => setResolvedFilePath(localPath));
      } else {
        setResolvedFilePath(localPath);
      }
    }
  }, [showData, getLocalFilePath]);

  // Ouvrir la confirmation de suppression
  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  // Confirmer et exécuter la suppression
  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    
    // Tracker la suppression dans les stats du projet (si élément généré)
    if (project?.id && data?.isGenerated) {
      trackDeletion(project.id);
    }
    
    // Supprimer le fichier local SI aucun autre projet ne l'utilise
    const filePath = getLocalFilePath();
    if (filePath && project?.id) {
      // Vérifier si d'autres projets utilisent ce fichier
      const canDelete = removeMediaReference(filePath, project.id);
      
      if (canDelete) {
        // Aucun autre projet n'utilise ce fichier, on peut le supprimer
        try {
          const response = await fetch('/api/delete-local', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath }),
          });
          
          if (response.ok) {
            toast.success('Fichier supprimé du disque', {
              description: filePath.split('/').pop(),
              duration: 3000,
            });
          } else {
            console.warn('Impossible de supprimer le fichier local:', filePath);
          }
        } catch (error) {
          console.error('Erreur suppression fichier:', error);
        }
      } else {
        // Le fichier est utilisé par d'autres projets
        toast.info('Nœud supprimé', {
          description: 'Le fichier est conservé (utilisé par un autre projet)',
          duration: 3000,
        });
      }
    }
    
    // Supprimer le nœud et ses connexions
    deleteElements({
      nodes: [{ id }],
    });
    
    setIsDeleting(false);
    setShowDeleteConfirm(false);
  };

  const handleShowData = () => {
    setTimeout(() => {
      setShowData(true);
    }, 100);
  };

  const handleSelect = (open: boolean) => {
    if (!open) {
      return;
    }

    const node = getNode(id);

    if (!node) {
      return;
    }

    if (!node.selected) {
      updateNode(id, { selected: true });
    }
  };

  return (
    <>
      {/* Toolbar visible au hover seulement */}
      {type !== 'drop' && Boolean(toolbar?.length) && (
        <NodeToolbar 
          id={id} 
          items={toolbar} 
          isNodeHovered={showControls}
          onHoverChange={setIsToolbarHovered}
        />
      )}
      {type !== 'file' && type !== 'tweet' && (
        <Handle type="target" position={Position.Left} />
      )}
      <ContextMenu onOpenChange={handleSelect}>
        <ContextMenuTrigger>
            <div 
            className="relative size-full h-auto w-sm"
            onMouseEnter={() => {
              handleNodeMouseEnter();
              handleConnectionHoverEnter();
            }}
            onMouseLeave={() => {
              handleNodeMouseLeave();
              handleConnectionHoverLeave();
            }}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            {type !== 'drop' && type !== 'collection' && (
              <div className="-translate-y-full -top-2 absolute right-0 left-0 flex shrink-0 items-center justify-between">
                <p className="font-mono text-muted-foreground text-xs tracking-tighter">
                  {title}
                </p>
              </div>
            )}
            
            {/* Badge DVR si transféré - visible seulement si zoom suffisant */}
            {isTransferredToDVR && zoomDependentStyles.showZoomElements && (
              <div 
                className="absolute -top-4 left-1/2 z-50"
                style={{
                  transform: `translateX(-50%) translateY(-100%) scale(${zoomDependentStyles.iconScale})`,
                  transformOrigin: 'center bottom',
                }}
              >
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    // Utiliser le titre DVR stocké lors de l'import (c'est le nom du clip dans DVR)
                    const dvrTitle = (data?.dvrMetadata as { title?: string } | undefined)?.title;
                    const clipName = dvrTitle || (data?.localPath 
                      ? (data.localPath as string).split('/').pop() 
                      : `clip-${id}`);
                    
                    // Récupérer le raccourci configuré dans les settings du projet
                    let searchShortcut: string | undefined;
                    if (project?.id) {
                      const projectSettings = getProjectSettings(project.id);
                      searchShortcut = projectSettings?.dvrSearchShortcut;
                    }
                    
                    try {
                      const response = await fetch('/api/davinci-resolve', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          action: 'focus-search',
                          clipName,
                          targetFolder: 'TersaFork',
                          searchShortcut,
                        }),
                      });
                      
                      const result = await response.json();
                      if (result.success) {
                        if (result.autoSearched) {
                          toast.success('Clip trouvé dans DaVinci Resolve', {
                            description: clipName,
                          });
                        } else {
                          toast.success('DaVinci Resolve activé', {
                            description: `Nom copié ! Clic sur recherche → Cmd+V`,
                          });
                        }
                      } else {
                        toast.error('Erreur', {
                          description: result.error || 'Impossible d\'ouvrir DVR',
                        });
                      }
                    } catch (error) {
                      toast.error('Erreur de connexion à DVR');
                    }
                  }}
                  className="flex items-center justify-center cursor-pointer hover:scale-110 transition-transform"
                  title="Cliquer pour ouvrir dans DaVinci Resolve"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src="/dvr-icon.png" 
                    alt="DaVinci Resolve" 
                    className="w-10 h-10 object-contain drop-shadow-lg grayscale"
                  />
                </button>
              </div>
            )}
            
            {/* Bouton SEND vers DVR - visible seulement si zoom suffisant */}
            {supportsDVR && !isTransferredToDVR && zoomDependentStyles.showZoomElements && (
              <div 
                className="absolute -top-4 left-1/2 z-50"
                style={{
                  transform: `translateX(-50%) translateY(-100%) scale(${zoomDependentStyles.iconScale})`,
                  transformOrigin: 'center bottom',
                }}
              >
                <SendToDVRButton
                  isVisible={showControls}
                  onClick={handleOpenDVRModal}
                  onHoverChange={setIsSendHovered}
                />
              </div>
            )}
            <div
              className={cn(
                'node-container flex size-full flex-col divide-y rounded-[20px] bg-card transition-all',
                className,
                isCleanupMode && isSelectedForCleanup && 'ring-4 ring-red-500'
              )}
              onClick={isCleanupMode ? handleCleanupClick : undefined}
              style={{
                // CODE COULEUR UNIFIÉ - Bordure colorée adaptative au zoom (OPTIMISÉ)
                // Images = Vert Matrix (#00ff41)
                // Vidéos = Fuchsia (#d946ef)
                // HIGHLIGHT : opacité 1 et bordure x3 au hover des connexions
                ...(type === 'video' || type === 'image' ? {
                  boxShadow: `0 0 0 ${zoomDependentStyles.borderWidth}px ${
                    type === 'video' 
                      ? `rgba(217, 70, 239, ${isConnectionHighlighted ? 1 : 0.8})`  // Fuchsia
                      : `rgba(0, 255, 65, ${isConnectionHighlighted ? 1 : 0.7})`    // Vert Matrix
                  }`,
                  borderRadius: '20px',
                  transition: 'box-shadow 0.15s ease',
                } : {}),
                ...(isCleanupMode ? { cursor: isProtectedFromCleanup ? 'not-allowed' : 'pointer' } : {}),
              }}
            >
              <div className="overflow-hidden rounded-[17px] bg-card">
                {children}
              </div>
              
              {/* Overlay mode cleanup */}
              {isCleanupMode && (
                <div 
                  className={cn(
                    'absolute inset-0 rounded-[20px] transition-all',
                    isProtectedFromCleanup 
                      ? 'cursor-not-allowed' 
                      : isSelectedForCleanup 
                        ? 'bg-red-500/30' 
                        : 'hover:bg-red-500/10'
                  )}
                  onClick={handleCleanupClick}
                />
              )}
            </div>
            
            {/* Bouton Trash en bas à gauche */}
            {hasMediaContent && (
              <div className="absolute bottom-3 left-3 z-50">
                <button
                  onClick={handleDeleteClick}
                  className={cn(
                    'flex items-center justify-center rounded-lg p-1.5 transition-all',
                    'bg-black/60 hover:bg-red-600 text-white/70 hover:text-white',
                    showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  )}
                  title="Supprimer (nœud + fichier)"
                >
                  <TrashIcon size={14} />
                </button>
              </div>
            )}

            {/* Contrôles en bas à droite : Replace + Batch runs + Upscale */}
            <div className="absolute bottom-3 right-3 z-50 flex items-center gap-2">
              {/* Bouton Replace - visible seulement si le nœud a du contenu */}
              {supportsReplace && hasMediaContent && (
                <ReplaceMediaButton
                  nodeId={id}
                  isVisible={showControls}
                  mediaType={type as 'image' | 'video'}
                  onHoverChange={setIsReplaceHovered}
                />
              )}
            
              {/* Contrôle des runs parallèles (comme Flora AI) - UNIQUEMENT pour images générées */}
              {showBatchForThisNode && (
                <BatchRunsControl
                  nodeId={id}
                  isVisible={showControls}
                  onRun={handleBatchRun}
                  maxRuns={100}
                  onHoverChange={setIsBatchControlHovered}
                  className="static"
                />
              )}

              {/* Bouton Upscale - pour TOUTES les images avec contenu */}
              {supportsUpscale && onUpscale && onCancelUpscale && (
                <UpscaleButton
                  isVisible={showControls}
                  status={upscaleStatus}
                  onUpscale={onUpscale}
                  onCancelUpscale={onCancelUpscale}
                  onHoverChange={setIsUpscaleHovered}
                />
              )}
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="min-w-[100px]">
          <ContextMenuItem onClick={() => duplicateNode(id)}>
            <CopyIcon size={10} />
            <span>Dupliquer</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={handleFocus}>
            <EyeIcon size={10} />
            <span>Centrer</span>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleDeleteClick} variant="destructive">
            <TrashIcon size={10} />
            <span>Supprimer</span>
          </ContextMenuItem>
          {process.env.NODE_ENV === 'development' && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={handleShowData}>
                <CodeIcon size={10} />
                <span>Data</span>
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
      <Handle type="source" position={Position.Right} />
      <Dialog open={showData} onOpenChange={setShowData}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isGenerated ? '🎨 Média généré' : '📥 Média importé'}
            </DialogTitle>
            <DialogDescription>
              <code className="rounded-sm bg-secondary px-2 py-1 font-mono text-xs">{id}</code>
              {' • '}<span className="font-medium uppercase">{type}</span>
            </DialogDescription>
          </DialogHeader>
          
          {/* CHEMIN LOCAL - HIGHLIGHT PRINCIPAL */}
          {resolvedFilePath && (
            <button
              onClick={async () => {
                const filePath = getLocalFilePath();
                if (filePath) {
                  try {
                    await fetch('/api/open-in-finder', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ filePath }),
                    });
                  } catch (e) {
                    console.error('Erreur ouverture Finder:', e);
                  }
                }
              }}
              className="w-full text-left font-mono text-sm bg-emerald-500/20 text-emerald-400 px-4 py-3 rounded-lg hover:bg-emerald-500/30 transition-colors cursor-pointer break-all border border-emerald-500/30"
              title="Cliquer pour afficher dans le Finder"
            >
              📁 {resolvedFilePath}
            </button>
          )}
          
          {/* Infos techniques */}
          <div className="grid grid-cols-2 gap-3">
            {(data?.width || data?.generated?.width || data?.content?.width) && (
              <div className="rounded-lg bg-secondary/50 p-3">
                <span className="text-xs text-muted-foreground uppercase tracking-wide block mb-1">Résolution</span>
                <p className="text-sm font-medium">
                  {(data?.width || data?.generated?.width || data?.content?.width) as number}×{(data?.height || data?.generated?.height || data?.content?.height) as number} px
                </p>
              </div>
            )}
            {(data?.duration || data?.generated?.duration || data?.content?.duration) && (
              <div className="rounded-lg bg-secondary/50 p-3">
                <span className="text-xs text-muted-foreground uppercase tracking-wide block mb-1">Durée</span>
                <p className="text-sm font-medium">{(data?.duration || data?.generated?.duration || data?.content?.duration) as number}s</p>
              </div>
            )}
            {(data?.generated?.type || data?.content?.type) && (
              <div className="rounded-lg bg-secondary/50 p-3">
                <span className="text-xs text-muted-foreground uppercase tracking-wide block mb-1">Format</span>
                <p className="text-sm font-medium">{(data?.generated?.type || data?.content?.type) as string}</p>
              </div>
            )}
            <div className="rounded-lg bg-secondary/50 p-3">
              <span className="text-xs text-muted-foreground uppercase tracking-wide block mb-1">DaVinci Resolve</span>
              <p className={`text-sm font-medium ${isTransferredToDVR ? 'text-orange-400' : 'text-muted-foreground'}`}>
                {isTransferredToDVR ? '✓ Transféré' : '○ Non transféré'}
              </p>
            </div>
          </div>
          
          {/* Section Génération (si généré) */}
          {isGenerated && (
            <div className="space-y-3 rounded-lg bg-violet-500/10 border border-violet-500/20 p-4">
              <h4 className="text-sm font-semibold text-violet-400 flex items-center gap-2">⚡ Paramètres de génération</h4>
              
              {/* Modèle */}
              {data?.modelId && (
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">Modèle</span>
                  <p className="text-sm font-mono bg-violet-500/20 text-violet-300 px-2 py-1 rounded mt-1 inline-block">{data.modelId as string}</p>
                </div>
              )}
              
              {/* Coût */}
              {data?.cost !== undefined && (
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">Coût</span>
                  <p className="text-sm font-mono bg-amber-500/20 text-amber-300 px-2 py-1 rounded mt-1 inline-block">
                    💰 {typeof data.cost === 'number' ? data.cost.toFixed(4) : data.cost} crédits
                  </p>
                </div>
              )}
              
              {/* Prompt */}
              {data?.instructions && (
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">Prompt</span>
                  <p className="text-sm bg-black/30 p-3 rounded-lg mt-1 whitespace-pre-wrap max-h-[150px] overflow-y-auto">{data.instructions as string}</p>
                </div>
              )}
              
              {/* Paramètres avancés */}
              <div className="flex flex-wrap gap-2">
                {data?.aspectRatio && <span className="text-xs bg-violet-500/20 text-violet-300 px-2 py-1 rounded">Ratio: {data.aspectRatio as string}</span>}
                {data?.duration && <span className="text-xs bg-violet-500/20 text-violet-300 px-2 py-1 rounded">Durée: {String(data.duration)}s</span>}
                {data?.seed && <span className="text-xs bg-violet-500/20 text-violet-300 px-2 py-1 rounded">Seed: {String(data.seed)}</span>}
                {data?.steps && <span className="text-xs bg-violet-500/20 text-violet-300 px-2 py-1 rounded">Steps: {String(data.steps)}</span>}
                {data?.cfg && <span className="text-xs bg-violet-500/20 text-violet-300 px-2 py-1 rounded">CFG: {String(data.cfg)}</span>}
                {data?.guidance_scale && <span className="text-xs bg-violet-500/20 text-violet-300 px-2 py-1 rounded">Guidance: {String(data.guidance_scale)}</span>}
              </div>
              
              {/* Images input avec chemins */}
              {data?.inputImages && Array.isArray(data.inputImages) && data.inputImages.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">Images source ({(data.inputImages as string[]).length})</span>
                  <div className="space-y-2 mt-2">
                    {(data.inputImages as string[]).map((url, idx) => (
                      <div key={idx} className="flex items-center gap-3 bg-black/20 p-2 rounded-lg">
                        <img src={url} alt={`Input ${idx + 1}`} className="w-12 h-12 object-cover rounded border border-violet-500/30 flex-shrink-0" />
                        <button
                          onClick={async () => {
                            try {
                              await fetch('/api/open-in-finder', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ filePath: url }),
                              });
                            } catch (e) {
                              console.error('Erreur ouverture Finder:', e);
                            }
                          }}
                          className="font-mono text-xs text-emerald-400 hover:text-emerald-300 break-all text-left cursor-pointer"
                          title="Cliquer pour afficher dans le Finder"
                        >
                          📁 {url}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {(data?.smartTitle || (data?.dvrMetadata as Record<string, unknown>)?.title) && (
            <div className="rounded-lg bg-secondary/50 p-3">
              <span className="text-xs text-muted-foreground uppercase tracking-wide block mb-1">Titre</span>
              <p className="text-sm">{(data?.smartTitle || (data?.dvrMetadata as Record<string, unknown>)?.title) as string}</p>
            </div>
          )}
          
          <details className="group">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">📋 Voir toutes les données (JSON)</summary>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-black p-4 text-xs text-white max-h-[200px] overflow-y-auto">{JSON.stringify(data, null, 2)}</pre>
          </details>
        </DialogContent>
      </Dialog>
      
      {/* Modale Send to DVR */}
      {supportsDVR && (
        <SendToDVRModal
          open={showDVRModal}
          onOpenChange={setShowDVRModal}
          onSend={handleSendToDVR}
          mediaType={type as 'image' | 'video' | 'audio'}
          mediaUrl={mediaUrl}
          isGenerated={isGenerated}
          generationPrompt={data?.instructions as string | undefined}
          initialMetadata={data?.dvrMetadata as { title?: string; decor?: string; description?: string } | undefined}
          isAnalyzing={isAnalyzing}
          isSending={isSending}
        />
      )}
      
      {/* Dialog de confirmation de suppression */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Cet élément sera supprimé du projet et de votre disque dur.
              <br />
              <span className="text-red-500 font-medium">Cette action est irréversible.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
