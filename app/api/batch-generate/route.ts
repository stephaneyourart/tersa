/**
 * API Route pour la génération d'images en batch PARALLÈLE
 * Contourne la sérialisation des Server Actions de Next.js
 */

import { NextRequest, NextResponse } from 'next/server';

const WAVESPEED_API_BASE = 'https://api.wavespeed.ai/api/v3';
const MAX_PARALLEL_REQUESTS = 100; // Limite maximale configurable

type BatchJob = {
  nodeId: string;
  modelPath: string;
  prompt: string;
  images?: string[]; // Pour l'édition
  params?: {
    aspect_ratio?: string;
    resolution?: string;
    width?: number;
    height?: number;
    seed?: number;
    guidance_scale?: number;
    num_inference_steps?: number;
    negative_prompt?: string;
    output_format?: string;
  };
};

type BatchRequest = {
  jobs: BatchJob[];
  projectId: string;
};

type JobResult = {
  nodeId: string;
  success: boolean;
  imageUrl?: string;
  error?: string;
  duration?: number;
};

// Appel direct à WaveSpeed sans passer par les Server Actions
async function callWaveSpeedDirect(job: BatchJob, apiKey: string): Promise<{ imageUrl?: string; error?: string }> {
  const startTime = Date.now();
  
  try {
    const endpoint = `${WAVESPEED_API_BASE}/${job.modelPath}`;
    
    // Construire le body selon le type d'opération
    const isEdit = job.images && job.images.length > 0;
    const body = isEdit
      ? {
          prompt: job.prompt,
          images: job.images,
          resolution: job.params?.resolution || '2k',
          output_format: job.params?.output_format || 'png',
          enable_base64_output: false,
          enable_sync_mode: false,
          ...(job.params?.seed && { seed: job.params.seed }),
          ...(job.params?.guidance_scale && { guidance_scale: job.params.guidance_scale }),
          ...(job.params?.negative_prompt && { negative_prompt: job.params.negative_prompt }),
        }
      : {
          prompt: job.prompt,
          output_format: job.params?.output_format || 'png',
          enable_base64_output: false,
          enable_sync_mode: false,
          // Si width/height sont définis, les utiliser en priorité, sinon aspect_ratio + resolution
          ...(job.params?.width && job.params?.height 
            ? { width: job.params.width, height: job.params.height }
            : { 
                aspect_ratio: job.params?.aspect_ratio || '1:1',
                resolution: job.params?.resolution || '2k',
              }
          ),
          ...(job.params?.seed && { seed: job.params.seed }),
          ...(job.params?.guidance_scale && { guidance_scale: job.params.guidance_scale }),
          ...(job.params?.num_inference_steps && { num_inference_steps: job.params.num_inference_steps }),
          ...(job.params?.negative_prompt && { negative_prompt: job.params.negative_prompt }),
        };

    console.log(`[Batch API] Starting job for node ${job.nodeId} - ${job.modelPath}`);
    console.log(`[Batch API] Request body:`, JSON.stringify(body, null, 2));

    // Appel initial
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Batch API] Error for node ${job.nodeId}:`, errorText);
      return { error: `API Error: ${response.status} - ${errorText}` };
    }

    const data = await response.json();
    console.log(`[Batch API] Initial response for node ${job.nodeId}:`, data);

    // Si l'image est déjà disponible
    if (data.data?.outputs?.[0]) {
      return { imageUrl: data.data.outputs[0] };
    }

    // Sinon, polling pour récupérer le résultat
    const resultUrl = data.data?.urls?.get;
    if (!resultUrl) {
      return { error: 'No result URL returned' };
    }

    // Polling avec timeout de 120 secondes
    const maxPolls = 60;
    const pollInterval = 2000;

    for (let i = 0; i < maxPolls; i++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      const pollResponse = await fetch(resultUrl, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });

      if (!pollResponse.ok) {
        continue;
      }

      const pollData = await pollResponse.json();
      
      if (pollData.data?.outputs?.[0]) {
        const duration = Math.round((Date.now() - startTime) / 1000);
        console.log(`[Batch API] Success for node ${job.nodeId} in ${duration}s`);
        return { imageUrl: pollData.data.outputs[0] };
      }

      if (pollData.data?.status === 'failed' || pollData.data?.status === 'error') {
        return { error: `Generation failed: ${pollData.data?.error || 'Unknown error'}` };
      }
    }

    return { error: 'Timeout: Generation took too long' };
  } catch (error) {
    console.error(`[Batch API] Exception for node ${job.nodeId}:`, error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.WAVESPEED_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'WAVESPEED_API_KEY not configured' }, { status: 500 });
    }

    const body: BatchRequest = await request.json();
    const { jobs } = body;

    if (!jobs || !Array.isArray(jobs) || jobs.length === 0) {
      return NextResponse.json({ error: 'No jobs provided' }, { status: 400 });
    }

    if (jobs.length > MAX_PARALLEL_REQUESTS) {
      return NextResponse.json({ 
        error: `Too many jobs. Max is ${MAX_PARALLEL_REQUESTS}` 
      }, { status: 400 });
    }

    console.log(`[Batch API] Starting ${jobs.length} parallel jobs...`);
    const startTime = Date.now();

    // TOUS les appels lancés EN PARALLÈLE avec Promise.all
    const results = await Promise.all(
      jobs.map(async (job): Promise<JobResult> => {
        const result = await callWaveSpeedDirect(job, apiKey);
        return {
          nodeId: job.nodeId,
          success: !!result.imageUrl,
          imageUrl: result.imageUrl,
          error: result.error,
        };
      })
    );

    const totalDuration = Math.round((Date.now() - startTime) / 1000);
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`[Batch API] Completed in ${totalDuration}s: ${successCount} success, ${failCount} failed`);

    return NextResponse.json({
      success: true,
      results,
      totalDuration,
      successCount,
      failCount,
    });
  } catch (error) {
    console.error('[Batch API] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

