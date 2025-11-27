/**
 * Hook React pour l'Upscaling
 * Simplifie l'utilisation de l'API upscale dans les composants
 */

import { useState, useCallback } from 'react';

type UpscaleType = 'image' | 'video';

type UpscaleOptions = {
  scale?: number;
  enhanceFace?: boolean;
  denoiseStrength?: number;
  saveLocally?: boolean;
};

type UpscaleResult = {
  url: string;
  localPath?: string;
  model: string;
  scale: number;
  type: UpscaleType;
  duration: number;
  cost: number;
};

type UseUpscaleReturn = {
  upscale: (
    type: UpscaleType,
    sourceUrl: string,
    model?: string,
    options?: UpscaleOptions
  ) => Promise<UpscaleResult>;
  upscaleImage: (
    imageUrl: string,
    model?: string,
    options?: UpscaleOptions
  ) => Promise<UpscaleResult>;
  upscaleVideo: (
    videoUrl: string,
    model?: string,
    options?: UpscaleOptions
  ) => Promise<UpscaleResult>;
  isLoading: boolean;
  error: Error | null;
  result: UpscaleResult | null;
  clearResult: () => void;
};

export function useUpscale(): UseUpscaleReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<UpscaleResult | null>(null);

  const upscale = useCallback(
    async (
      type: UpscaleType,
      sourceUrl: string,
      model: string = type === 'image' ? 'topaz-image' : 'topaz-video',
      options: UpscaleOptions = {}
    ): Promise<UpscaleResult> => {
      setIsLoading(true);
      setError(null);

      try {
        const body: Record<string, unknown> = {
          type,
          model,
          scale: options.scale ?? 2,
          enhanceFace: options.enhanceFace ?? false,
          denoiseStrength: options.denoiseStrength,
          saveLocally: options.saveLocally ?? true,
        };

        if (type === 'image') {
          body.imageUrl = sourceUrl;
        } else {
          body.videoUrl = sourceUrl;
        }

        const response = await fetch('/api/upscale', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erreur lors de l\'upscaling');
        }

        const data = await response.json();
        const upscaleResult = data.result as UpscaleResult;
        
        setResult(upscaleResult);
        return upscaleResult;

      } catch (err) {
        const error = err instanceof Error ? err : new Error('Erreur inconnue');
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const upscaleImage = useCallback(
    (imageUrl: string, model?: string, options?: UpscaleOptions) => {
      return upscale('image', imageUrl, model ?? 'topaz-image', options);
    },
    [upscale]
  );

  const upscaleVideo = useCallback(
    (videoUrl: string, model?: string, options?: UpscaleOptions) => {
      return upscale('video', videoUrl, model ?? 'topaz-video', options);
    },
    [upscale]
  );

  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return {
    upscale,
    upscaleImage,
    upscaleVideo,
    isLoading,
    error,
    result,
    clearResult,
  };
}

