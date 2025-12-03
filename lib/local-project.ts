/**
 * Gestion du projet local (sans base de données)
 */

import { visionModels } from './models/vision';
import { transcriptionModels } from './models/transcription';

// Mode local
export const isLocalMode = process.env.LOCAL_MODE === 'true';
export const LOCAL_PROJECT_ID = 'local-project';

// Trouver le modèle de vision par défaut
const defaultVisionModel = Object.entries(visionModels).find(
  ([_, model]) => model.default
);

// Trouver le modèle de transcription par défaut
const defaultTranscriptionModel = Object.entries(transcriptionModels).find(
  ([_, model]) => model.default
);

/**
 * Projet local simulé (pas stocké en BDD)
 */
export const localProject = {
  id: LOCAL_PROJECT_ID,
  name: 'Local Project',
  userId: process.env.LOCAL_USER_ID || 'local-user-001',
  visionModel: defaultVisionModel?.[0] || 'gpt-4.1-mini',
  transcriptionModel: defaultTranscriptionModel?.[0] || 'whisper-1',
  content: {
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

/**
 * Vérifie si c'est un projet local
 * - En mode local, TOUS les projets commençant par "project-" ou "local" sont locaux
 */
export function isLocalProject(projectId: string): boolean {
  if (!isLocalMode) return false;
  
  // En mode local, reconnaître les projets générés dynamiquement
  return projectId === LOCAL_PROJECT_ID || 
         projectId.startsWith('project-') || 
         projectId.startsWith('local-');
}

/**
 * Obtenir le projet local (simule la requête BDD)
 */
export function getLocalProject() {
  return localProject;
}

