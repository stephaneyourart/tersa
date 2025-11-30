/**
 * Hook pour tracker les générations
 */

import { addGeneration, type GenerationType } from '@/lib/generations-store';
import { trackGeneration as trackProjectGeneration } from '@/lib/local-projects-store';
import { useProject } from '@/providers/project';
import { useCallback } from 'react';

type TrackGenerationParams = {
  type: GenerationType;
  model: string;
  modelLabel?: string;
  prompt?: string;
  duration: number;
  cost: number;
  status: 'success' | 'error';
  error?: string;
  outputUrl?: string;
  outputText?: string;
  nodeId?: string;
  nodeName?: string; // Nom personnalisé du nœud
  inputTokens?: number;
  outputTokens?: number;
  size?: string;
  fileSize?: number; // Taille du fichier en bytes
  videoDuration?: number;
};

/**
 * Détermine le service/API depuis le modelId
 */
function getServiceFromModel(modelId: string): string {
  const id = modelId.toLowerCase();
  if (id.includes('wavespeed')) return 'wavespeed';
  if (id.includes('fal')) return 'fal';
  if (id.includes('replicate')) return 'replicate';
  if (id.includes('openai') || id.includes('gpt') || id.includes('dall-e')) return 'openai';
  if (id.includes('runway')) return 'runway';
  if (id.includes('luma')) return 'luma';
  if (id.includes('minimax')) return 'minimax';
  if (id.includes('kling')) return 'kling';
  if (id.includes('anthropic') || id.includes('claude')) return 'anthropic';
  return 'other';
}

/**
 * Récupère la taille d'un fichier via une requête HEAD
 */
async function getFileSize(url: string): Promise<number | undefined> {
  try {
    // Uniquement pour les URLs locales (api/storage)
    if (!url.startsWith('/api/storage')) {
      return undefined;
    }
    
    const response = await fetch(url, { method: 'HEAD' });
    if (!response.ok) return undefined;
    
    const contentLength = response.headers.get('content-length');
    return contentLength ? parseInt(contentLength, 10) : undefined;
  } catch {
    return undefined;
  }
}

export function useGenerationTracker() {
  const project = useProject();
  
  const trackGeneration = useCallback(async (params: TrackGenerationParams) => {
    // Récupérer la taille du fichier si pas fournie et qu'on a une URL
    let fileSize = params.fileSize;
    if (!fileSize && params.outputUrl && params.status === 'success') {
      fileSize = await getFileSize(params.outputUrl);
    }
    
    // Tracker dans le store des générations (dashboard)
    addGeneration({
      ...params,
      fileSize,
      projectId: project?.id,
      projectName: project?.name,
    });
    
    // Tracker dans les stats du projet (persistées même après suppression)
    if (project?.id && params.status === 'success') {
      // Déterminer le service depuis le modèle
      const service = getServiceFromModel(params.model);
      
      trackProjectGeneration(project.id, {
        type: params.type as 'image' | 'video' | 'audio',
        model: params.model,
        service,
        cost: params.cost,
      });
    }
  }, [project?.id, project?.name]);
  
  return { trackGeneration };
}

