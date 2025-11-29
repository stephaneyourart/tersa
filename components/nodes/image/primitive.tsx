import { describeAction } from '@/app/actions/image/describe';
import { NodeLayout } from '@/components/nodes/layout';
import { DropzoneEmptyState } from '@/components/ui/kibo-ui/dropzone';
import { DropzoneContent } from '@/components/ui/kibo-ui/dropzone';
import { Dropzone } from '@/components/ui/kibo-ui/dropzone';
import { Skeleton } from '@/components/ui/skeleton';
import { handleError } from '@/lib/error/handle';
import { uploadFile } from '@/lib/upload';
import { useProject } from '@/providers/project';
import { useReactFlow } from '@xyflow/react';
import { Loader2Icon } from 'lucide-react';
import Image from 'next/image';
import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import type { ImageNodeProps } from '.';
import { ImageCompareSlider } from './image-compare-slider';
import type { UpscaleSettings } from './upscale-button';
import { GeneratingSkeleton } from '../generating-skeleton';

type ImagePrimitiveProps = ImageNodeProps & {
  title: string;
};

export const ImagePrimitive = ({
  data,
  id,
  type,
  title,
}: ImagePrimitiveProps) => {
  const { updateNodeData } = useReactFlow();
  const project = useProject();
  const [files, setFiles] = useState<File[] | undefined>();
  const [isUploading, setIsUploading] = useState(false);

  // État d'upscale
  const upscaleStatus = data.upscale?.status || 'idle';
  const isUpscaling = upscaleStatus === 'processing';
  const isUpscaled = upscaleStatus === 'completed';

  // L'URL de l'image à afficher (avant ou après upscale)
  const imageUrl = data.content?.url;

  const handleDrop = async (files: File[]) => {
    if (isUploading || !project?.id) {
      return;
    }

    try {
      if (!files.length) {
        throw new Error('No file selected');
      }

      setIsUploading(true);
      setFiles(files);
      const [file] = files;
      const { url, type } = await uploadFile(file, 'files');

      // Mettre à jour le node avec l'image immédiatement
      updateNodeData(id, {
        content: {
          url,
          type,
        },
        // Reset upscale state
        upscale: undefined,
      });

      // Essayer de décrire l'image (optionnel - ne bloque pas si ça échoue)
      try {
        const description = await describeAction(url, project?.id);
        if (!('error' in description)) {
          updateNodeData(id, {
            description: description.description,
          });
        } else {
          console.warn('Description auto désactivée:', description.error);
        }
      } catch (descError) {
        // La description a échoué mais l'image est uploadée - c'est OK
        console.warn('Description auto échouée (OpenAI quota?):', descError);
      }
    } catch (error) {
      handleError('Error uploading image', error);
    } finally {
      setIsUploading(false);
    }
  };

  // Handler pour lancer l'upscale
  const handleUpscale = useCallback(async (settings: UpscaleSettings) => {
    if (!imageUrl) return;

    const startTime = Date.now();
    
    // Mettre à jour le statut en "processing"
    updateNodeData(id, {
      upscale: {
        status: 'processing',
        originalUrl: imageUrl,
        model: settings.model,
        scale: settings.scale,
        startTime,
      },
    });

    try {
      // Utiliser un AbortController avec un timeout de 5 minutes pour les upscales longs
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5 minutes

      const response = await fetch('/api/upscale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'image',
          model: settings.model,
          imageUrl,
          scale: settings.scale,
          saveLocally: true,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erreur HTTP ${response.status}`);
      }

      const result = await response.json();
      const duration = Math.round((Date.now() - startTime) / 1000);

      // Mettre à jour avec l'image upscalée
      updateNodeData(id, {
        upscale: {
          status: 'completed',
          originalUrl: imageUrl,
          upscaledUrl: result.result.url,
          model: settings.model,
          scale: settings.scale,
        },
      });

      toast.success('Image upscalée !', {
        description: `⏱️ ${duration}s • ${settings.scale}x • ${settings.model}`,
        duration: 5000,
      });

    } catch (error) {
      // Vérifier si c'est une erreur d'abort
      if (error instanceof Error && error.name === 'AbortError') {
        toast.error('Upscale annulé', {
          description: 'L\'opération a pris trop de temps (>5min)',
        });
      } else {
        handleError('Erreur upscale', error);
      }
      
      // Reset en cas d'erreur
      updateNodeData(id, {
        upscale: {
          status: 'idle',
          originalUrl: imageUrl,
        },
      });
    }
  }, [id, imageUrl, updateNodeData]);

  // Handler pour annuler l'upscale
  const handleCancelUpscale = useCallback(() => {
    updateNodeData(id, {
      upscale: {
        status: 'idle',
        originalUrl: imageUrl,
      },
    });
  }, [id, imageUrl, updateNodeData]);

  // Données du nœud avec upscale
  const nodeData = useMemo(() => ({
    ...data,
    isGenerated: false, // Image importée = pas générée
  }), [data]);

  return (
    <NodeLayout 
      id={id} 
      data={nodeData} 
      type={type} 
      title={title}
      onUpscale={handleUpscale}
      onCancelUpscale={handleCancelUpscale}
    >
      {/* Skeleton pendant l'upload */}
      {isUploading && (
        <Skeleton className="flex aspect-video w-full animate-pulse items-center justify-center">
          <Loader2Icon
            size={16}
            className="size-4 animate-spin text-muted-foreground"
          />
        </Skeleton>
      )}

      {/* Skeleton pendant l'upscale */}
      {!isUploading && isUpscaling && (
        <GeneratingSkeleton
          className="rounded-b-xl"
          estimatedDuration={60} // Upscale ~60 secondes
          startTime={data.upscale?.startTime}
        />
      )}

      {/* Image avec comparaison si upscalée */}
      {!isUploading && !isUpscaling && data.content && (
        <>
          {isUpscaled && data.upscale?.upscaledUrl ? (
            <ImageCompareSlider
              beforeUrl={data.upscale.originalUrl || data.content.url}
              afterUrl={data.upscale.upscaledUrl}
              className="rounded-b-xl"
              width={data.width ?? 1000}
              height={data.height ?? 1000}
            />
          ) : (
            <Image
              src={data.content.url}
              alt="Image"
              width={data.width ?? 1000}
              height={data.height ?? 1000}
              className="h-auto w-full rounded-b-xl"
            />
          )}
        </>
      )}

      {/* Dropzone si pas de contenu */}
      {!isUploading && !data.content && (
        <Dropzone
          maxSize={1024 * 1024 * 10}
          minSize={1024}
          maxFiles={1}
          multiple={false}
          accept={{
            'image/*': [],
          }}
          onDrop={handleDrop}
          src={files}
          onError={console.error}
          className="rounded-none border-none bg-transparent p-0 shadow-none hover:bg-transparent dark:bg-transparent dark:hover:bg-transparent"
        >
          <DropzoneEmptyState className="p-4" />
          <DropzoneContent />
        </Dropzone>
      )}
    </NodeLayout>
  );
};
