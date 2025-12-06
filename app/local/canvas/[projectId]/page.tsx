'use client';

import { Canvas } from '@/components/canvas';
import { Controls } from '@/components/controls';
import { LocalCanvasHeader } from '@/components/local-canvas-header';
import { Toolbar } from '@/components/toolbar';
import { CleanupDialogWrapper } from '@/components/cleanup-dialog-wrapper';
import { MediaLibrarySidebar } from '@/components/media-library-sidebar';
import { GenerationPanel } from '@/components/generation-panel';
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
  const [testMode, setTestMode] = useState(false); // Mode test défini lors de la génération du projet
  
  // NOUVEAU: Modèles de génération sélectionnés par l'utilisateur
  const [generationModels, setGenerationModels] = useState<{
    t2iModel?: string;
    i2iModel?: string;
    videoModel?: string;
    t2iResolution?: string;
    i2iResolution?: string;
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
    
    // Lire le mode test défini lors de la génération du projet
    const projectTestMode = (project.data as { testMode?: boolean }).testMode === true;
    console.log('[LocalCanvas] Mode Test:', projectTestMode);
    setTestMode(projectTestMode);
    
    // NOUVEAU: Lire les modèles de génération sélectionnés par l'utilisateur
    const projectGenerationModels = (project.data as { generationModels?: {
      t2iModel?: string;
      i2iModel?: string;
      videoModel?: string;
      t2iResolution?: string;
      i2iResolution?: string;
    } }).generationModels;
    if (projectGenerationModels) {
      console.log('[LocalCanvas] Modèles de génération:', projectGenerationModels);
      setGenerationModels(projectGenerationModels);
    }
    
    setInitialData({
      nodes: (project.data.nodes || []) as Node[],
      edges: (project.data.edges || []) as Edge[],
      viewport: loadedViewport,
    });
    
    // Simuler un petit délai pour le spinner
    setTimeout(() => setLoading(false), 300);
  }, [projectId, router]);

  // Auto-save callback - OPTIMISÉ pour éviter JSON.stringify coûteux
  const lastNodeCountRef = useRef(0);
  const lastEdgeCountRef = useRef(0);
  const lastViewportRef = useRef<Viewport | null>(null);
  const pendingNodesRef = useRef<Node[]>([]);
  const pendingEdgesRef = useRef<Edge[]>([]);
  
  const handleAutoSave = useCallback((nodes: Node[], edges: Edge[], viewport: Viewport) => {
    // Comparaison LÉGÈRE au lieu de JSON.stringify de 224 nœuds
    const viewportChanged = !lastViewportRef.current || 
      Math.abs(viewport.x - lastViewportRef.current.x) > 1 ||
      Math.abs(viewport.y - lastViewportRef.current.y) > 1 ||
      Math.abs(viewport.zoom - lastViewportRef.current.zoom) > 0.01;
    
    const structureChanged = 
      nodes.length !== lastNodeCountRef.current || 
      edges.length !== lastEdgeCountRef.current;
    
    // Si rien n'a changé significativement, ignorer
    if (!viewportChanged && !structureChanged && pendingNodesRef.current.length === 0) {
      return;
    }
    
    // Stocker les références pour la sauvegarde différée
    pendingNodesRef.current = nodes;
    pendingEdgesRef.current = edges;
    
    // Debounce l'auto-save
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    autoSaveTimeoutRef.current = setTimeout(() => {
      const nodesToSave = pendingNodesRef.current;
      const edgesToSave = pendingEdgesRef.current;
      
      updateLocalProject(projectId, {
        data: { nodes: nodesToSave, edges: edgesToSave, viewport },
      });
      
      // Enregistrer les références aux médias (seulement si structure changée)
      if (structureChanged) {
        registerProjectMediaReferences(projectId, nodesToSave);
      }
      
      // Mettre à jour les références de comparaison
      lastNodeCountRef.current = nodesToSave.length;
      lastEdgeCountRef.current = edgesToSave.length;
      lastViewportRef.current = viewport;
      pendingNodesRef.current = [];
      pendingEdgesRef.current = [];
    }, 1000); // Augmenté à 1s pour réduire la fréquence
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
  // ET le zoom du navigateur (Cmd+scroll) qui est souvent déclenché par erreur
  useEffect(() => {
    // Bloquer le swipe horizontal pour navigation ET le zoom navigateur
    const preventNavigation = (e: WheelEvent) => {
      // Bloquer le zoom navigateur (Cmd/Ctrl + scroll)
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        return;
      }
      
      // Si c'est un scroll horizontal significatif, bloquer
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 10) {
        e.preventDefault();
      }
    };

    // Bloquer aussi Cmd+Plus/Minus pour le zoom navigateur
    const preventKeyboardZoom = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
        e.preventDefault();
      }
    };

    document.addEventListener('wheel', preventNavigation, { passive: false });
    document.addEventListener('keydown', preventKeyboardZoom);
    
    return () => {
      document.removeEventListener('wheel', preventNavigation);
      document.removeEventListener('keydown', preventKeyboardZoom);
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
            <GenerationPanel 
              projectId={projectId} 
              testMode={testMode}
              generationModels={generationModels}
            />
          </Canvas>
          <MediaLibrarySidebar />
        </div>
      </CleanupModeProvider>
    </ProjectProvider>
  );
}

