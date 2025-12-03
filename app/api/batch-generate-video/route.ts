/**
 * API Route pour génération vidéo en batch PARALLÈLE
 * Contourne la limitation des Server Actions qui s'exécutent séquentiellement
 */

import { NextResponse } from 'next/server';
import { videoModels } from '@/lib/models/video';
import { uploadBuffer, generateUniqueFilename } from '@/lib/storage';
import fs from 'fs';
import path from 'path';

interface VideoJob {
  nodeId: string;
  modelId: string;
  prompt: string;
  images: { url: string; type: string }[];
  duration?: number; // Durée en secondes (défaut: 10)
  aspectRatio?: string; // Aspect ratio (défaut: 16:9)
}

interface BatchRequest {
  jobs: VideoJob[];
  projectId: string;
}

// Lit le contenu d'une image (locale ou distante)
async function readImageContent(url: string): Promise<string> {
  // Si c'est une URL locale /api/storage/...
  if (url.startsWith('/api/storage/')) {
    const relativePath = url.replace('/api/storage/', '');
    const storagePath = process.env.LOCAL_STORAGE_PATH || './storage';
    const filePath = path.join(storagePath, relativePath);
    
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      const base64 = buffer.toString('base64');
      return `data:image/jpeg;base64,${base64}`;
    }
  }
  
  // URL distante ou data URL - retourner tel quel si déjà base64
  if (url.startsWith('data:')) {
    return url;
  }
  
  // Fetch et convertir en base64
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  return `data:image/jpeg;base64,${base64}`;
}

// Génère une vidéo pour un job
async function generateVideoForJob(job: VideoJob): Promise<{
  nodeId: string;
  success: boolean;
  videoUrl?: string;
  error?: string;
}> {
  try {
    console.log(`[Video Batch API] Starting job for node ${job.nodeId}`);
    
    const model = videoModels[job.modelId];
    if (!model) {
      throw new Error(`Model not found: ${job.modelId}`);
    }

    const provider = model.providers[0];
    
    // Convertir les images en base64
    let firstFrameImage: string | undefined;
    let lastFrameImage: string | undefined;
    
    if (job.images.length > 0 && job.images[0]?.url) {
      firstFrameImage = await readImageContent(job.images[0].url);
      console.log(`[Video Batch API] First frame ready for ${job.nodeId}`);
    }
    
    if (job.images.length > 1 && job.images[job.images.length - 1]?.url) {
      lastFrameImage = await readImageContent(job.images[job.images.length - 1].url);
      console.log(`[Video Batch API] Last frame ready for ${job.nodeId}`);
    }

    console.log(`[Video Batch API] Calling model.generate for ${job.nodeId}`);
    
    // Appeler le modèle avec les paramètres configurés
    const videoUrl = await provider.model.generate({
      prompt: job.prompt,
      imagePrompt: firstFrameImage,
      lastFrameImage: lastFrameImage,
      duration: job.duration || 10, // 10 secondes par défaut
      aspectRatio: job.aspectRatio || '16:9',
    });

    console.log(`[Video Batch API] Got video URL for ${job.nodeId}: ${videoUrl.substring(0, 50)}...`);

    // Télécharger et stocker la vidéo localement
    const videoResponse = await fetch(videoUrl);
    const videoArrayBuffer = await videoResponse.arrayBuffer();
    
    const filename = generateUniqueFilename('mp4');
    const stored = await uploadBuffer(
      Buffer.from(videoArrayBuffer),
      filename,
      'video/mp4'
    );

    console.log(`[Video Batch API] Stored video for ${job.nodeId}: ${stored.url}`);

    return {
      nodeId: job.nodeId,
      success: true,
      videoUrl: stored.url,
    };
  } catch (error) {
    console.error(`[Video Batch API] Error for node ${job.nodeId}:`, error);
    return {
      nodeId: job.nodeId,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function POST(request: Request) {
  try {
    const body: BatchRequest = await request.json();
    const { jobs } = body;

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({ error: 'No jobs provided' }, { status: 400 });
    }

    console.log(`[Video Batch API] Processing ${jobs.length} video jobs in PARALLEL`);

    // Exécuter TOUS les jobs en PARALLÈLE
    const results = await Promise.all(
      jobs.map(job => generateVideoForJob(job))
    );

    console.log(`[Video Batch API] All ${jobs.length} jobs completed`);

    return NextResponse.json({ 
      success: true,
      results,
    });
  } catch (error) {
    console.error('[Video Batch API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

