/**
 * API pour éditer une image à partir d'une image source
 * 
 * MODE TEST : utilise size (dimensions en pixels)
 * MODE PROD : utilise aspectRatio + resolution (directement pour WaveSpeed)
 */

import { NextRequest, NextResponse } from 'next/server';
import { editImageAction } from '@/app/actions/image/edit';

// Convertir aspect ratio en size UNIQUEMENT pour le mode TEST
function aspectRatioToTestSize(aspectRatio: string): string {
  const testSizeMap: Record<string, string> = {
    '1:1': '256x256',
    '9:16': '256x384',
    '16:9': '384x256',
    '3:4': '256x342',
    '4:3': '342x256',
    '3:2': '384x256',
    '2:3': '256x384',
    '21:9': '512x220',
    '9:21': '220x512',
    '4:5': '256x320',
    '5:4': '320x256',
  };
  return testSizeMap[aspectRatio] || '256x256';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      nodeId, 
      prompt, 
      model = 'nano-banana-pro-edit-ultra-wavespeed',
      projectId,
      sourceImages,
      aspectRatio = '1:1',
      resolution = '4k',
      testMode = false,
      numInferenceSteps,
      guidanceScale,
    } = body;

    if (!nodeId || !prompt || !sourceImages || sourceImages.length === 0) {
      return NextResponse.json(
        { error: 'nodeId, prompt et sourceImages sont requis' },
        { status: 400 }
      );
    }

    const effectiveProjectId = projectId || 'local-generation';

    console.log(`[API Image Edit] Édition pour nœud ${nodeId} avec modèle ${model}${testMode ? ' (MODE TEST)' : ''}`);
    console.log(`[API Image Edit] Source images: ${sourceImages.length}, prompt: ${prompt.substring(0, 80)}...`);

    // Support ancien format (string[]) et nouveau format ({ url, originalUrl }[])
    // IMPORTANT: originalUrl est l'URL CloudFront publique pour WaveSpeed (évite base64)
    const normalizedImages = sourceImages.map((img: string | { url: string; originalUrl?: string }) => {
      if (typeof img === 'string') {
        return { url: img, type: 'image/png' };
      }
      return { url: img.url, type: 'image/png', originalUrl: img.originalUrl };
    });

    if (testMode) {
      // ========== MODE TEST ==========
      const size = aspectRatioToTestSize(aspectRatio);
      console.log(`[API Image Edit] 🧪 TEST - aspectRatio=${aspectRatio} -> size=${size}`);

      const result = await editImageAction({
        images: normalizedImages,
        modelId: model,
        instructions: prompt,
        nodeId,
        projectId: effectiveProjectId,
        size,
        numInferenceSteps: numInferenceSteps ?? 5,
        guidanceScale: guidanceScale ?? 2.5,
      });

      if ('error' in result) {
        console.error('[API Image Edit] Erreur:', result.error);
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true, 
        nodeId,
        nodeData: result.nodeData,
      });
    } else {
      // ========== MODE PROD ==========
      console.log(`[API Image Edit] 🎬 PROD - aspectRatio=${aspectRatio}, resolution=${resolution}`);

      const result = await editImageAction({
        images: normalizedImages,
        modelId: model,
        instructions: prompt,
        nodeId,
        projectId: effectiveProjectId,
        aspectRatio,
        resolution,
        numInferenceSteps,
        guidanceScale,
      });

      if ('error' in result) {
        console.error('[API Image Edit] Erreur:', result.error);
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true, 
        nodeId,
        nodeData: result.nodeData,
      });
    }
  } catch (error) {
    console.error('[API Image Edit] Erreur:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500 }
    );
  }
}

