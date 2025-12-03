'use client';

import { Button } from '@/components/ui/button';
import { getLocalProjectById } from '@/lib/local-projects-store';
import { useCleanupMode } from '@/providers/cleanup-mode';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Trash2Icon, XIcon, CheckIcon } from 'lucide-react';

interface LocalCanvasHeaderProps {
  projectId: string;
}

export function LocalCanvasHeader({ projectId }: LocalCanvasHeaderProps) {
  const [projectName, setProjectName] = useState('');
  
  const { 
    isCleanupMode, 
    exitCleanupMode, 
    getSelectedCount,
  } = useCleanupMode();
  
  // Ouvrir le dialog via un événement (le dialog est rendu dans le Canvas)
  const openConfirmDialog = () => {
    window.dispatchEvent(new CustomEvent('open-cleanup-dialog'));
  };

  useEffect(() => {
    const project = getLocalProjectById(projectId);
    if (project) {
      setProjectName(project.name);
    }
  }, [projectId]);

  const selectedCount = getSelectedCount();

  return (
    <>
      <div className="pointer-events-none fixed left-0 right-0 top-0 z-50 flex items-center justify-center p-4">
        {/* Mode Cleanup actif */}
        {isCleanupMode ? (
          <div className="pointer-events-auto flex items-center gap-2 rounded-lg bg-red-900/90 px-4 py-2 backdrop-blur">
            <Trash2Icon size={18} className="text-red-400" />
            <span className="font-medium text-white">
              Mode nettoyage : {selectedCount} élément{selectedCount > 1 ? 's' : ''} sélectionné{selectedCount > 1 ? 's' : ''}
            </span>
            
            {/* Bouton Valider */}
            <Button
              variant="ghost"
              size="sm"
              onClick={openConfirmDialog}
              disabled={selectedCount === 0}
              className="ml-2 gap-1 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              <CheckIcon size={16} />
              Supprimer
            </Button>
            
            {/* Bouton Annuler */}
            <Button
              variant="ghost"
              size="sm"
              onClick={exitCleanupMode}
              className="gap-1 text-white/80 hover:bg-red-800 hover:text-white"
            >
              <XIcon size={16} />
              Annuler
            </Button>
          </div>
        ) : (
          /* Mode normal - nom du projet discret */
          <Link 
            href="/local/projects" 
            className="pointer-events-auto rounded-md px-3 py-1.5 text-sm text-muted-foreground/60 transition-colors hover:text-foreground hover:bg-background/50"
          >
            {projectName || 'Untitled'}
          </Link>
        )}
      </div>

    </>
  );
}

