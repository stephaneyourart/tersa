import { generateSpeechAction } from '@/app/actions/speech/create';
import { NodeLayout } from '@/components/nodes/layout';
import { ExpiredMedia, useMediaExpired, isLocalUrl } from '@/components/nodes/expired-media';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useAnalytics } from '@/hooks/use-analytics';
import { useGenerationTracker } from '@/hooks/use-generation-tracker';
import { download } from '@/lib/download';
import { handleError } from '@/lib/error/handle';
import { speechModels } from '@/lib/models/speech';
import {
  getDescriptionsFromImageNodes,
  getTextFromTextNodes,
} from '@/lib/xyflow';
import { useProject } from '@/providers/project';
import { getIncomers, useReactFlow } from '@xyflow/react';
import {
  ClockIcon,
  DownloadIcon,
  Loader2Icon,
  PlayIcon,
  RotateCcwIcon,
} from 'lucide-react';
import { type ChangeEventHandler, type ComponentProps, useState } from 'react';
import { toast } from 'sonner';
import { mutate } from 'swr';
import type { AudioNodeProps } from '.';
import { ModelSelector } from '../model-selector';
import { VoiceSelector } from './voice-selector';

type AudioTransformProps = AudioNodeProps & {
  title: string;
};

const getDefaultModel = (models: typeof speechModels) => {
  const defaultModel = Object.entries(models).find(
    ([_, model]) => model.default
  );

  if (!defaultModel) {
    throw new Error('No default model found');
  }

  return defaultModel[0];
};

export const AudioTransform = ({
  data,
  id,
  type,
  title,
}: AudioTransformProps) => {
  const { updateNodeData, getNodes, getEdges } = useReactFlow();
  const [loading, setLoading] = useState(false);
  const project = useProject();
  const modelId = data.model ?? getDefaultModel(speechModels);
  const model = speechModels[modelId];
  const analytics = useAnalytics();
  const { trackGeneration } = useGenerationTracker();
  
  // Hook pour détecter si l'audio est expiré (URL WaveSpeed plus accessible)
  const audioUrl = data.generated?.url;
  const isLocal = audioUrl ? isLocalUrl(audioUrl) : true;
  const { isExpired, markAsExpired, retry: retryCheck } = useMediaExpired(audioUrl, isLocal);

  const handleGenerate = async () => {
    if (loading || !project?.id) {
      return;
    }

    const startTime = Date.now();

    try {
      const incomers = getIncomers({ id }, getNodes(), getEdges());
      const textPrompts = getTextFromTextNodes(incomers);
      const imagePrompts = getDescriptionsFromImageNodes(incomers);

      if (!textPrompts.length && !imagePrompts.length && !data.instructions) {
        throw new Error('No prompts found');
      }

      setLoading(true);

      let text = [...textPrompts, ...imagePrompts].join('\n');
      let instructions = data.instructions;

      if (data.instructions && !text.length) {
        text = data.instructions;
        instructions = undefined;
      }

      analytics.track('canvas', 'node', 'generate', {
        type,
        promptLength: text.length,
        model: modelId,
        instructionsLength: data.instructions?.length ?? 0,
        voice: data.voice ?? null,
      });

      const response = await generateSpeechAction({
        text,
        nodeId: id,
        modelId,
        projectId: project.id,
        voice: data.voice,
        instructions,
      });

      if ('error' in response) {
        throw new Error(response.error);
      }

      updateNodeData(id, response.nodeData);

      // Calculer la durée et le coût
      const duration = Math.round((Date.now() - startTime) / 1000);
      const provider = model?.providers?.[0];
      const cost = provider?.getCost?.(text.length) ?? 0;

      // Tracker la génération
      trackGeneration({
        type: 'audio',
        model: modelId,
        modelLabel: model?.label,
        prompt: text.substring(0, 100),
        duration,
        cost,
        status: 'success',
        outputUrl: (response.nodeData as { generated?: { url?: string } })?.generated?.url,
        nodeId: id,
        nodeName: (data as { customName?: string }).customName,
      });

      toast.success('Audio generated successfully');

      setTimeout(() => mutate('credits'), 5000);
    } catch (error) {
      handleError('Error generating audio', error);
      
      // Tracker l'erreur
      trackGeneration({
        type: 'audio',
        model: modelId,
        modelLabel: model?.label,
        prompt: data.instructions?.substring(0, 100),
        duration: Math.round((Date.now() - startTime) / 1000),
        cost: 0,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        nodeId: id,
        nodeName: (data as { customName?: string }).customName,
      });
    } finally {
      setLoading(false);
    }
  };

  const toolbar: ComponentProps<typeof NodeLayout>['toolbar'] = [
    {
      children: (
        <ModelSelector
          value={modelId}
          options={speechModels}
          key={id}
          className="w-[200px] rounded-full"
          onChange={(value) => updateNodeData(id, { model: value })}
        />
      ),
    },
  ];

  if (model?.voices.length) {
    toolbar.push({
      children: (
        <VoiceSelector
          value={data.voice ?? model.voices[0]}
          options={model.voices}
          key={id}
          className="w-[200px] rounded-full"
          onChange={(value) => updateNodeData(id, { voice: value })}
        />
      ),
    });
  }

  toolbar.push({
    tooltip: data.generated?.url ? 'Regenerate' : 'Generate',
    children: (
      <Button
        size="icon"
        className="rounded-full"
        onClick={handleGenerate}
        disabled={loading || !project?.id}
      >
        {data.generated?.url ? (
          <RotateCcwIcon size={12} />
        ) : (
          <PlayIcon size={12} />
        )}
      </Button>
    ),
  });

  if (data.updatedAt) {
    toolbar.push({
      tooltip: `Last updated: ${new Intl.DateTimeFormat('en-US', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(data.updatedAt))}`,
      children: (
        <Button size="icon" variant="ghost" className="rounded-full">
          <ClockIcon size={12} />
        </Button>
      ),
    });
  }

  const handleInstructionsChange: ChangeEventHandler<HTMLTextAreaElement> = (
    event
  ) => updateNodeData(id, { instructions: event.target.value });

  return (
    <NodeLayout id={id} data={data} type={type} title={title} toolbar={toolbar}>
      {loading && (
        <Skeleton className="flex h-[50px] w-full animate-pulse items-center justify-center">
          <Loader2Icon
            size={16}
            className="size-4 animate-spin text-muted-foreground"
          />
        </Skeleton>
      )}
      {!loading && !data.generated?.url && (
        <div className="flex h-[50px] w-full items-center justify-center rounded-full bg-secondary">
          <p className="text-muted-foreground text-sm">
            Press <PlayIcon size={12} className="-translate-y-px inline" /> to
            generate audio
          </p>
        </div>
      )}
      {!loading && data.generated?.url && (
        <>
          {/* Afficher l'icône fantôme si l'audio est expiré */}
          {isExpired ? (
            <ExpiredMedia 
              onRetry={retryCheck}
              message="L'audio a expiré sur WaveSpeed et n'a pas été téléchargé"
            />
          ) : (
            // biome-ignore lint/a11y/useMediaCaption: <explanation>
            <audio
              src={data.generated.url}
              controls
              className="w-full rounded-none"
              onError={() => markAsExpired()}
            />
          )}
        </>
      )}
      <Textarea
        value={data.instructions ?? ''}
        onChange={handleInstructionsChange}
        placeholder="Promptez..."
        className="nodrag nowheel shrink-0 resize-none rounded-none border-none bg-transparent! shadow-none focus-visible:ring-0"
      />
    </NodeLayout>
  );
};
