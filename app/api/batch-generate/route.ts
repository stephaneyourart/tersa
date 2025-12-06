/**
 * API Route pour la génération d'images en batch PARALLÈLE
 * Contourne la sérialisation des Server Actions de Next.js
 * Télécharge automatiquement les images avec un titre intelligent généré par IA
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildRequestBody } from '@/lib/models/image/wavespeed-params';
import { uploadBuffer } from '@/lib/storage';
import { saveMediaMetadata } from '@/lib/media-metadata';
import OpenAI from 'openai';

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
  localPath?: string;
  smartTitle?: string;
  error?: string;
  duration?: number;
};

/**
 * Génère un titre intelligent pour un fichier basé sur le prompt
 */
async function generateSmartTitle(prompt: string): Promise<string> {
  try {
    const openai = new OpenAI();
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: `Tu génères des titres de fichiers courts et descriptifs.
Règles:
- Maximum 50 caractères
- Pas de caractères spéciaux (/ \\ : * ? " < > |)
- Remplace les espaces par des tirets
- Capture l'essence de l'image
- En français si le prompt est en français
- Pas d'extension de fichier
Réponds UNIQUEMENT avec le titre, rien d'autre.`
        },
        {
          role: 'user',
          content: `Génère un titre de fichier pour cette image: ${prompt}`
        }
      ],
      max_tokens: 60,
      temperature: 0.7,
    });

    let title = response.choices[0]?.message?.content?.trim() || 'image';
    
    // Nettoyer le titre
    title = title
      .replace(/[/\\:*?"<>|]/g, '')
      .replace(/\s+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
    
    return title || 'image';
  } catch (error) {
    console.warn('[Batch SmartTitle] Erreur, utilisation fallback:', error);
    return prompt
      .split(/\s+/)
      .slice(0, 5)
      .join('-')
      .replace(/[/\\:*?"<>|]/g, '')
      .substring(0, 50) || 'image';
  }
}

/**
 * Télécharge une image depuis une URL et la sauvegarde localement avec métadonnées
 */
async function downloadAndSaveImage(
  imageUrl: string, 
  smartTitle: string,
  outputFormat: string = 'png',
  metadata?: {
    modelPath?: string;
    prompt?: string;
    aspectRatio?: string;
    seed?: number;
    inputImages?: string[];
  }
): Promise<{ localUrl: string; localPath: string }> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Erreur téléchargement: ${response.status}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  const extension = outputFormat === 'jpeg' ? 'jpg' : outputFormat;
  const filename = `${smartTitle}.${extension}`;
  const mimeType = `image/${outputFormat}`;
  
  const stored = await uploadBuffer(buffer, filename, mimeType);
  
  // Sauvegarder les métadonnées dans un fichier sidecar .meta.json
  if (stored.path) {
    saveMediaMetadata(stored.path, {
      isGenerated: true,
      modelId: metadata?.modelPath,
      prompt: metadata?.prompt,
      aspectRatio: metadata?.aspectRatio,
      seed: metadata?.seed,
      inputImages: metadata?.inputImages,
      format: mimeType,
      smartTitle: smartTitle,
      generatedAt: new Date().toISOString(),
    });
  }
  
  return {
    localUrl: stored.url,
    localPath: stored.path,
  };
}

// Appel direct à WaveSpeed avec téléchargement automatique et titre intelligent
async function callWaveSpeedDirect(job: BatchJob, apiKey: string): Promise<{ 
  imageUrl?: string; 
  localPath?: string; 
  smartTitle?: string;
  error?: string 
}> {
  const startTime = Date.now();
  
  try {
    const endpoint = `${WAVESPEED_API_BASE}/${job.modelPath === 'seedream-v4.5-wavespeed' ? 'bytedance/seedream-v4.5' : job.modelPath}`;
    
    // 1. Générer le titre IA EN PARALLÈLE de l'appel WaveSpeed
    const titlePromise = generateSmartTitle(job.prompt);
    
    // Utiliser la configuration du modèle pour construire le body correct
    const body = buildRequestBody(job.modelPath, {
      prompt: job.prompt,
      images: job.images,
      aspect_ratio: job.params?.aspect_ratio,
      resolution: job.params?.resolution,
      output_format: job.params?.output_format,
      seed: job.params?.seed,
      guidance_scale: job.params?.guidance_scale,
      num_inference_steps: job.params?.num_inference_steps,
      negative_prompt: job.params?.negative_prompt,
    });

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

    // Vérifier les erreurs explicites de l'API WaveSpeed
    if (data.error) {
      console.error(`[Batch API] WaveSpeed returned error:`, data.error);
      return { error: `WaveSpeed Error: ${data.error}` };
    }

    let wavespeedImageUrl: string | null = null;

    // Si l'image est déjà disponible
    if (data.data?.outputs?.[0]) {
      wavespeedImageUrl = data.data.outputs[0];
    } else {
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
          wavespeedImageUrl = pollData.data.outputs[0];
          break;
        }

        if (pollData.data?.status === 'failed' || pollData.data?.status === 'error') {
          return { error: `Generation failed: ${pollData.data?.error || 'Unknown error'}` };
        }
      }
    }

    if (!wavespeedImageUrl) {
      return { error: 'Timeout: Generation took too long' };
    }

    // 2. Attendre le titre et télécharger l'image
    const smartTitle = await titlePromise;
    const outputFormat = job.params?.output_format || 'png';
    
    console.log(`[Batch API] Titre généré: "${smartTitle}", téléchargement en cours...`);
    
    const { localUrl, localPath } = await downloadAndSaveImage(
      wavespeedImageUrl, 
      smartTitle, 
      outputFormat,
      {
        modelPath: job.modelPath,
        prompt: job.prompt,
        aspectRatio: job.params?.aspect_ratio,
        seed: job.params?.seed,
        inputImages: job.images,
      }
    );

    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`[Batch API] Success for node ${job.nodeId} in ${duration}s - Saved to: ${localPath}`);
    
    return { 
      imageUrl: localUrl, 
      localPath,
      smartTitle,
    };
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
          localPath: result.localPath,
          smartTitle: result.smartTitle,
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

