// Documentation précise basée sur https://wavespeed.ai/docs/docs-api/

export interface ModelParameter {
  name: string;
  type: string;
  required?: boolean;
  default?: string | boolean | number | string[];
  range?: string;
  description: string;
}

export interface ApiDoc {
  endpoint: string;
  method: string;
  headers: Record<string, string>;
  parameters: ModelParameter[];
  responseParameters?: ModelParameter[];
}

const COMMON_RESPONSE_PARAMS: ModelParameter[] = [
  { name: 'code', type: 'integer', description: 'HTTP status code (e.g., 200 for success)' },
  { name: 'message', type: 'string', description: 'Status message (e.g., "success")' },
  { name: 'data.id', type: 'string', description: 'Unique identifier for the prediction, Task Id' },
  { name: 'data.model', type: 'string', description: 'Model ID used for the prediction' },
  { name: 'data.outputs', type: 'array', description: 'Array of URLs to the generated content (empty when status is not completed)' },
  { name: 'data.urls', type: 'object', description: 'Object containing related API endpoints' },
  { name: 'data.urls.get', type: 'string', description: 'URL to retrieve the prediction result' },
  { name: 'data.status', type: 'string', description: 'Status of the task: created, processing, completed, or failed' },
  { name: 'data.created_at', type: 'string', description: 'ISO timestamp of when the request was created' },
  { name: 'data.error', type: 'string', description: 'Error message (empty if no error occurred)' },
  { name: 'data.timings', type: 'object', description: 'Object containing timing details' },
  { name: 'data.timings.inference', type: 'integer', description: 'Inference time in milliseconds' }
];

export const getApiDocumentation = (modelId: string): ApiDoc => {
  const commonHeaders = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ${WAVESPEED_API_KEY}'
  };

  // =========================================================
  // KLING OMNI VIDEO O1 - VIDEO EDIT
  // Source: https://wavespeed.ai/docs/docs-api/kwaivgi/kwaivgi-kling-video-o1-video-edit
  // =========================================================
  if (modelId === 'kwaivgi/kling-video-o1/video-edit') {
    return {
      endpoint: 'https://api.wavespeed.ai/api/v3/kwaivgi/kling-video-o1/video-edit',
      method: 'POST',
      headers: commonHeaders,
      parameters: [
        { 
          name: 'prompt', 
          type: 'string', 
          required: true, 
          range: '-', 
          description: 'The positive prompt for the generation.' 
        },
        { 
          name: 'video', 
          type: 'string', 
          required: true, 
          range: '-', 
          description: 'The video URL.' 
        },
        { 
          name: 'images', 
          type: 'array', 
          required: false, 
          default: [], 
          range: '-', 
          description: 'Including reference images of the element, scene, style, etc. Max 4' 
        },
        { 
          name: 'keep_original_sound', 
          type: 'boolean', 
          required: false, 
          default: true, 
          range: '-', 
          description: 'Select whether to keep the video original sound through the parameter' 
        },
        { 
          name: 'aspect_ratio', 
          type: 'string', 
          required: false, 
          range: '16:9, 9:16, 1:1', 
          description: 'The aspect ratio of the generated video.' 
        }
      ],
      responseParameters: [
        ...COMMON_RESPONSE_PARAMS,
        { name: 'data.has_nsfw_contents', type: 'array', description: 'Array of boolean values indicating NSFW detection for each output' }
      ]
    };
  }

  // =========================================================
  // KLING OMNI VIDEO O1 - TEXT TO VIDEO
  // =========================================================
  if (modelId.includes('kling-video-o1/text-to-video')) {
    return {
      endpoint: `https://api.wavespeed.ai/api/v3/${modelId}`,
      method: 'POST',
      headers: commonHeaders,
      parameters: [
        { name: 'prompt', type: 'string', required: true, description: 'The positive prompt for the generation.' },
        { name: 'negative_prompt', type: 'string', required: false, description: 'The negative prompt for the generation.' },
        { name: 'aspect_ratio', type: 'string', required: false, default: '16:9', range: '16:9, 9:16, 1:1', description: 'Video aspect ratio.' },
        { name: 'duration', type: 'string', required: false, default: '5', range: '5, 10', description: 'Duration of the video in seconds.' },
        { name: 'cfg_scale', type: 'number', required: false, default: 0.5, range: '0-1', description: 'Creativity scale.' },
        { name: 'mode', type: 'string', required: false, default: 'std', range: 'std, pro', description: 'Generation mode.' },
        { name: 'camera_control', type: 'object', required: false, description: 'Camera movement parameters (pan, tilt, zoom).' }
      ],
      responseParameters: COMMON_RESPONSE_PARAMS
    };
  }

  // =========================================================
  // KLING OMNI VIDEO O1 - IMAGE TO VIDEO
  // =========================================================
  if (modelId.includes('kling-video-o1/image-to-video')) {
    return {
      endpoint: `https://api.wavespeed.ai/api/v3/${modelId}`,
      method: 'POST',
      headers: commonHeaders,
      parameters: [
        { name: 'image', type: 'string', required: true, description: 'The input image URL.' },
        { name: 'prompt', type: 'string', required: false, description: 'Optional text description to guide motion.' },
        { name: 'negative_prompt', type: 'string', required: false, description: 'What to avoid.' },
        { name: 'duration', type: 'string', required: false, default: '5', range: '5, 10', description: 'Duration in seconds.' },
        { name: 'aspect_ratio', type: 'string', required: false, default: '16:9', range: '16:9, 9:16, 1:1', description: 'Output aspect ratio.' },
        { name: 'mode', type: 'string', required: false, default: 'std', range: 'std, pro', description: 'Quality mode.' }
      ],
      responseParameters: COMMON_RESPONSE_PARAMS
    };
  }

  // =========================================================
  // GOOGLE NANO BANANA PRO
  // =========================================================
  if (modelId.includes('google') || modelId.includes('nano-banana')) {
    return {
      endpoint: `https://api.wavespeed.ai/api/v3/${modelId}`,
      method: 'POST',
      headers: commonHeaders,
      parameters: [
        { name: 'prompt', type: 'string', required: true, description: 'Image description.' },
        { name: 'aspect_ratio', type: 'string', required: false, default: '1:1', range: '1:1, 16:9, 4:3, 3:4', description: 'Image format.' },
        { name: 'number_of_images', type: 'integer', required: false, default: 1, range: '1-4', description: 'Count of images to generate.' },
        { name: 'safety_filter_level', type: 'string', required: false, default: 'block_some', range: 'block_none, block_few, block_some', description: 'Safety filter strength.' },
        { name: 'person_generation', type: 'string', required: false, default: 'allow_adult', range: 'allow_adult, allow_all, dont_allow', description: 'Policy for generating people.' }
      ],
      responseParameters: COMMON_RESPONSE_PARAMS
    };
  }

  // Default fallback for others
  return {
    endpoint: `https://api.wavespeed.ai/api/v3/${modelId}`,
    method: 'POST',
    headers: commonHeaders,
    parameters: [
      { name: 'prompt', type: 'string', required: true, description: 'Input prompt' },
      { name: 'extra_body', type: 'object', required: false, default: {}, description: 'Additional model-specific parameters' }
    ],
    responseParameters: COMMON_RESPONSE_PARAMS
  };
};
