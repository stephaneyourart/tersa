'use client';

import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { getLocalProjectById } from '@/lib/local-projects-store';
import { CheckIcon, HomeIcon, Loader2Icon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface LocalCanvasHeaderProps {
  projectId: string;
}

export function LocalCanvasHeader({ projectId }: LocalCanvasHeaderProps) {
  const [projectName, setProjectName] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');

  useEffect(() => {
    const project = getLocalProjectById(projectId);
    if (project) {
      setProjectName(project.name);
    }
  }, [projectId]);

  // Écouter les événements d'auto-save
  useEffect(() => {
    const handleSaveStart = () => setSaveStatus('saving');
    const handleSaveEnd = () => {
      setSaveStatus('saved');
    };

    window.addEventListener('tersa-save-start', handleSaveStart);
    window.addEventListener('tersa-save-end', handleSaveEnd);

    return () => {
      window.removeEventListener('tersa-save-start', handleSaveStart);
      window.removeEventListener('tersa-save-end', handleSaveEnd);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed left-0 right-0 top-0 z-50 flex items-center justify-between p-4">
      {/* Logo - lien vers la liste des projets */}
      <Link 
        href="/local/projects" 
        className="pointer-events-auto flex items-center gap-3 rounded-lg bg-background/80 px-3 py-2 backdrop-blur transition-colors hover:bg-background"
      >
        <Logo className="h-6 w-6" />
        <span className="font-semibold">TersaFork</span>
      </Link>

      {/* Nom du projet + status de sauvegarde */}
      <div className="pointer-events-auto flex items-center gap-3 rounded-lg bg-background/80 px-4 py-2 backdrop-blur">
        <span className="text-sm font-medium">{projectName || 'Untitled'}</span>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {saveStatus === 'saving' ? (
            <>
              <Loader2Icon size={12} className="animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <CheckIcon size={12} className="text-green-500" />
              <span>Saved</span>
            </>
          )}
        </div>
      </div>

      {/* Bouton Home */}
      <Link href="/local/projects" className="pointer-events-auto">
        <Button variant="outline" size="icon" className="bg-background/80 backdrop-blur">
          <HomeIcon size={18} />
        </Button>
      </Link>
    </div>
  );
}

