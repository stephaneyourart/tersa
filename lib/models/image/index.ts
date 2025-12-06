import {
  type TersaModel,
  type TersaProvider,
  providers,
} from '@/lib/providers';
import { bedrock } from '@ai-sdk/amazon-bedrock';
import { luma } from '@ai-sdk/luma';
import { openai } from '@ai-sdk/openai';
import { xai } from '@ai-sdk/xai';
import type { ImageModel } from 'ai';
import { AmazonBedrockIcon, FalIcon, GrokIcon, WaveSpeedIcon } from '../../icons';
import { blackForestLabs } from './black-forest-labs';
import { falImage } from './fal';
import { wavespeedImage } from './wavespeed';

const million = 1000000;

export type ImageSize = `${number}x${number}`;

type TersaImageModel = TersaModel & {
  providers: (TersaProvider & {
    model: ImageModel;
    getCost: (props?: {
      textInput?: number;
      imageInput?: number;
      output?: number;
      size?: string;
    }) => number;
  })[];
  sizes?: ImageSize[];
  supportsEdit?: boolean;
  providerOptions?: Record<string, Record<string, string>>;
  
  // Support des dimensions personnalisées (width/height séparés)
  // Pour modèles comme Seedream V4.5 qui acceptent des tailles libres
  supportsCustomDimensions?: boolean;
  /** Dimension minimum (en pixels) - ex: 1024 */
  minDimension?: number;
  /** Dimension maximum (en pixels) - ex: 4096 */
  maxDimension?: number;
};

export const imageModels: Record<string, TersaImageModel> = {
  'grok-2-image': {
    icon: GrokIcon,
    label: 'Grok 2 Image',
    chef: providers.xai,
    providers: [
      {
        ...providers.xai,
        model: xai.image('grok-2-image'),

        // https://docs.x.ai/docs/models#models-and-pricing
        getCost: () => 0.07,
      },
    ],

    // xAI does not support size or quality
    // size: '1024x1024',
    // providerOptions: {},
  },
  'dall-e-3': {
    label: 'DALL-E 3',
    chef: providers.openai,
    providers: [
      {
        ...providers.openai,
        model: openai.image('dall-e-3'),

        // https://platform.openai.com/docs/pricing#image-generation
        getCost: (props) => {
          if (!props) {
            throw new Error('Props are required');
          }

          if (!props.size) {
            throw new Error('Size is required');
          }

          if (props.size === '1024x1024') {
            return 0.08;
          }

          if (props.size === '1024x1792' || props.size === '1792x1024') {
            return 0.12;
          }

          throw new Error('Size is not supported');
        },
      },
    ],
    sizes: ['1024x1024', '1024x1792', '1792x1024'],
    providerOptions: {
      openai: {
        quality: 'hd',
      },
    },
  },
  'dall-e-2': {
    label: 'DALL-E 2',
    chef: providers.openai,
    providers: [
      {
        ...providers.openai,
        model: openai.image('dall-e-2'),

        // https://platform.openai.com/docs/pricing#image-generation
        getCost: (props) => {
          if (!props) {
            throw new Error('Props are required');
          }

          const { size } = props;

          if (size === '1024x1024') {
            return 0.02;
          }

          if (size === '512x512') {
            return 0.018;
          }

          if (size === '256x256') {
            return 0.016;
          }

          throw new Error('Size is not supported');
        },
      },
    ],
    sizes: ['1024x1024', '512x512', '256x256'],
    priceIndicator: 'low',
    providerOptions: {
      openai: {
        quality: 'standard',
      },
    },
  },
  'gpt-image-1': {
    label: 'GPT Image 1',
    chef: providers.openai,
    providers: [
      {
        ...providers.openai,
        model: openai.image('gpt-image-1'),

        // Input (Text): https://platform.openai.com/docs/pricing#latest-models
        // Input (Image): https://platform.openai.com/docs/pricing#text-generation
        // Output: https://platform.openai.com/docs/pricing#image-generation
        getCost: (props) => {
          const priceMap: Record<ImageSize, number> = {
            '1024x1024': 0.167,
            '1024x1536': 0.25,
            '1536x1024': 0.25,
          };

          if (!props) {
            throw new Error('Props are required');
          }

          if (typeof props.size !== 'string') {
            throw new Error('Size is required');
          }

          if (typeof props.output !== 'number') {
            throw new Error('Output is required');
          }

          if (typeof props.textInput !== 'number') {
            throw new Error('Text input is required');
          }

          if (typeof props.imageInput !== 'number') {
            throw new Error('Image input is required');
          }

          const { textInput, imageInput, output, size } = props;
          const textInputCost = textInput ? (textInput / million) * 5 : 0;
          const imageInputCost = imageInput ? (imageInput / million) * 10 : 0;
          const outputCost = (output / million) * priceMap[size as ImageSize];

          return textInputCost + imageInputCost + outputCost;
        },
      },
    ],
    supportsEdit: true,
    sizes: ['1024x1024', '1024x1536', '1536x1024'],
    default: true,
    providerOptions: {
      openai: {
        quality: 'high',
      },
    },
  },
  'amazon-nova-canvas-v1': {
    label: 'Nova Canvas',
    icon: AmazonBedrockIcon,
    chef: providers.amazon,
    providers: [
      {
        ...providers['bedrock'],
        icon: AmazonBedrockIcon,
        model: bedrock.image('amazon.nova-canvas-v1:0'),

        // https://aws.amazon.com/bedrock/pricing/
        getCost: (props) => {
          if (!props) {
            throw new Error('Props are required');
          }

          const { size } = props;

          if (size === '1024x1024') {
            return 0.06;
          }

          if (size === '2048x2048') {
            return 0.08;
          }

          throw new Error('Size is not supported');
        },
      },
    ],

    // Each side must be between 320-4096 pixels, inclusive.
    sizes: ['1024x1024', '2048x2048'],

    providerOptions: {
      bedrock: {
        quality: 'premium',
      },
    },
  },
  'flux-pro-1.1': {
    label: 'FLUX Pro 1.1',
    chef: providers['black-forest-labs'],
    providers: [
      {
        ...providers['black-forest-labs'],
        model: blackForestLabs.image('flux-pro-1.1'),

        // https://bfl.ai/pricing/api
        getCost: () => 0.04,
      },
    ],
    sizes: ['1024x1024', '832x1440', '1440x832'],
    supportsEdit: true,
  },
  'flux-pro': {
    label: 'FLUX Pro',
    chef: providers['black-forest-labs'],
    providers: [
      {
        ...providers['black-forest-labs'],
        model: blackForestLabs.image('flux-pro'),

        // https://bfl.ai/pricing/api
        getCost: () => 0.05,
      },
    ],
    sizes: ['1024x1024', '832x1440', '1440x832'],
    supportsEdit: true,
  },
  'flux-dev': {
    label: 'FLUX Dev',
    chef: providers['black-forest-labs'],
    providers: [
      {
        ...providers['black-forest-labs'],
        model: blackForestLabs.image('flux-dev'),

        // https://bfl.ai/pricing/api
        getCost: () => 0.025,
      },
    ],
    sizes: ['1024x1024', '832x1440', '1440x832'],
    supportsEdit: true,
    priceIndicator: 'low',
  },
  'flux-pro-1.0-canny': {
    label: 'FLUX Pro 1.0 Canny',
    chef: providers['black-forest-labs'],
    providers: [
      {
        ...providers['black-forest-labs'],
        model: blackForestLabs.image('flux-pro-1.0-canny'),

        // https://bfl.ai/pricing/api
        getCost: () => 0.05,
      },
    ],
    sizes: ['1024x1024', '832x1440', '1440x832'],
    supportsEdit: true,
  },
  'flux-pro-1.0-depth': {
    label: 'FLUX Pro 1.0 Depth',
    chef: providers['black-forest-labs'],
    providers: [
      {
        ...providers['black-forest-labs'],
        model: blackForestLabs.image('flux-pro-1.0-depth'),

        // https://bfl.ai/pricing/api
        getCost: () => 0.05,
      },
    ],
    sizes: ['1024x1024', '832x1440', '1440x832'],
    supportsEdit: true,
  },
  'flux-kontext-pro': {
    label: 'FLUX Kontext Pro',
    chef: providers['black-forest-labs'],
    providers: [
      {
        ...providers['black-forest-labs'],
        model: blackForestLabs.image('flux-kontext-pro'),

        // https://bfl.ai/pricing/api
        getCost: () => 0.04,
      },
    ],
    sizes: ['1024x1024', '832x1440', '1440x832'],
    supportsEdit: true,
  },
  'flux-kontext-max': {
    label: 'FLUX Kontext Max',
    chef: providers['black-forest-labs'],
    providers: [
      {
        ...providers['black-forest-labs'],
        model: blackForestLabs.image('flux-kontext-max'),

        // https://bfl.ai/pricing/api
        getCost: () => 0.08,
      },
    ],
    sizes: ['1024x1024', '832x1440', '1440x832'],
    supportsEdit: true,
  },
  'photon-1': {
    label: 'Photon 1',
    chef: providers.luma,
    providers: [
      {
        ...providers.luma,
        model: luma.image('photon-1'),

        // https://lumalabs.ai/api/pricing
        getCost: (props) => {
          if (!props) {
            throw new Error('Props are required');
          }

          const { size } = props;

          if (!size) {
            throw new Error('Size is required');
          }

          const [width, height] = size.split('x').map(Number);
          const pixels = width * height;

          return (pixels * 0.0073) / million;
        },
      },
    ],
    sizes: ['1024x1024', '1820x1024', '1024x1820'],
    supportsEdit: true,
  },
  'photon-flash-1': {
    label: 'Photon Flash 1',
    chef: providers.luma,
    providers: [
      {
        ...providers.luma,
        model: luma.image('photon-flash-1'),

        // https://lumalabs.ai/api/pricing
        getCost: (props) => {
          if (!props) {
            throw new Error('Props are required');
          }

          const { size } = props;

          if (!size) {
            throw new Error('Size is required');
          }

          const [width, height] = size.split('x').map(Number);
          const pixels = width * height;

          return (pixels * 0.0019) / million;
        },
      },
    ],
    sizes: ['1024x1024', '1820x1024', '1024x1820'],
    supportsEdit: true,
  },

  // ========================================
  // MODÈLES FAL.AI
  // ========================================

  'nano-banana-pro-fal': {
    label: 'Nano Banana Pro (Fal)',
    chef: providers.fal,
    icon: FalIcon,
    providers: [
      {
        ...providers.fal,
        icon: FalIcon,
        model: falImage.nanoBananaPro() as unknown as ImageModel,
        // Ultra rapide et économique
        getCost: () => 0.01,
      },
    ],
    sizes: ['1024x1024', '1024x768', '768x1024', '1536x1024', '1024x1536'],
  },

  'seedream-fal': {
    label: 'Seedream (Fal)',
    chef: providers.fal,
    icon: FalIcon,
    providers: [
      {
        ...providers.fal,
        icon: FalIcon,
        model: falImage.seedream() as unknown as ImageModel,
        getCost: () => 0.02,
      },
    ],
    sizes: ['1024x1024', '1024x768', '768x1024'],
  },

  'flux-schnell-fal': {
    label: 'FLUX Schnell (Fal)',
    chef: providers.fal,
    icon: FalIcon,
    providers: [
      {
        ...providers.fal,
        icon: FalIcon,
        model: falImage.fluxSchnell() as unknown as ImageModel,
        // Ultra rapide
        getCost: () => 0.003,
      },
    ],
    sizes: ['1024x1024', '1024x768', '768x1024'],
    priceIndicator: 'low',
  },

  'flux-dev-fal': {
    label: 'FLUX Dev (Fal)',
    chef: providers.fal,
    icon: FalIcon,
    providers: [
      {
        ...providers.fal,
        icon: FalIcon,
        model: falImage.fluxDev() as unknown as ImageModel,
        getCost: () => 0.025,
      },
    ],
    sizes: ['1024x1024', '1024x768', '768x1024'],
    priceIndicator: 'low',
  },

  'flux-pro-fal': {
    label: 'FLUX Pro (Fal)',
    chef: providers.fal,
    icon: FalIcon,
    providers: [
      {
        ...providers.fal,
        icon: FalIcon,
        model: falImage.fluxPro() as unknown as ImageModel,
        getCost: () => 0.05,
      },
    ],
    sizes: ['1024x1024', '1024x768', '768x1024'],
  },

  'flux-realism-fal': {
    label: 'FLUX Realism (Fal)',
    chef: providers.fal,
    icon: FalIcon,
    providers: [
      {
        ...providers.fal,
        icon: FalIcon,
        model: falImage.fluxRealism() as unknown as ImageModel,
        getCost: () => 0.025,
      },
    ],
    sizes: ['1024x1024', '1024x768', '768x1024'],
  },

  'ideogram-v2-fal': {
    label: 'Ideogram V2 (Fal)',
    chef: providers.fal,
    icon: FalIcon,
    providers: [
      {
        ...providers.fal,
        icon: FalIcon,
        model: falImage.ideogramV2() as unknown as ImageModel,
        getCost: () => 0.08,
      },
    ],
    sizes: ['1024x1024', '1024x768', '768x1024'],
  },

  'ideogram-v2-turbo-fal': {
    label: 'Ideogram V2 Turbo (Fal)',
    chef: providers.fal,
    icon: FalIcon,
    providers: [
      {
        ...providers.fal,
        icon: FalIcon,
        model: falImage.ideogramV2Turbo() as unknown as ImageModel,
        getCost: () => 0.04,
      },
    ],
    sizes: ['1024x1024', '1024x768', '768x1024'],
    priceIndicator: 'low',
  },

  'recraft-v3-fal': {
    label: 'Recraft V3 (Fal)',
    chef: providers.fal,
    icon: FalIcon,
    providers: [
      {
        ...providers.fal,
        icon: FalIcon,
        model: falImage.recraftV3() as unknown as ImageModel,
        getCost: () => 0.04,
      },
    ],
    sizes: ['1024x1024', '1024x768', '768x1024'],
  },

  'sd35-large-fal': {
    label: 'SD 3.5 Large (Fal)',
    chef: providers.fal,
    icon: FalIcon,
    providers: [
      {
        ...providers.fal,
        icon: FalIcon,
        model: falImage.sd35Large() as unknown as ImageModel,
        getCost: () => 0.035,
      },
    ],
    sizes: ['1024x1024', '1024x768', '768x1024'],
  },

  'kolors-fal': {
    label: 'Kolors (Fal)',
    chef: providers.fal,
    icon: FalIcon,
    providers: [
      {
        ...providers.fal,
        icon: FalIcon,
        model: falImage.kolors() as unknown as ImageModel,
        getCost: () => 0.02,
      },
    ],
    sizes: ['1024x1024', '1024x768', '768x1024'],
    priceIndicator: 'low',
  },

  'flux-kontext-fal': {
    label: 'FLUX Kontext (Fal)',
    chef: providers.fal,
    icon: FalIcon,
    providers: [
      {
        ...providers.fal,
        icon: FalIcon,
        model: falImage.fluxKontext() as unknown as ImageModel,
        getCost: () => 0.04,
      },
    ],
    sizes: ['1024x1024', '1024x768', '768x1024'],
    supportsEdit: true,
  },

  'flux-kontext-max-fal': {
    label: 'FLUX Kontext Max (Fal)',
    chef: providers.fal,
    icon: FalIcon,
    providers: [
      {
        ...providers.fal,
        icon: FalIcon,
        model: falImage.fluxKontextMax() as unknown as ImageModel,
        getCost: () => 0.08,
      },
    ],
    sizes: ['1024x1024', '1024x768', '768x1024'],
    supportsEdit: true,
  },

  // ========================================
  // MODÈLES WAVESPEED - BYTEDANCE SEEDREAM V4.5
  // Typography-optimized, supports up to 4K
  // ========================================

  'seedream-v4.5-wavespeed': {
    label: 'Seedream V4.5 (WaveSpeed)',
    chef: providers.wavespeed,
    icon: WaveSpeedIcon,
    providers: [
      {
        ...providers.wavespeed,
        icon: WaveSpeedIcon,
        model: wavespeedImage.seedreamV45() as unknown as ImageModel,
        // $0.04 per image selon la documentation
        getCost: () => 0.04,
      },
    ],
    // Seedream V4.5 supporte des dimensions personnalisées (width/height libres)
    // Range: 1024 ~ 4096 par dimension
    supportsCustomDimensions: true,
    minDimension: 1024,
    maxDimension: 4096,
    // Tailles prédéfinies pour faciliter la sélection (format: "width*height")
    sizes: ['2100x900', '2048x2048', '2688x2016', '2688x1792', '2560x1440', '4096x4096'],
  },

  // ========================================
  // MODÈLES WAVESPEED - NANO BANANA
  // ========================================

  'nano-banana-wavespeed': {
    label: 'Nano Banana (WaveSpeed)',
    chef: providers.wavespeed,
    icon: WaveSpeedIcon,
    providers: [
      {
        ...providers.wavespeed,
        icon: WaveSpeedIcon,
        model: wavespeedImage.nanoBanana() as unknown as ImageModel,
        getCost: () => 0.006,
      },
    ],
    sizes: ['1024x1024', '1344x768', '768x1344', '1152x896', '896x1152'],
    priceIndicator: 'lowest',
  },

  'nano-banana-pro-wavespeed': {
    label: 'Nano Banana Pro (WaveSpeed)',
    chef: providers.wavespeed,
    icon: WaveSpeedIcon,
    providers: [
      {
        ...providers.wavespeed,
        icon: WaveSpeedIcon,
        model: wavespeedImage.nanoBananaPro() as unknown as ImageModel,
        getCost: () => 0.008,
      },
    ],
    sizes: ['1024x1024', '1344x768', '768x1344', '1152x896', '896x1152'],
    priceIndicator: 'low',
  },

  'nano-banana-pro-multi-wavespeed': {
    label: 'Nano Banana Pro Multi (WaveSpeed)',
    chef: providers.wavespeed,
    icon: WaveSpeedIcon,
    providers: [
      {
        ...providers.wavespeed,
        icon: WaveSpeedIcon,
        model: wavespeedImage.nanoBananaProMulti() as unknown as ImageModel,
        getCost: () => 0.012,
      },
    ],
    sizes: ['1024x1024', '1344x768', '768x1344'],
  },

  'nano-banana-pro-ultra-wavespeed': {
    label: 'Nano Banana Pro Ultra (WaveSpeed)',
    chef: providers.wavespeed,
    icon: WaveSpeedIcon,
    providers: [
      {
        ...providers.wavespeed,
        icon: WaveSpeedIcon,
        model: wavespeedImage.nanoBananaProUltra() as unknown as ImageModel,
        getCost: () => 0.02,
      },
    ],
    sizes: ['1024x1024', '1344x768', '768x1344', '2048x2048'],
  },

  'nano-banana-edit-wavespeed': {
    label: 'Nano Banana Edit (WaveSpeed)',
    chef: providers.wavespeed,
    icon: WaveSpeedIcon,
    supportsEdit: true,
    providers: [
      {
        ...providers.wavespeed,
        icon: WaveSpeedIcon,
        model: wavespeedImage.nanoBananaEdit() as unknown as ImageModel,
        getCost: () => 0.008,
      },
    ],
    sizes: ['1024x1024', '1344x768', '768x1344'],
    priceIndicator: 'low',
  },

  'nano-banana-pro-edit-wavespeed': {
    label: 'Nano Banana Pro Edit (WaveSpeed)',
    chef: providers.wavespeed,
    icon: WaveSpeedIcon,
    supportsEdit: true,
    providers: [
      {
        ...providers.wavespeed,
        icon: WaveSpeedIcon,
        model: wavespeedImage.nanoBananaProEdit() as unknown as ImageModel,
        getCost: () => 0.01,
      },
    ],
    sizes: ['1024x1024', '1344x768', '768x1344'],
  },

  'nano-banana-pro-edit-multi-wavespeed': {
    label: 'Nano Banana Pro Edit Multi (WaveSpeed)',
    chef: providers.wavespeed,
    icon: WaveSpeedIcon,
    supportsEdit: true,
    providers: [
      {
        ...providers.wavespeed,
        icon: WaveSpeedIcon,
        model: wavespeedImage.nanoBananaProEditMulti() as unknown as ImageModel,
        getCost: () => 0.015,
      },
    ],
    sizes: ['1024x1024', '1344x768', '768x1344'],
  },

  'nano-banana-pro-edit-ultra-wavespeed': {
    label: 'Nano Banana Pro Edit Ultra (WaveSpeed)',
    chef: providers.wavespeed,
    icon: WaveSpeedIcon,
    supportsEdit: true,
    providers: [
      {
        ...providers.wavespeed,
        icon: WaveSpeedIcon,
        model: wavespeedImage.nanoBananaProEditUltra() as unknown as ImageModel,
        getCost: () => 0.025,
      },
    ],
    sizes: ['1024x1024', '1344x768', '768x1344', '2048x2048'],
  },

  'nano-banana-effects-wavespeed': {
    label: 'Nano Banana Effects (WaveSpeed)',
    chef: providers.wavespeed,
    icon: WaveSpeedIcon,
    supportsEdit: true,
    providers: [
      {
        ...providers.wavespeed,
        icon: WaveSpeedIcon,
        model: wavespeedImage.nanoBananaEffects() as unknown as ImageModel,
        getCost: () => 0.01,
      },
    ],
    sizes: ['1024x1024', '1344x768', '768x1344'],
  },

  // ========================================
  // MODÈLES WAVESPEED - IMAGEN (Google)
  // ========================================

  'imagen3-wavespeed': {
    label: 'Imagen 3 (WaveSpeed)',
    chef: providers.wavespeed,
    icon: WaveSpeedIcon,
    providers: [
      {
        ...providers.wavespeed,
        icon: WaveSpeedIcon,
        model: wavespeedImage.imagen3() as unknown as ImageModel,
        getCost: () => 0.04,
      },
    ],
    sizes: ['1024x1024', '1344x768', '768x1344'],
  },

  'imagen3-fast-wavespeed': {
    label: 'Imagen 3 Fast (WaveSpeed)',
    chef: providers.wavespeed,
    icon: WaveSpeedIcon,
    providers: [
      {
        ...providers.wavespeed,
        icon: WaveSpeedIcon,
        model: wavespeedImage.imagen3Fast() as unknown as ImageModel,
        getCost: () => 0.02,
      },
    ],
    sizes: ['1024x1024', '1344x768', '768x1344'],
    priceIndicator: 'low',
  },

  'imagen4-wavespeed': {
    label: 'Imagen 4 (WaveSpeed)',
    chef: providers.wavespeed,
    icon: WaveSpeedIcon,
    providers: [
      {
        ...providers.wavespeed,
        icon: WaveSpeedIcon,
        model: wavespeedImage.imagen4() as unknown as ImageModel,
        getCost: () => 0.05,
      },
    ],
    sizes: ['1024x1024', '1344x768', '768x1344', '2048x2048'],
  },

  'imagen4-fast-wavespeed': {
    label: 'Imagen 4 Fast (WaveSpeed)',
    chef: providers.wavespeed,
    icon: WaveSpeedIcon,
    providers: [
      {
        ...providers.wavespeed,
        icon: WaveSpeedIcon,
        model: wavespeedImage.imagen4Fast() as unknown as ImageModel,
        getCost: () => 0.03,
      },
    ],
    sizes: ['1024x1024', '1344x768', '768x1344'],
    priceIndicator: 'low',
  },

  'imagen4-ultra-wavespeed': {
    label: 'Imagen 4 Ultra (WaveSpeed)',
    chef: providers.wavespeed,
    icon: WaveSpeedIcon,
    providers: [
      {
        ...providers.wavespeed,
        icon: WaveSpeedIcon,
        model: wavespeedImage.imagen4Ultra() as unknown as ImageModel,
        getCost: () => 0.08,
      },
    ],
    sizes: ['1024x1024', '2048x2048', '4096x4096'],
    priceIndicator: 'high',
  },

  // ========================================
  // MODÈLES WAVESPEED - GEMINI
  // ========================================

  'gemini-2.5-flash-wavespeed': {
    label: 'Gemini 2.5 Flash (WaveSpeed)',
    chef: providers.wavespeed,
    icon: WaveSpeedIcon,
    providers: [
      {
        ...providers.wavespeed,
        icon: WaveSpeedIcon,
        model: wavespeedImage.gemini25FlashText2Img() as unknown as ImageModel,
        getCost: () => 0.02,
      },
    ],
    sizes: ['1024x1024', '1344x768', '768x1344'],
    priceIndicator: 'low',
  },

  'gemini-2.5-flash-edit-wavespeed': {
    label: 'Gemini 2.5 Flash Edit (WaveSpeed)',
    chef: providers.wavespeed,
    icon: WaveSpeedIcon,
    supportsEdit: true,
    providers: [
      {
        ...providers.wavespeed,
        icon: WaveSpeedIcon,
        model: wavespeedImage.gemini25FlashEdit() as unknown as ImageModel,
        getCost: () => 0.025,
      },
    ],
    sizes: ['1024x1024', '1344x768', '768x1344'],
  },

  'gemini-3-pro-wavespeed': {
    label: 'Gemini 3 Pro (WaveSpeed)',
    chef: providers.wavespeed,
    icon: WaveSpeedIcon,
    providers: [
      {
        ...providers.wavespeed,
        icon: WaveSpeedIcon,
        model: wavespeedImage.gemini3ProText2Img() as unknown as ImageModel,
        getCost: () => 0.04,
      },
    ],
    sizes: ['1024x1024', '1344x768', '768x1344'],
  },

  'gemini-3-pro-edit-wavespeed': {
    label: 'Gemini 3 Pro Edit (WaveSpeed)',
    chef: providers.wavespeed,
    icon: WaveSpeedIcon,
    supportsEdit: true,
    providers: [
      {
        ...providers.wavespeed,
        icon: WaveSpeedIcon,
        model: wavespeedImage.gemini3ProEdit() as unknown as ImageModel,
        getCost: () => 0.05,
      },
    ],
    sizes: ['1024x1024', '1344x768', '768x1344'],
  },

  // ========================================
  // MODÈLES WAVESPEED - FLUX
  // ========================================

  'flux-dev-wavespeed': {
    label: 'FLUX Dev (WaveSpeed)',
    chef: providers.wavespeed,
    icon: WaveSpeedIcon,
    providers: [
      {
        ...providers.wavespeed,
        icon: WaveSpeedIcon,
        model: wavespeedImage.fluxDev() as unknown as ImageModel,
        getCost: () => 0.02,
      },
    ],
    sizes: ['1024x1024', '1344x768', '768x1344'],
    priceIndicator: 'low',
  },

  'flux-dev-ultra-fast-wavespeed': {
    label: 'FLUX Dev Ultra Fast (WaveSpeed)',
    chef: providers.wavespeed,
    icon: WaveSpeedIcon,
    providers: [
      {
        ...providers.wavespeed,
        icon: WaveSpeedIcon,
        model: wavespeedImage.fluxDevUltraFast() as unknown as ImageModel,
        getCost: () => 0.015,
      },
    ],
    sizes: ['1024x1024', '1344x768', '768x1344'],
    priceIndicator: 'lowest',
  },

  'flux-schnell-wavespeed': {
    label: 'FLUX Schnell (WaveSpeed)',
    chef: providers.wavespeed,
    icon: WaveSpeedIcon,
    providers: [
      {
        ...providers.wavespeed,
        icon: WaveSpeedIcon,
        model: wavespeedImage.fluxSchnell() as unknown as ImageModel,
        getCost: () => 0.003,
      },
    ],
    sizes: ['1024x1024', '1344x768', '768x1344'],
    priceIndicator: 'lowest',
  },

  'flux-1.1-pro-wavespeed': {
    label: 'FLUX 1.1 Pro (WaveSpeed)',
    chef: providers.wavespeed,
    icon: WaveSpeedIcon,
    providers: [
      {
        ...providers.wavespeed,
        icon: WaveSpeedIcon,
        model: wavespeedImage.flux11Pro() as unknown as ImageModel,
        getCost: () => 0.04,
      },
    ],
    sizes: ['1024x1024', '1344x768', '768x1344'],
  },

  'flux-1.1-pro-ultra-wavespeed': {
    label: 'FLUX 1.1 Pro Ultra (WaveSpeed)',
    chef: providers.wavespeed,
    icon: WaveSpeedIcon,
    providers: [
      {
        ...providers.wavespeed,
        icon: WaveSpeedIcon,
        model: wavespeedImage.flux11ProUltra() as unknown as ImageModel,
        getCost: () => 0.06,
      },
    ],
    sizes: ['1024x1024', '2048x2048'],
    priceIndicator: 'high',
  },

  'flux-kontext-dev-wavespeed': {
    label: 'FLUX Kontext Dev (WaveSpeed)',
    chef: providers.wavespeed,
    icon: WaveSpeedIcon,
    supportsEdit: true,
    providers: [
      {
        ...providers.wavespeed,
        icon: WaveSpeedIcon,
        model: wavespeedImage.fluxKontextDev() as unknown as ImageModel,
        getCost: () => 0.03,
      },
    ],
    sizes: ['1024x1024', '1344x768', '768x1344'],
  },

  'flux-kontext-dev-multi-ultra-fast-wavespeed': {
    label: 'FLUX Kontext Dev Multi Ultra Fast (WaveSpeed)',
    chef: providers.wavespeed,
    icon: WaveSpeedIcon,
    supportsEdit: true,
    priceIndicator: 'low',
    providers: [
      {
        ...providers.wavespeed,
        icon: WaveSpeedIcon,
        model: wavespeedImage.fluxKontextDevMultiUltraFast() as unknown as ImageModel,
        getCost: () => 0.025,
      },
    ],
    sizes: ['1024x1024', '1344x768', '768x1344'],
  },

  'flux-kontext-pro-wavespeed': {
    label: 'FLUX Kontext Pro (WaveSpeed)',
    chef: providers.wavespeed,
    icon: WaveSpeedIcon,
    supportsEdit: true,
    providers: [
      {
        ...providers.wavespeed,
        icon: WaveSpeedIcon,
        model: wavespeedImage.fluxKontextPro() as unknown as ImageModel,
        getCost: () => 0.04,
      },
    ],
    sizes: ['1024x1024', '1344x768', '768x1344'],
  },

  'flux-kontext-max-wavespeed': {
    label: 'FLUX Kontext Max (WaveSpeed)',
    chef: providers.wavespeed,
    icon: WaveSpeedIcon,
    supportsEdit: true,
    providers: [
      {
        ...providers.wavespeed,
        icon: WaveSpeedIcon,
        model: wavespeedImage.fluxKontextMax() as unknown as ImageModel,
        getCost: () => 0.08,
      },
    ],
    sizes: ['1024x1024', '2048x2048'],
    priceIndicator: 'high',
  },

  'flux-2-dev-wavespeed': {
    label: 'FLUX 2 Dev (WaveSpeed)',
    chef: providers.wavespeed,
    icon: WaveSpeedIcon,
    providers: [
      {
        ...providers.wavespeed,
        icon: WaveSpeedIcon,
        model: wavespeedImage.flux2DevText2Img() as unknown as ImageModel,
        getCost: () => 0.025,
      },
    ],
    sizes: ['1024x1024', '1344x768', '768x1344'],
    priceIndicator: 'low',
  },

  'flux-2-pro-wavespeed': {
    label: 'FLUX 2 Pro (WaveSpeed)',
    chef: providers.wavespeed,
    icon: WaveSpeedIcon,
    providers: [
      {
        ...providers.wavespeed,
        icon: WaveSpeedIcon,
        model: wavespeedImage.flux2ProText2Img() as unknown as ImageModel,
        getCost: () => 0.05,
      },
    ],
    sizes: ['1024x1024', '1344x768', '768x1344'],
  },

  // ========================================
  // MODÈLES WAVESPEED - QWEN
  // ========================================

  'qwen-text2img-wavespeed': {
    label: 'Qwen Text to Image (WaveSpeed)',
    chef: providers.wavespeed,
    icon: WaveSpeedIcon,
    providers: [
      {
        ...providers.wavespeed,
        icon: WaveSpeedIcon,
        model: wavespeedImage.qwenText2Img() as unknown as ImageModel,
        getCost: () => 0.02,
      },
    ],
    sizes: ['1024x1024', '1344x768', '768x1344'],
    priceIndicator: 'low',
  },

  'qwen-edit-wavespeed': {
    label: 'Qwen Edit (WaveSpeed)',
    chef: providers.wavespeed,
    icon: WaveSpeedIcon,
    supportsEdit: true,
    providers: [
      {
        ...providers.wavespeed,
        icon: WaveSpeedIcon,
        model: wavespeedImage.qwenEdit() as unknown as ImageModel,
        getCost: () => 0.025,
      },
    ],
    sizes: ['1024x1024', '1344x768', '768x1344'],
  },

  'qwen-edit-plus-wavespeed': {
    label: 'Qwen Edit Plus (WaveSpeed)',
    chef: providers.wavespeed,
    icon: WaveSpeedIcon,
    supportsEdit: true,
    providers: [
      {
        ...providers.wavespeed,
        icon: WaveSpeedIcon,
        model: wavespeedImage.qwenEditPlus() as unknown as ImageModel,
        getCost: () => 0.04,
      },
    ],
    sizes: ['1024x1024', '1344x768', '768x1344'],
  },

  // ========================================
  // MODÈLES WAVESPEED - HUNYUAN
  // ========================================

  'hunyuan-2.1-wavespeed': {
    label: 'Hunyuan 2.1 (WaveSpeed)',
    chef: providers.wavespeed,
    icon: WaveSpeedIcon,
    providers: [
      {
        ...providers.wavespeed,
        icon: WaveSpeedIcon,
        model: wavespeedImage.hunyuan21() as unknown as ImageModel,
        getCost: () => 0.02,
      },
    ],
    sizes: ['1024x1024', '1344x768', '768x1344'],
    priceIndicator: 'low',
  },

  'hunyuan-3-wavespeed': {
    label: 'Hunyuan 3 (WaveSpeed)',
    chef: providers.wavespeed,
    icon: WaveSpeedIcon,
    providers: [
      {
        ...providers.wavespeed,
        icon: WaveSpeedIcon,
        model: wavespeedImage.hunyuan3() as unknown as ImageModel,
        getCost: () => 0.03,
      },
    ],
    sizes: ['1024x1024', '1344x768', '768x1344'],
  },

  // ========================================
  // MODÈLES WAVESPEED - STABILITY AI
  // ========================================

  'sdxl-wavespeed': {
    label: 'SDXL (WaveSpeed)',
    chef: providers.wavespeed,
    icon: WaveSpeedIcon,
    providers: [
      {
        ...providers.wavespeed,
        icon: WaveSpeedIcon,
        model: wavespeedImage.sdxl() as unknown as ImageModel,
        getCost: () => 0.01,
      },
    ],
    sizes: ['1024x1024', '1344x768', '768x1344'],
    priceIndicator: 'lowest',
  },

  'sd3-wavespeed': {
    label: 'Stable Diffusion 3 (WaveSpeed)',
    chef: providers.wavespeed,
    icon: WaveSpeedIcon,
    providers: [
      {
        ...providers.wavespeed,
        icon: WaveSpeedIcon,
        model: wavespeedImage.sd3() as unknown as ImageModel,
        getCost: () => 0.02,
      },
    ],
    sizes: ['1024x1024', '1344x768', '768x1344'],
    priceIndicator: 'low',
  },

  'sd35-large-wavespeed': {
    label: 'SD 3.5 Large (WaveSpeed)',
    chef: providers.wavespeed,
    icon: WaveSpeedIcon,
    providers: [
      {
        ...providers.wavespeed,
        icon: WaveSpeedIcon,
        model: wavespeedImage.sd35Large() as unknown as ImageModel,
        getCost: () => 0.035,
      },
    ],
    sizes: ['1024x1024', '1344x768', '768x1344'],
  },

  'sd35-large-turbo-wavespeed': {
    label: 'SD 3.5 Large Turbo (WaveSpeed)',
    chef: providers.wavespeed,
    icon: WaveSpeedIcon,
    providers: [
      {
        ...providers.wavespeed,
        icon: WaveSpeedIcon,
        model: wavespeedImage.sd35LargeTurbo() as unknown as ImageModel,
        getCost: () => 0.02,
      },
    ],
    sizes: ['1024x1024', '1344x768', '768x1344'],
    priceIndicator: 'low',
  },
};
