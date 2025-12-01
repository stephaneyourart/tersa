'use client';

import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { ProjectSettingsDialog } from '@/components/project-settings';
import { getLocalProjectById } from '@/lib/local-projects-store';
import { useCleanupMode } from '@/providers/cleanup-mode';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SettingsIcon, Trash2Icon, XIcon, CheckIcon, BrainCircuitIcon } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface LocalCanvasHeaderProps {
  projectId: string;
}

export function LocalCanvasHeader({ projectId }: LocalCanvasHeaderProps) {
  const [projectName, setProjectName] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  
  const { 
    isCleanupMode, 
    startCleanupMode, 
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
          /* Mode normal */
          <div className="pointer-events-auto flex items-center gap-2">
            <Link 
              href="/local/projects" 
              className="flex items-center gap-3 rounded-lg bg-background/80 px-4 py-2 backdrop-blur transition-colors hover:bg-background"
            >
              <Logo className="h-6 w-6" />
              <span className="font-semibold">{projectName || 'Untitled'}</span>
            </Link>
            
            {/* Bouton Clean up */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={startCleanupMode}
                    className="h-9 w-9 rounded-lg bg-background/80 backdrop-blur hover:bg-red-600 hover:text-white"
                  >
                    <Trash2Icon size={18} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Nettoyer (supprimer plusieurs éléments)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {/* Bouton Settings */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowSettings(true)}
                    className="h-9 w-9 rounded-lg bg-background/80 backdrop-blur hover:bg-background"
                  >
                    <SettingsIcon size={18} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Settings du projet</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Bouton Global Models */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/settings/models">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-lg bg-background/80 backdrop-blur hover:bg-background"
                    >
                      <BrainCircuitIcon size={18} />
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Gérer les modèles IA</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>

      {/* Modale Settings */}
      <ProjectSettingsDialog
        projectId={projectId}
        open={showSettings}
        onOpenChange={setShowSettings}
      />
    </>
  );
}

