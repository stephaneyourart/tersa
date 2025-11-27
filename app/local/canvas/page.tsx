/**
 * Canvas local - Accès direct sans authentification
 * Uniquement disponible en mode LOCAL_MODE=true
 */

'use client';

import { Canvas } from '@/components/canvas';
import { Controls } from '@/components/controls';
import { Reasoning } from '@/components/reasoning';
import { SaveIndicator } from '@/components/save-indicator';
import { Toolbar } from '@/components/toolbar';
import { ProjectProvider } from '@/providers/project';

// Projet local par défaut
const localProject = {
  id: 'local-project',
  name: 'Projet Local',
  transcriptionModel: 'whisper-1',
  visionModel: 'gpt-4o',
  createdAt: new Date(),
  updatedAt: new Date(),
  content: null,
  userId: 'local-user-001',
  image: null,
  members: null,
  welcomeProject: false,
};

const LocalCanvasPage = () => {
  return (
    <div className="flex h-screen w-screen items-stretch overflow-hidden">
      <div className="relative flex-1">
        <ProjectProvider data={localProject}>
          <Canvas>
            <Controls />
            <Toolbar />
            <SaveIndicator />
          </Canvas>
        </ProjectProvider>
        {/* Header simplifié pour le mode local */}
        <div className="absolute left-4 top-4 z-10">
          <div className="flex items-center gap-3 rounded-lg bg-background/80 px-4 py-2 shadow-lg backdrop-blur">
            <span className="text-lg font-semibold">TersaFork</span>
            <span className="rounded bg-green-500/20 px-2 py-0.5 text-xs text-green-600">
              Mode Local
            </span>
          </div>
        </div>
      </div>
      <Reasoning />
    </div>
  );
};

export default LocalCanvasPage;

