/**
 * Hook pour tracker les générations
 */

import { addGeneration, type GenerationType } from '@/lib/generations-store';
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
    
    addGeneration({
      ...params,
      fileSize,
      projectId: project?.id,
      projectName: project?.name,
    });
  }, [project?.id, project?.name]);
  
  return { trackGeneration };
}

