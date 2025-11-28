'use client';

import { Logo } from '@/components/logo';
import { getLocalProjectById } from '@/lib/local-projects-store';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface LocalCanvasHeaderProps {
  projectId: string;
}

export function LocalCanvasHeader({ projectId }: LocalCanvasHeaderProps) {
  const [projectName, setProjectName] = useState('');

  useEffect(() => {
    const project = getLocalProjectById(projectId);
    if (project) {
      setProjectName(project.name);
    }
  }, [projectId]);

  return (
    <div className="pointer-events-none fixed left-0 right-0 top-0 z-50 flex items-center justify-center p-4">
      {/* Logo + Nom du projet - lien vers la liste des projets */}
      <Link 
        href="/local/projects" 
        className="pointer-events-auto flex items-center gap-3 rounded-lg bg-background/80 px-4 py-2 backdrop-blur transition-colors hover:bg-background"
      >
        <Logo className="h-6 w-6" />
        <span className="font-semibold">{projectName || 'Untitled'}</span>
      </Link>
    </div>
  );
}

