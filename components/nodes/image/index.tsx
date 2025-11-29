import { useNodeConnections } from '@xyflow/react';
import { ImagePrimitive } from './primitive';
import { ImageTransform } from './transform';

export type UpscaleData = {
  status: 'idle' | 'processing' | 'completed';
  originalUrl?: string;    // URL de l'image avant upscale
  upscaledUrl?: string;    // URL de l'image après upscale
  model?: string;          // Modèle utilisé
  scale?: number;          // Facteur d'upscale
  startTime?: number;      // Timestamp début upscale
};

export type ImageNodeProps = {
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
    size?: string;
    width?: number;
    height?: number;
    updatedAt?: string;
    model?: string;
    description?: string;
    instructions?: string;
    // Batch processing state
    batchGenerating?: boolean;
    batchStartTime?: number;
    advancedSettings?: unknown;
    // Upscale state
    upscale?: UpscaleData;
    // Flag pour distinguer images importées vs générées dans le canvas
    isGenerated?: boolean;
  };
  id: string;
};

export const ImageNode = (props: ImageNodeProps) => {
  const connections = useNodeConnections({
    id: props.id,
    handleType: 'target',
  });
  const Component = connections.length ? ImageTransform : ImagePrimitive;

  return <Component {...props} title="Image" />;
};
