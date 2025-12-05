'use client';

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
import { trackDeletion } from '@/lib/local-projects-store';
import { removeMediaReference } from '@/lib/media-references';
import type { Node } from '@xyflow/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2Icon, AlertTriangleIcon } from 'lucide-react';

interface CleanupConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedNodes: Set<string>;
  onConfirm: () => void;
  getNodes: () => Node[];
  deleteElements: (params: { nodes: { id: string }[] }) => void;
  projectId?: string;
}

export function CleanupConfirmDialog({
  open,
  onOpenChange,
  selectedNodes,
  onConfirm,
  getNodes,
  deleteElements,
  projectId,
}: CleanupConfirmDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    if (selectedNodes.size === 0) return;

    setIsDeleting(true);
    const nodes = getNodes();
    const nodesToDelete = nodes.filter(n => selectedNodes.has(n.id));
    
    let deletedFiles = 0;
    let failedFiles = 0;
    let generatedCount = 0;

    let keptFiles = 0; // Fichiers conservés car utilisés ailleurs
    
    // Supprimer les fichiers locaux de chaque nœud (si pas utilisés ailleurs)
    for (const node of nodesToDelete) {
      const nodeData = node.data as any;
      const localPath = nodeData?.localPath as string | undefined;
      const contentUrl = (nodeData?.content?.url || nodeData?.generated?.url) as string | undefined;
      const filePath = localPath || contentUrl;
      const isGenerated = Boolean(nodeData?.isGenerated);
      
      if (isGenerated) {
        generatedCount++;
      }
      
      if (filePath && projectId) {
        // Vérifier si d'autres projets utilisent ce fichier
        const canDelete = removeMediaReference(filePath, projectId);
        
        if (canDelete) {
          // Aucun autre projet n'utilise ce fichier, on peut le supprimer
          try {
            const response = await fetch('/api/delete-local', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filePath }),
            });
            
            if (response.ok) {
              deletedFiles++;
            } else {
              failedFiles++;
              console.warn('Échec suppression fichier:', filePath);
            }
          } catch (error) {
            failedFiles++;
            console.error('Erreur suppression fichier:', error);
          }
        } else {
          // Le fichier est utilisé par d'autres projets
          keptFiles++;
        }
      }
    }
    
    // Tracker les suppressions dans les stats du projet
    if (projectId && generatedCount > 0) {
      for (let i = 0; i < generatedCount; i++) {
        trackDeletion(projectId);
      }
    }

    // Supprimer les nœuds du canvas
    deleteElements({
      nodes: nodesToDelete.map(n => ({ id: n.id })),
    });

    setIsDeleting(false);
    onOpenChange(false);
    onConfirm();

    // Toast de confirmation
    const parts = [];
    if (deletedFiles > 0) {
      parts.push(`${deletedFiles} fichier${deletedFiles > 1 ? 's' : ''} supprimé${deletedFiles > 1 ? 's' : ''}`);
    }
    if (keptFiles > 0) {
      parts.push(`${keptFiles} conservé${keptFiles > 1 ? 's' : ''} (utilisé${keptFiles > 1 ? 's' : ''} ailleurs)`);
    }
    if (failedFiles > 0) {
      parts.push(`${failedFiles} échec${failedFiles > 1 ? 's' : ''}`);
    }
    
    if (failedFiles > 0) {
      toast.warning(`${nodesToDelete.length} nœuds supprimés`, {
        description: parts.join(', '),
      });
    } else {
      toast.success(`${nodesToDelete.length} éléments supprimés`, {
        description: parts.length > 0 ? parts.join(', ') : undefined,
      });
    }
  };

  const count = selectedNodes.size;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangleIcon size={20} />
            Confirmer la suppression
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base">
            Vous êtes sur le point de supprimer <strong>{count} élément{count > 1 ? 's' : ''}</strong> du projet 
            et de votre disque dur.
            <br />
            <br />
            <span className="text-red-500 font-medium">
              Cette action est irréversible.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700"
          >
            {isDeleting ? (
              <>
                <Loader2Icon size={16} className="animate-spin mr-2" />
                Suppression...
              </>
            ) : (
              `Supprimer ${count} élément${count > 1 ? 's' : ''}`
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

