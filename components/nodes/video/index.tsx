import { VideoPrimitive } from './primitive';
import { VideoTransform } from './transform';
import { NodeLayout } from '@/components/nodes/layout';
import { VideoIcon } from 'lucide-react';

export type VideoNodeProps = {
  type: string;
  data: {
    content?: {
      url: string;
      type: string;
    };
    generated?: {
      url: string;
      type: string;
    };
    updatedAt?: string;
    model?: string;
    instructions?: string;
    width?: number;
    height?: number;
    disabled?: boolean;
  };
  id: string;
};

// Placeholder léger pour nœud désactivé (évite de charger VideoTransform/VideoPrimitive)
const DisabledVideoNode = ({ id, data, type }: VideoNodeProps) => (
  <NodeLayout id={id} data={data} type={type} title="Video">
    <div className="flex items-center justify-center p-8 text-muted-foreground bg-muted/30 min-h-[120px] aspect-video">
      <div className="flex flex-col items-center gap-2 text-center">
        <VideoIcon className="w-8 h-8 opacity-40" />
        <span className="text-xs font-mono opacity-60">🎬 Désactivé</span>
        <span className="text-[10px] opacity-40">CMD+K pour réactiver</span>
      </div>
    </div>
  </NodeLayout>
);

export const VideoNode = (props: VideoNodeProps) => {
  // OPTIMISATION: Early return si désactivé - évite de charger les composants lourds
  if (props.data.disabled) {
    return <DisabledVideoNode {...props} />;
  }
  
  // Utiliser Primitive UNIQUEMENT si c'est une vidéo importée (data.content existe)
  // Sinon, utiliser Transform pour la génération
  const hasImportedContent = Boolean(props.data.content);
  const Component = hasImportedContent ? VideoPrimitive : VideoTransform;

  return <Component {...props} title="Video" />;
};
