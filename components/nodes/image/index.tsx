import { ImagePrimitive } from './primitive';
import { ImageTransform } from './transform';
import { NodeLayout } from '@/components/nodes/layout';
import { ImageIcon } from 'lucide-react';

export type UpscaleData = {
  status: 'idle' | 'processing' | 'completed';
  originalUrl?: string;    // URL de l'image avant upscale
  upscaledUrl?: string;    // URL de l'image après upscale
  model?: string;          // Modèle utilisé
  scale?: number;          // Facteur d'upscale
  creativity?: number;     // Niveau de créativité (Lupa)
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
    model?: string;         // Modèle utilisé pour la génération
    modelId?: string;       // Alternative pour le modèle (compatibilité WaveSpeed)
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
    // État de génération depuis le GenerationPanel
    generating?: boolean;
    generatingStartTime?: number;
    disabled?: boolean;
  };
  id: string;
};

// Placeholder léger pour nœud désactivé (évite de charger ImageTransform/ImagePrimitive)
const DisabledImageNode = ({ id, data, type }: ImageNodeProps) => (
  <NodeLayout id={id} data={data} type={type} title="Image">
    <div className="flex items-center justify-center p-8 text-muted-foreground bg-muted/30 min-h-[120px] aspect-video">
      <div className="flex flex-col items-center gap-2 text-center">
        <ImageIcon className="w-8 h-8 opacity-40" />
        <span className="text-xs font-mono opacity-60">🖼️ Désactivé</span>
        <span className="text-[10px] opacity-40">CMD+K pour réactiver</span>
      </div>
    </div>
  </NodeLayout>
);

export const ImageNode = (props: ImageNodeProps) => {
  // OPTIMISATION: Early return si désactivé - évite de charger les composants lourds
  if (props.data.disabled) {
    return <DisabledImageNode {...props} />;
  }
  
  // Utiliser Primitive UNIQUEMENT si c'est une image importée (data.content existe)
  // Sinon, utiliser Transform pour la génération
  const hasImportedContent = Boolean(props.data.content);
  const Component = hasImportedContent ? ImagePrimitive : ImageTransform;

  return <Component {...props} title="Image" />;
};
