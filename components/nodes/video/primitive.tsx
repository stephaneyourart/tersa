import { NodeLayout } from '@/components/nodes/layout';
import { ExpiredMedia, useMediaExpired, isLocalUrl } from '@/components/nodes/expired-media';
import {
  Dropzone,
  DropzoneContent,
  DropzoneEmptyState,
} from '@/components/ui/kibo-ui/dropzone';
import { Skeleton } from '@/components/ui/skeleton';
import { handleError } from '@/lib/error/handle';
import { uploadFile } from '@/lib/upload';
import { usePerformanceModeStore } from '@/lib/performance-mode-store';
import { useVideoVisibility, useVideoHover } from '@/hooks/use-video-visibility';
import { useShouldRenderContent } from '@/hooks/use-viewport-activity';
import { useReactFlow } from '@xyflow/react';
import { Loader2Icon, PlayIcon } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import type { VideoNodeProps } from '.';
import { MediaFullscreenViewer } from '@/components/media-fullscreen-viewer';
import { MediaPlaceholder } from '@/components/nodes/media-placeholder';

type VideoPrimitiveProps = VideoNodeProps & {
  title: string;
};

export const VideoPrimitive = ({
  data,
  id,
  type,
  title,
}: VideoPrimitiveProps) => {
  const { updateNodeData } = useReactFlow();
  const [files, setFiles] = useState<File[] | undefined>();
  const [isUploading, setIsUploading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Mode performance global
  const isPerformanceMode = usePerformanceModeStore((s) => s.isPerformanceMode);
  
  // Détection visibilité dans viewport
  const { ref: visibilityRef, isVisible } = useVideoVisibility();
  
  // Hover pour lecture
  const { isHovered, hoverProps } = useVideoHover();
  
  // Level of Detail: afficher placeholder si zoom out ou en mouvement
  const { shouldRender, isZoomedOut, isMoving } = useShouldRenderContent();
  
  // La vidéo joue SEULEMENT si : visible + hover + pas en mode performance + contenu rendu
  const shouldPlay = isVisible && isHovered && !isPerformanceMode && shouldRender;
  
  // Fullscreen viewer
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Handler pour double-clic => fullscreen
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.content?.url) {
      setIsFullscreen(true);
    }
  }, [data.content?.url]);
  
  // Contrôler la lecture de la vidéo
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    if (shouldPlay) {
      video.play().catch(() => {
        // Ignorer les erreurs de lecture (ex: pas encore de données)
      });
    } else {
      video.pause();
    }
  }, [shouldPlay]);
  
  // Hook pour détecter si la vidéo est expirée
  const videoUrl = data.content?.url;
  const isLocal = videoUrl ? isLocalUrl(videoUrl) : true;
  const { isExpired, markAsExpired, retry: retryCheck } = useMediaExpired(videoUrl, isLocal);

  const handleDrop = async (files: File[]) => {
    if (isUploading) {
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

      updateNodeData(id, {
        content: {
          url,
          type,
        },
      });
    } catch (error) {
      handleError('Error uploading video', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <NodeLayout id={id} data={data} type={type} title={title}>
      {isUploading && (
        <Skeleton className="flex aspect-video w-full animate-pulse items-center justify-center">
          <Loader2Icon
            size={16}
            className="size-4 animate-spin text-muted-foreground"
          />
        </Skeleton>
      )}
      {!isUploading && data.content && (
        <>
          <div 
            ref={visibilityRef as React.RefObject<HTMLDivElement>}
            className="relative cursor-pointer aspect-video"
            onDoubleClick={handleDoubleClick}
            {...hoverProps}
          >
            {/* Placeholder quand zoom out ou en mouvement */}
            {!shouldRender ? (
              <MediaPlaceholder isMoving={isMoving} isZoomedOut={isZoomedOut} />
            ) : isExpired ? (
              <ExpiredMedia 
                onRetry={retryCheck}
                message="La vidéo n'est plus disponible"
              />
            ) : (
              <>
                <video
                  ref={videoRef}
                  src={data.content.url}
                  className="h-auto w-full rounded-b-xl"
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  onError={() => markAsExpired()}
                />
                {/* Overlay "Play" quand la vidéo est en pause */}
                {!shouldPlay && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-b-xl transition-opacity pointer-events-none">
                    <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                      <PlayIcon className="w-6 h-6 text-black ml-0.5" />
                    </div>
                  </div>
                )}
                {/* Hint double-clic */}
                {isHovered && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                    <span className="text-[10px] text-white/60 bg-black/50 px-2 py-0.5 rounded-full">
                      Double-clic: plein écran
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
          
          {/* Fullscreen viewer */}
          <MediaFullscreenViewer
            open={isFullscreen}
            onOpenChange={setIsFullscreen}
            mediaUrl={data.content.url}
            mediaType="video"
          />
        </>
      )}
      {!isUploading && !data.content && (
        <Dropzone
          maxSize={1024 * 1024 * 10}
          minSize={1024}
          maxFiles={1}
          multiple={false}
          accept={{
            'video/*': [],
          }}
          onDrop={handleDrop}
          src={files}
          onError={console.error}
          className="rounded-none border-none bg-transparent shadow-none hover:bg-transparent dark:bg-transparent dark:hover:bg-transparent"
        >
          <DropzoneEmptyState className="p-4" />
          <DropzoneContent />
        </Dropzone>
      )}
    </NodeLayout>
  );
};
