/**
 * Panneau de Batch Processing pour les nœuds
 * Permet de lancer N runs en parallèle
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Play,
  Square,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
} from 'lucide-react';
import type { BatchJob, BatchJobResult, BatchSettings } from '@/lib/batch';

type BatchPanelProps = {
  nodeId: string;
  type: 'video' | 'image' | 'audio';
  getSettings: () => Partial<BatchSettings>;
  onResultsReceived?: (results: BatchJobResult[]) => void;
};

export function BatchPanel({
  nodeId,
  type,
  getSettings,
  onResultsReceived,
}: BatchPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [count, setCount] = useState(4);
  const [maxConcurrency, setMaxConcurrency] = useState(10);
  const [currentJob, setCurrentJob] = useState<BatchJob | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Polling du statut du job
  useEffect(() => {
    if (!currentJob || currentJob.status === 'completed' || currentJob.status === 'failed' || currentJob.status === 'cancelled') {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/batch?jobId=${currentJob.id}`);
        if (response.ok) {
          const { job } = await response.json();
          setCurrentJob(job);

          // Notifier les résultats si terminé
          if (job.status === 'completed' || job.status === 'failed') {
            onResultsReceived?.(job.results);
          }
        }
      } catch (error) {
        console.error('Erreur polling batch:', error);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [currentJob, onResultsReceived]);

  const handleStartBatch = async () => {
    setIsLoading(true);
    try {
      const baseSettings = getSettings();
      const settings: BatchSettings = {
        ...baseSettings,
        count,
        maxConcurrency,
        prompt: baseSettings.prompt || '',
        model: baseSettings.model || '',
        provider: baseSettings.provider || '',
      };

      const response = await fetch('/api/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId,
          type,
          settings,
        }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors du démarrage du batch');
      }

      const { jobId } = await response.json();

      // Récupérer le job créé
      const jobResponse = await fetch(`/api/batch?jobId=${jobId}`);
      if (jobResponse.ok) {
        const { job } = await jobResponse.json();
        setCurrentJob(job);
      }
    } catch (error) {
      console.error('Erreur batch:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelBatch = async () => {
    if (!currentJob) return;

    try {
      await fetch(`/api/batch?jobId=${currentJob.id}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Erreur annulation:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const progress = currentJob
    ? ((currentJob.completedCount + currentJob.failedCount) / currentJob.totalCount) * 100
    : 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between border-t border-border/50 rounded-none"
        >
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            <span className="text-xs font-medium">Batch Processing</span>
            {currentJob && currentJob.status === 'running' && (
              <Badge variant="secondary" className="text-xs">
                {currentJob.completedCount}/{currentJob.totalCount}
              </Badge>
            )}
          </div>
          {isOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="p-3 space-y-3 bg-muted/30">
        {/* Configuration */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Nombre de runs</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value) || 1)}
              className="h-8 text-xs"
              disabled={currentJob?.status === 'running'}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Concurrence max</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={maxConcurrency}
              onChange={(e) => setMaxConcurrency(parseInt(e.target.value) || 1)}
              className="h-8 text-xs"
              disabled={currentJob?.status === 'running'}
            />
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="flex gap-2">
          {(!currentJob || currentJob.status !== 'running') ? (
            <Button
              onClick={handleStartBatch}
              disabled={isLoading}
              size="sm"
              className="flex-1"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Lancer {count} runs
            </Button>
          ) : (
            <Button
              onClick={handleCancelBatch}
              variant="destructive"
              size="sm"
              className="flex-1"
            >
              <Square className="h-4 w-4 mr-2" />
              Annuler
            </Button>
          )}
        </div>

        {/* Progression */}
        {currentJob && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {currentJob.completedCount} terminés, {currentJob.failedCount} échecs
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />

            {/* Liste des résultats */}
            {currentJob.results.length > 0 && (
              <div className="max-h-32 overflow-y-auto space-y-1 mt-2">
                {currentJob.results.map((result, i) => (
                  <div
                    key={result.id}
                    className="flex items-center justify-between text-xs p-1.5 rounded bg-background/50"
                  >
                    <div className="flex items-center gap-2">
                      {getStatusIcon(result.status)}
                      <span>Run #{i + 1}</span>
                    </div>
                    {result.duration && (
                      <span className="text-muted-foreground">
                        {(result.duration / 1000).toFixed(1)}s
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

