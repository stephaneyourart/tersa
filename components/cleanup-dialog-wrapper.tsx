'use client';

import { CleanupConfirmDialog } from '@/components/cleanup-confirm-dialog';
import { useCleanupMode } from '@/providers/cleanup-mode';
import { useProject } from '@/providers/project';
import { useReactFlow } from '@xyflow/react';
import { useState, useEffect } from 'react';

/**
 * Ce composant doit être rendu à l'intérieur du ReactFlowProvider
 * Il écoute un événement custom pour ouvrir le dialog de confirmation
 */
export function CleanupDialogWrapper() {
  const [showDialog, setShowDialog] = useState(false);
  const { selectedForCleanup, exitCleanupMode } = useCleanupMode();
  const { getNodes, deleteElements } = useReactFlow();
  const project = useProject();

  // Écouter l'événement pour ouvrir le dialog
  useEffect(() => {
    const handleOpenDialog = () => {
      setShowDialog(true);
    };

    window.addEventListener('open-cleanup-dialog', handleOpenDialog);
    return () => {
      window.removeEventListener('open-cleanup-dialog', handleOpenDialog);
    };
  }, []);

  return (
    <CleanupConfirmDialog
      open={showDialog}
      onOpenChange={setShowDialog}
      selectedNodes={selectedForCleanup}
      onConfirm={exitCleanupMode}
      getNodes={getNodes}
      deleteElements={deleteElements}
      projectId={project?.id}
    />
  );
}

