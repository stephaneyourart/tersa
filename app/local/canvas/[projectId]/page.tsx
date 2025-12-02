'use client';

import { Canvas } from '@/components/canvas';
import { Controls } from '@/components/controls';
import { LocalCanvasHeader } from '@/components/local-canvas-header';
import { Toolbar } from '@/components/toolbar';
import { CleanupDialogWrapper } from '@/components/cleanup-dialog-wrapper';
import { MediaLibrarySidebar } from '@/components/media-library-sidebar';
import { getLocalProjectById, updateLocalProject } from '@/lib/local-projects-store';
import { registerProjectMediaReferences } from '@/lib/media-references';
import { ProjectProvider } from '@/providers/project';
import { CleanupModeProvider } from '@/providers/cleanup-mode';
import { Loader2Icon } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Edge, Node, Viewport } from '@xyflow/react';

export default function LocalCanvasPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  
  const [loading, setLoading] = useState(true);
  const [initialData, setInitialData] = useState<{
    nodes: Node[];
    edges: Edge[];
    viewport: Viewport;
  } | null>(null);
  
  // Ref pour l'auto-save
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<string>('');

  // Charger le projet
  useEffect(() => {
    const project = getLocalProjectById(projectId);
    
    if (!project) {
      // Projet non trouvé, rediriger vers la liste
      router.push('/local/projects');
      return;
    }
    
    const loadedViewport = (project.data.viewport || { x: 0, y: 0, zoom: 1 }) as Viewport;
    console.log('[LocalCanvas] Loading project with viewport:', loadedViewport);
    
    setInitialData({
      nodes: (project.data.nodes || []) as Node[],
      edges: (project.data.edges || []) as Edge[],
      viewport: loadedViewport,
    });
    
    // Simuler un petit délai pour le spinner
    setTimeout(() => setLoading(false), 300);
  }, [projectId, router]);

  // Auto-save callback
  const handleAutoSave = useCallback((nodes: Node[], edges: Edge[], viewport: Viewport) => {
    // Créer un hash simple pour détecter les changements
    const currentState = JSON.stringify({ nodes, edges, viewport });
    
    if (currentState === lastSavedRef.current) {
      return; // Pas de changement
    }
    
    // Debounce l'auto-save
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    autoSaveTimeoutRef.current = setTimeout(() => {
      console.log('[Auto-save] Saving viewport:', viewport);
      updateLocalProject(projectId, {
        data: { nodes, edges, viewport },
      });
      
      // Enregistrer les références aux médias
      registerProjectMediaReferences(projectId, nodes);
      
      lastSavedRef.current = currentState;
      console.log('[Auto-save] Project saved with', nodes.length, 'nodes');
    }, 500); // Save après 500ms d'inactivité (plus réactif)
  }, [projectId]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  // Bloquer les gestes de navigation du navigateur (swipe back/forward)
  useEffect(() => {
    // Bloquer le swipe horizontal pour navigation
    const preventNavigation = (e: WheelEvent) => {
      // Si c'est un scroll horizontal significatif, bloquer
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 10) {
        e.preventDefault();
      }
    };

    // Bloquer aussi les touch events pour swipe
    const preventTouchNavigation = (e: TouchEvent) => {
      if (e.touches.length > 1) return; // Permettre pinch-to-zoom
      // Le canvas gère ses propres touch events
    };

    document.addEventListener('wheel', preventNavigation, { passive: false });
    
    return () => {
      document.removeEventListener('wheel', preventNavigation);
    };
  }, []);

  if (loading || !initialData) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2Icon className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  // Créer un objet projet pour le ProjectProvider
  const localProjectData = {
    id: projectId,
    name: getLocalProjectById(projectId)?.name || 'Untitled',
    transcriptionModel: 'whisper-1',
    visionModel: 'gpt-4o',
    createdAt: new Date(),
    updatedAt: new Date(),
    content: { nodes: initialData.nodes, edges: initialData.edges },
    userId: 'local-user',
    image: null,
    members: null,
    welcomeProject: false,
  };

  return (
    <ProjectProvider data={localProjectData}>
      <CleanupModeProvider>
        <div className="h-screen w-screen">
          <LocalCanvasHeader projectId={projectId} />
          <Canvas 
            initialNodes={initialData.nodes}
            initialEdges={initialData.edges}
            initialViewport={initialData.viewport}
            onAutoSave={handleAutoSave}
          >
            <Controls />
            <Toolbar />
            <CleanupDialogWrapper />
          </Canvas>
          <MediaLibrarySidebar />
        </div>
      </CleanupModeProvider>
    </ProjectProvider>
  );
}

