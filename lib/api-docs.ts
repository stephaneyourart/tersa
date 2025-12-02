// Documentation précise basée sur le scraping automatique
import docsDb from '@/lib/data/wavespeed-docs-db.json';

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

const COMMON_HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer ${WAVESPEED_API_KEY}'
};

// Fallback manual data for critical models if scraping fails
const MANUAL_DOCS: Record<string, Partial<ApiDoc>> = {
  // ... (on garde les fallbacks au cas où, mais vides pour l'instant pour alléger)
};

export const getApiDocumentation = (modelId: string): ApiDoc => {
  // 1. Try to get from scraped DB
  const scrapedDoc = (docsDb as Record<string, any>)[modelId];

  if (scrapedDoc) {
    return {
      endpoint: scrapedDoc.endpoint,
      method: scrapedDoc.method || 'POST',
      headers: COMMON_HEADERS,
      parameters: scrapedDoc.parameters || [],
      responseParameters: scrapedDoc.responseParameters || []
    };
  }

  // 2. Fallback: Generic construction
  return {
    endpoint: `https://api.wavespeed.ai/api/v3/${modelId}`,
    method: 'POST',
    headers: COMMON_HEADERS,
    parameters: [
      { name: 'prompt', type: 'string', required: true, description: 'Input prompt' },
      { name: 'extra_body', type: 'object', required: false, default: {}, description: 'Additional model-specific parameters' }
    ],
    responseParameters: [
      { name: 'code', type: 'integer', description: 'HTTP status code' },
      { name: 'data.id', type: 'string', description: 'Task ID' },
      { name: 'data.outputs', type: 'array', description: 'Generated URLs' }
    ]
  };
};
