/**
 * Bouton "Replace" pour remplacer le média (image/vidéo) d'un nœud
 * S'affiche au hover d'un nœud avec contenu - à gauche du compteur batch
 * 
 * IMPORTANT: Lors du remplacement, tous les nœuds en aval (outgoers) sont réinitialisés
 * car leur contenu généré dépend du média source qui vient de changer.
 */

'use client';

import { cn } from '@/lib/utils';
import { uploadFile } from '@/lib/upload';
import { handleError } from '@/lib/error/handle';
import { getOutgoers, useReactFlow } from '@xyflow/react';
import { RefreshCwIcon, Loader2Icon } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

type ReplaceMediaButtonProps = {
  nodeId: string;
  isVisible: boolean;
  mediaType: 'image' | 'video';
  onHoverChange?: (isHovered: boolean) => void;
  className?: string;
};

export function ReplaceMediaButton({
  nodeId,
  isVisible,
  mediaType,
  onHoverChange,
  className,
}: ReplaceMediaButtonProps) {
  const { updateNodeData, getNodes, getEdges, getNode } = useReactFlow();
  const [isUploading, setIsUploading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setIsHovered(true);
    onHoverChange?.(true);
  };

  const handleMouseLeave = () => {
    hideTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
      onHoverChange?.(false);
    }, 200);
  };

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Réinitialise récursivement tous les nœuds connectés en sortie (outgoers)
   * pour supprimer leur contenu généré qui doit être recalculé
   */
  const resetOutgoers = useCallback((startNodeId: string, visitedIds = new Set<string>()) => {
    // Éviter les boucles infinies
    if (visitedIds.has(startNodeId)) return;
    visitedIds.add(startNodeId);

    const nodes = getNodes();
    const edges = getEdges();
    const currentNode = nodes.find(n => n.id === startNodeId);
    
    if (!currentNode) return;

    // Trouver les nœuds directement connectés en sortie
    const outgoers = getOutgoers(currentNode, nodes, edges);

    for (const outgoer of outgoers) {
      // Réinitialiser le contenu généré de ce nœud
      updateNodeData(outgoer.id, {
        generated: undefined,
        generating: false,
        batchGenerating: false,
        generatingStartTime: undefined,
        batchStartTime: undefined,
      });

      // Récursivement réinitialiser les outgoers de ce nœud
      resetOutgoers(outgoer.id, visitedIds);
    }
  }, [getNodes, getEdges, updateNodeData]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    try {
      setIsUploading(true);

      // Upload du fichier
      const { url, type } = await uploadFile(file, 'files');

      // Mise à jour du nœud avec le nouveau média
      // On remplace le content (média uploadé) et on supprime generated (si c'était généré)
      updateNodeData(nodeId, {
        content: {
          url,
          type,
        },
        // Supprimer le contenu généré s'il existait
        generated: undefined,
      });

      // IMPORTANT: Réinitialiser tous les nœuds connectés en sortie
      // car leur contenu dépend de ce média qui vient de changer
      resetOutgoers(nodeId);

      toast.success('Média remplacé', {
        description: 'Les nœuds en aval ont été réinitialisés',
        duration: 3000,
      });

    } catch (error) {
      handleError('Erreur lors du remplacement', error);
    } finally {
      setIsUploading(false);
      // Reset l'input pour permettre de re-sélectionner le même fichier
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const shouldShow = isVisible || isHovered;
  const acceptTypes = mediaType === 'image' ? 'image/*' : 'video/*';

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptTypes}
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        onClick={handleClick}
        disabled={isUploading}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          'flex items-center justify-center',
          'w-7 h-7 rounded-full',
          'bg-zinc-800/90 backdrop-blur-sm shadow-lg',
          'text-white text-xs',
          'hover:bg-zinc-700 transition-all',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'transition-all duration-200',
          shouldShow ? 'opacity-100' : 'opacity-0 pointer-events-none',
          className
        )}
        title={`Remplacer ${mediaType === 'image' ? "l'image" : 'la vidéo'}`}
      >
        {isUploading ? (
          <Loader2Icon size={12} className="animate-spin" />
        ) : (
          <RefreshCwIcon size={12} />
        )}
      </button>
    </>
  );
}

