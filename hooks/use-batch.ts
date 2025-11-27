/**
 * Hook React pour le Batch Processing
 * Simplifie l'utilisation du système de batch dans les composants
 */

import { useState, useCallback, useEffect } from 'react';
import type { BatchJob, BatchJobResult, BatchSettings } from '@/lib/batch';

type UseBatchOptions = {
  nodeId: string;
  type: 'video' | 'image' | 'audio';
  onComplete?: (results: BatchJobResult[]) => void;
  onError?: (error: Error) => void;
  pollInterval?: number;
};

type UseBatchReturn = {
  // État
  job: BatchJob | null;
  isLoading: boolean;
  isRunning: boolean;
  progress: number;
  results: BatchJobResult[];
  
  // Actions
  startBatch: (settings: Partial<BatchSettings>, count: number) => Promise<void>;
  cancelBatch: () => Promise<void>;
  clearJob: () => void;
  
  // Helpers
  successfulResults: BatchJobResult[];
  failedResults: BatchJobResult[];
};

export function useBatch({
  nodeId,
  type,
  onComplete,
  onError,
  pollInterval = 2000,
}: UseBatchOptions): UseBatchReturn {
  const [job, setJob] = useState<BatchJob | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Calculer les états dérivés
  const isRunning = job?.status === 'running';
  const progress = job
    ? ((job.completedCount + job.failedCount) / job.totalCount) * 100
    : 0;
  const results = job?.results || [];
  const successfulResults = results.filter(r => r.status === 'completed' && r.result);
  const failedResults = results.filter(r => r.status === 'failed');

  // Polling du statut
  useEffect(() => {
    if (!job || !isRunning) return;

    const poll = async () => {
      try {
        const response = await fetch(`/api/batch?jobId=${job.id}`);
        if (response.ok) {
          const { job: updatedJob } = await response.json();
          setJob(updatedJob);

          // Notifier si terminé
          if (updatedJob.status === 'completed' || updatedJob.status === 'failed') {
            onComplete?.(updatedJob.results);
          }
        }
      } catch (error) {
        console.error('Erreur polling batch:', error);
      }
    };

    const intervalId = setInterval(poll, pollInterval);
    return () => clearInterval(intervalId);
  }, [job, isRunning, pollInterval, onComplete]);

  // Démarrer un batch
  const startBatch = useCallback(
    async (settings: Partial<BatchSettings>, count: number) => {
      setIsLoading(true);
      try {
        const fullSettings: BatchSettings = {
          prompt: settings.prompt || '',
          model: settings.model || '',
          provider: settings.provider || '',
          count,
          ...settings,
        };

        const response = await fetch('/api/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nodeId,
            type,
            settings: fullSettings,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Erreur lors du démarrage du batch');
        }

        const { jobId } = await response.json();

        // Récupérer le job créé
        const jobResponse = await fetch(`/api/batch?jobId=${jobId}`);
        if (jobResponse.ok) {
          const { job: newJob } = await jobResponse.json();
          setJob(newJob);
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Erreur inconnue');
        onError?.(err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [nodeId, type, onError]
  );

  // Annuler un batch
  const cancelBatch = useCallback(async () => {
    if (!job) return;

    try {
      await fetch(`/api/batch?jobId=${job.id}`, {
        method: 'DELETE',
      });

      // Mettre à jour l'état local
      setJob(prev => prev ? { ...prev, status: 'cancelled' } : null);
    } catch (error) {
      console.error('Erreur annulation batch:', error);
    }
  }, [job]);

  // Effacer le job
  const clearJob = useCallback(() => {
    setJob(null);
  }, []);

  return {
    job,
    isLoading,
    isRunning,
    progress,
    results,
    startBatch,
    cancelBatch,
    clearJob,
    successfulResults,
    failedResults,
  };
}

