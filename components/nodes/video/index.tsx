import { VideoPrimitive } from './primitive';
import { VideoTransform } from './transform';

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
  };
  id: string;
};

export const VideoNode = (props: VideoNodeProps) => {
  // Utiliser Primitive UNIQUEMENT si c'est une vidéo importée (data.content existe)
  // Sinon, utiliser Transform pour la génération
  const hasImportedContent = Boolean(props.data.content);
  const Component = hasImportedContent ? VideoPrimitive : VideoTransform;

  return <Component {...props} title="Video" />;
};
