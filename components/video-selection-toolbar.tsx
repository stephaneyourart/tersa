'use client';

/**
 * Gestionnaire du mode comparaison de médias (vidéos ET images)
 * ESPACE pour ouvrir, ENTREE pour confirmer, CMD+Z pour annuler
 * Utilise une corbeille temporaire pour permettre la restauration
 */

import { useCallback, useState, useMemo, useEffect } from 'react';
import { useReactFlow, useStore, type Node } from '@xyflow/react';
import { MediaComparisonMode } from './video-comparison-mode';
import { useProject } from '@/providers/project';
import { removeMediaReference, addMediaReference } from '@/lib/media-references';
import { trackDeletion, trackDVRTransfer } from '@/lib/local-projects-store';
import { toast } from 'sonner';

interface MediaInfo {
  id: string;
  url: string;
  title?: string;
  type: 'video' | 'image';
  nodeData?: Record<string, unknown>;
}

// Info pour restauration
interface TrashedFile {
  trashId: string;
  originalPath: string;
}

interface UndoAction {
  type: 'comparison-cleanup';
  deletedNodes: Node[];
  trashedFiles: TrashedFile[];
  sentNodes: { id: string; previousData: Record<string, unknown> }[];
  timestamp: number;
}

// Global undo stack
let undoStack: UndoAction[] = [];

export function VideoSelectionToolbar() {
  const { getNodes, deleteElements, updateNodeData, addNodes } = useReactFlow();
  const project = useProject();
  const [showComparisonMode, setShowComparisonMode] = useState(false);

  // Sélection
  const selectedNodeIds = useStore((state) => 
    state.nodes.filter((node) => node.selected).map((node) => node.id)
  );

  // Médias sélectionnés
  const selectedMedia = useMemo(() => {
    const nodes = getNodes();
    const mediaList: MediaInfo[] = [];

    for (const nodeId of selectedNodeIds) {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) continue;

      const isVideo = node.type === 'video' || node.type === 'video-transform';
      const isImage = node.type === 'image' || node.type === 'image-transform';
      if (!isVideo && !isImage) continue;

      const data = node.data as Record<string, unknown> | undefined;
      const generated = data?.generated as { url?: string } | undefined;
      const content = data?.content as { url?: string } | undefined;
      const mediaUrl = generated?.url || content?.url;
      if (!mediaUrl) continue;

      const title = (data?.smartTitle || data?.instructions || (isVideo ? 'Vidéo' : 'Image')) as string;

      mediaList.push({
        id: node.id,
        url: mediaUrl,
        title: title.slice(0, 50),
        type: isVideo ? 'video' : 'image',
        nodeData: data,
      });
    }

    return mediaList;
  }, [selectedNodeIds, getNodes]);

  // ESPACE pour ouvrir
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.code === 'Space' && selectedMedia.length >= 2 && !showComparisonMode) {
        e.preventDefault();
        setShowComparisonMode(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMedia.length, showComparisonMode]);

  // CMD+Z pour undo
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        const lastAction = undoStack.pop();
        if (!lastAction || lastAction.type !== 'comparison-cleanup') return;
        
        // Vérifier que l'action est récente (< 60 secondes)
        if (Date.now() - lastAction.timestamp > 60000) {
          toast.error('Impossible d\'annuler', { description: 'Action trop ancienne (> 1 min)' });
          return;
        }

        e.preventDefault();

        // Restaurer les fichiers depuis la corbeille
        const restoredPaths: Record<string, string> = {};
        for (const trashed of lastAction.trashedFiles) {
          try {
            const response = await fetch('/api/trash', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'restore',
                trashId: trashed.trashId,
              }),
            });

            if (response.ok) {
              const data = await response.json();
              restoredPaths[trashed.originalPath] = data.localUrl;
              
              // Restaurer la référence
              if (project?.id) {
                addMediaReference(data.localUrl, project.id);
              }
            }
          } catch (e) {
            console.error('Erreur restauration:', e);
          }
        }

        // Restaurer les nœuds avec les nouvelles URLs si nécessaire
        if (lastAction.deletedNodes.length > 0) {
          const nodesToRestore = lastAction.deletedNodes.map(node => {
            const data = node.data as Record<string, unknown>;
            const localPath = data?.localPath as string | undefined;
            
            // Mettre à jour le localPath si restauré
            if (localPath && restoredPaths[localPath]) {
              const newData = { ...data, localPath: restoredPaths[localPath] };
              
              // Mettre à jour aussi l'URL dans generated ou content
              if (data?.generated) {
                const gen = data.generated as { url?: string };
                newData.generated = { ...gen, url: restoredPaths[localPath] };
              }
              if (data?.content) {
                const cont = data.content as { url?: string };
                newData.content = { ...cont, url: restoredPaths[localPath] };
              }
              
              return { ...node, data: newData };
            }
            
            return node;
          });
          
          addNodes(nodesToRestore);
        }

        // Annuler les modifications DVR
        for (const sent of lastAction.sentNodes) {
          updateNodeData(sent.id, sent.previousData);
        }

        toast.success('Action annulée', {
          description: `${lastAction.deletedNodes.length} élément(s) restauré(s)`,
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addNodes, updateNodeData, project?.id]);

  // Nettoyage périodique de la corbeille (fichiers > 5 min)
  useEffect(() => {
    const cleanup = () => {
      fetch('/api/trash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'empty' }),
      }).catch(console.error);
    };

    // Nettoyer au montage et toutes les 2 minutes
    cleanup();
    const interval = setInterval(cleanup, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Confirmation
  const handleConfirm = useCallback(async (selectedIds: string[], rejectedIds: string[]) => {
    const nodes = getNodes();
    
    const undoAction: UndoAction = {
      type: 'comparison-cleanup',
      deletedNodes: [],
      trashedFiles: [],
      sentNodes: [],
      timestamp: Date.now(),
    };

    // 1. Déplacer les fichiers rejetés vers la corbeille
    let deletedCount = 0;
    for (const nodeId of rejectedIds) {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) continue;

      undoAction.deletedNodes.push({ ...node });

      const data = node.data as Record<string, unknown> | undefined;
      const localPath = data?.localPath as string | undefined;
      const generated = data?.generated as { url?: string } | undefined;
      const content = data?.content as { url?: string } | undefined;
      const contentUrl = generated?.url || content?.url;
      const filePath = localPath || contentUrl;

      if (filePath && project?.id) {
        removeMediaReference(filePath, project.id);
        
        // Déplacer vers la corbeille au lieu de supprimer
        try {
          const response = await fetch('/api/trash', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'move-to-trash',
              filePath,
            }),
          });

          if (response.ok) {
            const trashData = await response.json();
            undoAction.trashedFiles.push({
              trashId: trashData.trashId,
              originalPath: filePath,
            });
          }
        } catch (e) {
          console.error('Erreur déplacement corbeille:', e);
        }
      }

      if (data?.isGenerated && project?.id) {
        trackDeletion(project.id);
      }

      deletedCount++;
    }

    deleteElements({ nodes: rejectedIds.map((id) => ({ id })) });

    // 2. Envoyer les sélectionnés à DVR
    let sentCount = 0;
    for (const nodeId of selectedIds) {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) continue;

      const data = node.data as Record<string, unknown> | undefined;
      if (data?.dvrTransferred) continue;

      undoAction.sentNodes.push({
        id: nodeId,
        previousData: { ...data } as Record<string, unknown>,
      });

      const localPath = data?.localPath as string | undefined;
      const generated = data?.generated as { url?: string } | undefined;
      const content = data?.content as { url?: string } | undefined;
      const contentUrl = generated?.url || content?.url;
      const filePath = localPath || contentUrl;

      if (!filePath) continue;

      const isVideo = node.type === 'video' || node.type === 'video-transform';
      const extension = isVideo ? 'mp4' : 'png';

      let title = (data?.smartTitle || (data?.dvrMetadata as Record<string, string> | undefined)?.title || (isVideo ? 'Video' : 'Image')) as string;
      let description = (data?.instructions || '') as string;
      let decor = '';

      if (!data?.dvrMetadata && data?.instructions) {
        try {
          const analysisResponse = await fetch('/api/analyze-media', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mediaUrl: filePath,
              prompt: data.instructions,
              mediaType: isVideo ? 'video' : 'image',
            }),
          });

          if (analysisResponse.ok) {
            const analysisData = await analysisResponse.json();
            title = analysisData.title || title;
            description = analysisData.description || description;
            decor = analysisData.decor || '';
          }
        } catch (e) {
          console.error('Erreur analyse:', e);
        }
      } else if (data?.dvrMetadata) {
        const metadata = data.dvrMetadata as Record<string, string>;
        title = metadata.title || title;
        description = metadata.description || description;
        decor = metadata.decor || '';
      }

      try {
        let finalPath = filePath;
        if (!localPath && contentUrl?.startsWith('http')) {
          const downloadResponse = await fetch('/api/upload-local', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sourceUrl: contentUrl,
              filename: `${title.replace(/[^a-zA-Z0-9]/g, '-')}.${extension}`,
              assetType: isVideo ? 'videos' : 'images',
            }),
          });

          if (downloadResponse.ok) {
            const downloadData = await downloadResponse.json();
            finalPath = downloadData.path;
          }
        }

        const dvrResponse = await fetch('/api/davinci-resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'import',
            filePath: finalPath,
            clipName: title,
            scene: '',
            comments: decor,
            description: description,
          }),
        });

        if (dvrResponse.ok) {
          const dvrData = await dvrResponse.json();
          
          updateNodeData(nodeId, {
            dvrTransferred: true,
            dvrTransferDate: new Date().toISOString(),
            dvrProject: dvrData.project,
            dvrFolder: dvrData.folder,
            localPath: finalPath,
            dvrMetadata: { title, description, decor },
          });

          if (project?.id) {
            trackDVRTransfer(project.id);
          }

          sentCount++;
        }
      } catch (e) {
        console.error('Erreur DVR:', e);
      }
    }

    // Sauvegarder pour undo
    undoStack.push(undoAction);
    if (undoStack.length > 5) undoStack.shift();

    setShowComparisonMode(false);

    // Toast
    const messages: string[] = [];
    if (deletedCount > 0) messages.push(`${deletedCount} supprimé${deletedCount > 1 ? 's' : ''}`);
    if (sentCount > 0) messages.push(`${sentCount} → DVR`);
    
    toast.success(messages.join(' • '), {
      description: '⌘Z pour annuler (1 min)',
      duration: 5000,
    });

  }, [getNodes, deleteElements, updateNodeData, project?.id]);

  if (selectedMedia.length < 2 && !showComparisonMode) {
    return null;
  }

  const videoCount = selectedMedia.filter(m => m.type === 'video').length;
  const imageCount = selectedMedia.filter(m => m.type === 'image').length;
  
  let mediaLabel = '';
  if (videoCount > 0 && imageCount > 0) {
    mediaLabel = `${selectedMedia.length} éléments`;
  } else if (videoCount > 0) {
    mediaLabel = `${videoCount} vidéo${videoCount > 1 ? 's' : ''}`;
  } else {
    mediaLabel = `${imageCount} image${imageCount > 1 ? 's' : ''}`;
  }

  return (
    <>
      {selectedMedia.length >= 2 && !showComparisonMode && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none animate-in fade-in zoom-in duration-300">
          <div className="bg-black/90 backdrop-blur-sm text-white px-6 py-3 rounded-xl text-base flex items-center gap-3 border border-white/20 shadow-xl shadow-black/50">
            <kbd className="bg-white/10 text-white/80 px-3 py-1 rounded text-sm font-mono border border-white/20">ESPACE</kbd>
            <span className="text-white/70">comparer {mediaLabel}</span>
          </div>
        </div>
      )}

      {showComparisonMode && (
        <MediaComparisonMode
          media={selectedMedia}
          onClose={() => setShowComparisonMode(false)}
          onConfirm={handleConfirm}
        />
      )}
    </>
  );
}
