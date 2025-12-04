/**
 * Endpoint de test pour la génération vidéo
 * Usage: POST /api/test-video avec body: { imageUrl: "...", prompt: "..." }
 */

import { NextRequest, NextResponse } from 'next/server';
import { videoModels } from '@/lib/models/video';

// Lire une image et la convertir en base64
async function readImageContent(url: string): Promise<string> {
  // Si c'est une URL locale
  if (url.startsWith('/storage/') || url.startsWith('storage/')) {
    const fs = await import('fs/promises');
    const path = await import('path');
    const localPath = path.join(process.cwd(), url.startsWith('/') ? url.slice(1) : url);
    const buffer = await fs.readFile(localPath);
    const ext = path.extname(localPath).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
    return `data:${mime};base64,${buffer.toString('base64')}`;
  }

  // Si c'est une URL externe
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  return `data:${contentType};base64,${buffer.toString('base64')}`;
}

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, prompt, modelId = 'kling-o1-ref' } = await request.json();

    if (!imageUrl) {
      return NextResponse.json({ error: 'imageUrl requis' }, { status: 400 });
    }

    console.log(`[Test Video] Starting with model: ${modelId}`);
    console.log(`[Test Video] Image URL: ${imageUrl}`);
    console.log(`[Test Video] Prompt: ${prompt || 'No prompt'}`);

    const model = videoModels[modelId];
    if (!model) {
      return NextResponse.json({ 
        error: `Model not found: ${modelId}`,
        available: Object.keys(videoModels)
      }, { status: 400 });
    }

    const provider = model.providers[0];
    
    // Convertir l'image en base64
    console.log(`[Test Video] Converting image to base64...`);
    const base64Image = await readImageContent(imageUrl);
    console.log(`[Test Video] Base64 ready, length: ${base64Image.length}`);

    // Générer la vidéo
    console.log(`[Test Video] Calling model.generate...`);
    const videoUrl = await provider.model.generate({
      prompt: prompt || 'Create a smooth cinematic video from this image',
      imagePrompt: base64Image,
      referenceImages: [base64Image],
      duration: 5,
      aspectRatio: '16:9',
    });

    console.log(`[Test Video] Success! Video URL: ${videoUrl}`);

    return NextResponse.json({ 
      success: true,
      videoUrl,
      modelId
    });

  } catch (error: any) {
    console.error('[Test Video] Error:', error);
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

