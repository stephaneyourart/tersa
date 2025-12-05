/**
 * API Route pour génération vidéo en batch PARALLÈLE
 * Contourne la limitation des Server Actions qui s'exécutent séquentiellement
 */

import { NextResponse } from 'next/server';
import { videoModels } from '@/lib/models/video';
import { uploadBuffer, generateUniqueFilename } from '@/lib/storage';

interface VideoJob {
  nodeId: string;
  modelId: string;
  prompt: string;
  images: { url: string; type: string; originalUrl?: string }[]; // originalUrl = CloudFront URL pour WaveSpeed
  duration?: number; // Durée en secondes (défaut: 10)
  aspectRatio?: string; // Aspect ratio (défaut: 16:9)
}

interface BatchRequest {
  jobs: VideoJob[];
  projectId: string;
}

// Retourne l'URL publique pour WaveSpeed (CloudFront en priorité)
function getPublicImageUrl(img: { url: string; originalUrl?: string }): string | null {
  // Priorité 1: URL CloudFront originale (stockée lors de la génération)
  if (img.originalUrl && (img.originalUrl.startsWith('http://') || img.originalUrl.startsWith('https://'))) {
    console.log(`[Video Batch API] Using original CloudFront URL: ${img.originalUrl.substring(0, 80)}...`);
    return img.originalUrl;
  }
  
  // Priorité 2: URL publique directe
  if (img.url.startsWith('http://') || img.url.startsWith('https://')) {
    console.log(`[Video Batch API] Using public URL: ${img.url.substring(0, 80)}...`);
    return img.url;
  }
  
  // Les URLs locales (/api/storage/...) ne sont pas accessibles par WaveSpeed
  if (img.url.startsWith('/api/storage/')) {
    console.log(`[Video Batch API] ⚠️ Local URL not accessible by WaveSpeed: ${img.url}`);
    console.log(`[Video Batch API] → Need originalUrl (CloudFront) for this image`);
    return null;
  }
  
  // data: URLs ne sont pas supportées
  if (img.url.startsWith('data:')) {
    console.log(`[Video Batch API] data: URL not supported for WaveSpeed`);
    return null;
  }
  
  return null;
}

// Génère une vidéo pour un job
async function generateVideoForJob(job: VideoJob): Promise<{
  nodeId: string;
  success: boolean;
  videoUrl?: string;
  error?: string;
}> {
  try {
    console.log(`[Video Batch API] Starting job for node ${job.nodeId}, modelId: ${job.modelId}`);
    
    // Utiliser kling-o1-ref (reference-to-video) pour avoir des vidéos cohérentes
    // Ce modèle utilise les images de référence (personnages, décors) pour maintenir la cohérence
    const safeModelId = 'kling-o1-ref';
    const model = videoModels[safeModelId];
    if (!model) {
      throw new Error(`Model not found: ${safeModelId}`);
    }
    console.log(`[Video Batch API] Using model: ${safeModelId} (kling-video-o1/reference-to-video)`);
    

    const provider = model.providers[0];
    
    // Passer les URLs publiques directement à WaveSpeed (PAS de base64 !)
    // LIMITE KLING : Maximum 7 images de référence
    // Stratégie : 3 images décor + 2 par personnage (face + fullBody)
    const MAX_REFERENCE_IMAGES = 7;
    const referenceImages: string[] = [];
    
    console.log(`[Video Batch API] Processing ${job.images.length} images for ${job.nodeId} (limit: ${MAX_REFERENCE_IMAGES} images)`);
    
    for (const img of job.images) {
      if (img?.url) {
        // Atteint la limite d'images ?
        if (referenceImages.length >= MAX_REFERENCE_IMAGES) {
          console.log(`[Video Batch API] Reached max ${MAX_REFERENCE_IMAGES} images (Kling limit)`);
          break;
        }
        
        try {
          // Passer l'objet complet pour utiliser originalUrl si disponible
          const publicUrl = getPublicImageUrl(img);
          
          if (publicUrl) {
            referenceImages.push(publicUrl);
            console.log(`[Video Batch API] Added image ${referenceImages.length}/${MAX_REFERENCE_IMAGES}: ${publicUrl.substring(0, 80)}...`);
          } else {
            console.warn(`[Video Batch API] Skipped non-public image: ${img.url.substring(0, 50)}...`);
          }
        } catch (e) {
          console.warn(`[Video Batch API] Failed to process image: ${img.url}`, e);
        }
      }
    }
    
    console.log(`[Video Batch API] Final: ${referenceImages.length}/${MAX_REFERENCE_IMAGES} public URLs`);
    
    console.log(`[Video Batch API] ${referenceImages.length} reference images ready for ${job.nodeId}`);

    if (referenceImages.length === 0) {
      throw new Error('Aucune image de référence disponible');
    }

    console.log(`[Video Batch API] Calling model.generate for ${job.nodeId}`);
    
    // Appeler le modèle reference-to-video avec les images de référence (limitées)
    const videoUrl = await provider.model.generate({
      prompt: job.prompt,
      imagePrompt: referenceImages[0], // Première image comme image principale
      referenceImages: referenceImages, // Images de référence limitées
      duration: (job.duration || 10) as 5 | 10, // 10 secondes par défaut
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

