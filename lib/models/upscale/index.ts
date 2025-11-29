/**
 * Modèles d'Upscaling pour TersaFork
 * Supporte: Lupa AI, Topaz (via Fal), et autres providers
 */

import { FalIcon, LupaIcon } from '@/lib/icons';
import {
  type TersaModel,
  type TersaProvider,
  providers,
} from '@/lib/providers';
import { lupa } from './lupa';
import { topaz } from './topaz';

export type UpscaleModel = {
  modelId: string;
  generate: (props: {
    imageUrl?: string;
    videoUrl?: string;
    scale?: number; // 2x, 4x, etc.
    enhanceFace?: boolean;
    denoiseStrength?: number;
  }) => Promise<string>;
};

export type TersaUpscaleModel = TersaModel & {
  type: 'image' | 'video' | 'both';
  providers: (TersaProvider & {
    model: UpscaleModel;
    getCost: (props?: { 
      width?: number; 
      height?: number;
      duration?: number;
      scale?: number;
    }) => number;
  })[];
  maxScale?: number;
  supportsEnhanceFace?: boolean;
  supportsDenoise?: boolean;
};

export const upscaleModels: Record<string, TersaUpscaleModel> = {
  // ========================================
  // LUPA AI UPSCALERS
  // Documentation: https://lupaupscaler.gitbook.io/lupaupscaler-docs/api
  // ========================================
  
  'lupa-standard': {
    label: 'Lupa Standard',
    chef: providers.unknown, // Lupa AI
    type: 'image',
    providers: [
      {
        ...providers.unknown,
        id: 'lupa',
        name: 'Lupa AI',
        icon: LupaIcon,
        model: lupa.standard(),
        getCost: (props) => {
          // Prix estimé basé sur le plan
          const scale = props?.scale || 2;
          return 0.05 * (scale / 2);
        },
      },
    ],
    maxScale: 6,
    supportsEnhanceFace: true,
    supportsDenoise: false,
    default: true, // Lupa comme modèle par défaut
  },

  'lupa-precision': {
    label: 'Lupa Precision',
    chef: providers.unknown, // Lupa AI
    type: 'image',
    providers: [
      {
        ...providers.unknown,
        id: 'lupa',
        name: 'Lupa AI',
        icon: LupaIcon,
        model: lupa.precision(),
        getCost: (props) => {
          const scale = props?.scale || 2;
          return 0.08 * (scale / 2);
        },
      },
    ],
    maxScale: 6,
    supportsEnhanceFace: true,
    supportsDenoise: false,
  },

  // ========================================
  // TOPAZ UPSCALERS (via Fal.ai)
  // ========================================
  
  'topaz-image': {
    label: 'Topaz Image Upscaler',
    chef: providers.fal,
    type: 'image',
    providers: [
      {
        ...providers.fal,
        icon: FalIcon,
        model: topaz.image(),
        // Prix estimé basé sur la résolution
        getCost: (props) => {
          const basePrice = 0.02;
          const scale = props?.scale || 2;
          return basePrice * scale;
        },
      },
    ],
    maxScale: 4,
    supportsEnhanceFace: true,
    supportsDenoise: true,
    default: true,
  },

  'topaz-video': {
    label: 'Topaz Video Upscaler',
    chef: providers.fal,
    type: 'video',
    providers: [
      {
        ...providers.fal,
        icon: FalIcon,
        model: topaz.video(),
        // Prix basé sur la durée de la vidéo
        getCost: (props) => {
          const duration = props?.duration || 5;
          const scale = props?.scale || 2;
          return 0.05 * duration * scale;
        },
      },
    ],
    maxScale: 4,
    supportsEnhanceFace: false,
    supportsDenoise: true,
  },

  // ========================================
  // AUTRES UPSCALERS (à ajouter selon besoins)
  // ========================================

  'real-esrgan': {
    label: 'Real-ESRGAN (Fal)',
    chef: providers.fal,
    type: 'image',
    providers: [
      {
        ...providers.fal,
        icon: FalIcon,
        model: {
          modelId: 'fal-ai/real-esrgan',
          generate: async ({ imageUrl, scale }) => {
            // Implémentation Real-ESRGAN via Fal
            const apiKey = process.env.FAL_API_KEY;
            if (!apiKey) throw new Error('FAL_API_KEY non configuré');

            console.log('[Real-ESRGAN] Starting upscale for:', imageUrl?.substring(0, 100));

            const response = await fetch('https://queue.fal.run/fal-ai/real-esrgan', {
              method: 'POST',
              headers: {
                'Authorization': `Key ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                image_url: imageUrl,
                scale: scale || 4,
              }),
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error('[Real-ESRGAN] Error:', errorText);
              throw new Error(`Erreur Real-ESRGAN: ${errorText}`);
            }

            const { request_id, status_url } = await response.json();
            console.log('[Real-ESRGAN] Job started:', request_id);

            // Polling
            let attempts = 0;
            while (attempts < 60) {
              await new Promise(r => setTimeout(r, 2000));
              const statusRes = await fetch(status_url, {
                headers: { 'Authorization': `Key ${apiKey}` },
              });
              const status = await statusRes.json();
              
              console.log('[Real-ESRGAN] Status:', status.status);
              
              if (status.status === 'COMPLETED') {
                return status.result.image.url;
              }
              if (status.status === 'FAILED') {
                throw new Error(status.error || 'Échec upscale');
              }
              attempts++;
            }
            throw new Error('Timeout upscale');
          },
        },
        getCost: () => 0.01,
      },
    ],
    maxScale: 4,
    supportsEnhanceFace: true,
    supportsDenoise: false,
  },

  'sima-upscaler': {
    label: 'Sima Upscaler',
    chef: providers.fal,
    type: 'image',
    providers: [
      {
        ...providers.fal,
        icon: FalIcon,
        model: {
          modelId: 'simalabs/sima-upscaler',
          generate: async ({ imageUrl, scale }) => {
            const apiKey = process.env.FAL_API_KEY;
            if (!apiKey) throw new Error('FAL_API_KEY non configuré');

            const response = await fetch('https://queue.fal.run/simalabs/sima-upscaler', {
              method: 'POST',
              headers: {
                'Authorization': `Key ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                image_url: imageUrl,
                upscale_factor: scale || 2,
              }),
            });

            if (!response.ok) {
              throw new Error('Erreur Sima Upscaler');
            }

            const { request_id, status_url } = await response.json();

            // Polling
            let attempts = 0;
            while (attempts < 60) {
              await new Promise(r => setTimeout(r, 2000));
              const statusRes = await fetch(status_url, {
                headers: { 'Authorization': `Key ${apiKey}` },
              });
              const status = await statusRes.json();
              
              if (status.status === 'COMPLETED') {
                return status.result.image.url;
              }
              if (status.status === 'FAILED') {
                throw new Error(status.error || 'Échec upscale');
              }
              attempts++;
            }
            throw new Error('Timeout upscale');
          },
        },
        getCost: () => 0.015,
      },
    ],
    maxScale: 4,
    supportsEnhanceFace: false,
    supportsDenoise: false,
  },
};

