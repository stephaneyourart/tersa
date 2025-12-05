/**
 * Système de Batch Processing pour TersaFork
 * Permet d'exécuter N runs en parallèle avec contrôle de concurrence
 */

import { nanoid } from 'nanoid';
import { saveFromUrl, saveBase64 } from '../storage-local';

// Configuration par défaut
const DEFAULT_MAX_CONCURRENCY = 10;
const DEFAULT_TIMEOUT = 720000; // 12 minutes

// Types
export type BatchJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export type BatchJobResult = {
  id: string;
  index: number;
  status: BatchJobStatus;
  result?: string; // URL ou chemin du résultat
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number; // en ms
};

export type BatchJob = {
  id: string;
  nodeId: string;
  status: BatchJobStatus;
  totalCount: number;
  completedCount: number;
  failedCount: number;
  results: BatchJobResult[];
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  settings: BatchSettings;
};

export type BatchSettings = {
  prompt: string;
  inputs?: {
    imageUrl?: string;
    audioUrl?: string;
    videoUrl?: string;
  };
  model: string;
  provider: string;
  count: number;
  maxConcurrency?: number;
  timeout?: number;
  seed?: number;
  // Paramètres spécifiques au modèle
  resolution?: string;
  aspectRatio?: string;
  duration?: number;
  [key: string]: unknown;
};

export type GenerateFunction = (
  settings: BatchSettings,
  index: number
) => Promise<string>;

// Store en mémoire des jobs (à remplacer par DB si nécessaire)
const jobStore = new Map<string, BatchJob>();

/**
 * Crée un nouveau batch job
 */
export function createBatchJob(
  nodeId: string,
  settings: BatchSettings
): BatchJob {
  const id = nanoid();
  const job: BatchJob = {
    id,
    nodeId,
    status: 'pending',
    totalCount: settings.count,
    completedCount: 0,
    failedCount: 0,
    results: Array.from({ length: settings.count }, (_, i) => ({
      id: nanoid(),
      index: i,
      status: 'pending',
    })),
    createdAt: new Date(),
    settings,
  };

  jobStore.set(id, job);
  return job;
}

/**
 * Obtient un job par son ID
 */
export function getBatchJob(jobId: string): BatchJob | undefined {
  return jobStore.get(jobId);
}

/**
 * Met à jour un job
 */
function updateJob(jobId: string, updates: Partial<BatchJob>): void {
  const job = jobStore.get(jobId);
  if (job) {
    jobStore.set(jobId, { ...job, ...updates });
  }
}

/**
 * Exécute un batch avec contrôle de concurrence
 */
export async function executeBatch(
  job: BatchJob,
  generateFn: GenerateFunction,
  onProgress?: (job: BatchJob) => void
): Promise<BatchJob> {
  const maxConcurrency = job.settings.maxConcurrency ?? 
    parseInt(process.env.BATCH_MAX_CONCURRENCY || String(DEFAULT_MAX_CONCURRENCY));
  const timeout = job.settings.timeout ?? 
    parseInt(process.env.BATCH_REQUEST_TIMEOUT || String(DEFAULT_TIMEOUT));

  // Marquer comme en cours
  updateJob(job.id, { status: 'running', startedAt: new Date() });
  job = getBatchJob(job.id)!;
  onProgress?.(job);

  // Créer une queue de tâches
  const queue = [...job.results];
  const running: Promise<void>[] = [];

  /**
   * Exécute une seule tâche avec timeout
   */
  async function executeTask(result: BatchJobResult): Promise<void> {
    const index = result.index;
    
    // Marquer comme en cours
    result.status = 'running';
    result.startedAt = new Date();
    updateJob(job.id, { results: job.results });
    onProgress?.(getBatchJob(job.id)!);

    try {
      // Créer une promesse avec timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout dépassé')), timeout);
      });

      // Exécuter avec un seed unique si spécifié
      const settingsWithSeed = {
        ...job.settings,
        seed: job.settings.seed !== undefined 
          ? job.settings.seed + index 
          : undefined,
      };

      const resultUrl = await Promise.race([
        generateFn(settingsWithSeed, index),
        timeoutPromise,
      ]);

      // Sauvegarder le résultat localement
      const storedFile = await saveFromUrl(resultUrl, `batch-${job.id}-${index}`);

      result.status = 'completed';
      result.result = storedFile.path;
      result.completedAt = new Date();
      result.duration = result.completedAt.getTime() - result.startedAt!.getTime();

      const updatedJob = getBatchJob(job.id)!;
      updateJob(job.id, { 
        completedCount: updatedJob.completedCount + 1,
        results: updatedJob.results,
      });

    } catch (error) {
      result.status = 'failed';
      result.error = error instanceof Error ? error.message : 'Erreur inconnue';
      result.completedAt = new Date();
      result.duration = result.completedAt.getTime() - result.startedAt!.getTime();

      const updatedJob = getBatchJob(job.id)!;
      updateJob(job.id, { 
        failedCount: updatedJob.failedCount + 1,
        results: updatedJob.results,
      });
    }

    onProgress?.(getBatchJob(job.id)!);
  }

  /**
   * Traite la queue avec contrôle de concurrence
   */
  async function processQueue(): Promise<void> {
    while (queue.length > 0 || running.length > 0) {
      // Vérifier si le job a été annulé
      const currentJob = getBatchJob(job.id);
      if (currentJob?.status === 'cancelled') {
        break;
      }

      // Lancer de nouvelles tâches jusqu'à maxConcurrency
      while (running.length < maxConcurrency && queue.length > 0) {
        const result = queue.shift()!;
        const task = executeTask(result).then(() => {
          const idx = running.indexOf(task);
          if (idx > -1) running.splice(idx, 1);
        });
        running.push(task);
      }

      // Attendre qu'au moins une tâche se termine
      if (running.length > 0) {
        await Promise.race(running);
      }
    }
  }

  await processQueue();

  // Marquer comme terminé
  const finalJob = getBatchJob(job.id)!;
  const finalStatus: BatchJobStatus = finalJob.status === 'cancelled' 
    ? 'cancelled' 
    : finalJob.failedCount === finalJob.totalCount 
      ? 'failed' 
      : 'completed';

  updateJob(job.id, { 
    status: finalStatus,
    completedAt: new Date(),
  });

  return getBatchJob(job.id)!;
}

/**
 * Annule un batch job
 */
export function cancelBatchJob(jobId: string): boolean {
  const job = jobStore.get(jobId);
  if (!job || job.status === 'completed' || job.status === 'failed') {
    return false;
  }

  updateJob(jobId, { status: 'cancelled' });
  return true;
}

/**
 * Liste tous les jobs pour un noeud
 */
export function getJobsForNode(nodeId: string): BatchJob[] {
  return Array.from(jobStore.values())
    .filter(job => job.nodeId === nodeId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Nettoie les jobs terminés plus vieux que maxAge (en ms)
 */
export function cleanupOldJobs(maxAge: number = 24 * 60 * 60 * 1000): number {
  const now = Date.now();
  let deletedCount = 0;

  for (const [id, job] of jobStore.entries()) {
    if (
      (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') &&
      job.completedAt &&
      now - job.completedAt.getTime() > maxAge
    ) {
      jobStore.delete(id);
      deletedCount++;
    }
  }

  return deletedCount;
}

/**
 * Export le store pour debug/tests
 */
export function getAllJobs(): BatchJob[] {
  return Array.from(jobStore.values());
}

