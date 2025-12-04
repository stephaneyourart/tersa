/**
 * API pour éditer une image à partir d'une image source
 * Utilisé pour générer des vues cohérentes (personnages, lieux)
 */

import { NextRequest, NextResponse } from 'next/server';
import { editImageAction } from '@/app/actions/image/edit';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      nodeId, 
      prompt, 
      model = 'nano-banana-pro-edit-multi-wavespeed',
      projectId,
      sourceImages,
      aspectRatio = '1:1',
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

    // Mapper l'aspect ratio vers une taille
    // Mode test : tailles réduites pour aller vite
    const normalSizeMap: Record<string, string> = {
      '1:1': '1024x1024',
      '9:16': '576x1024',
      '16:9': '1024x576',
      '3:4': '768x1024',
      '4:3': '1024x768',
      '21:9': '1344x576',  // Cinémascope pour les images de plan
    };
    
    const testSizeMap: Record<string, string> = {
      '1:1': '256x256',      // Carré mini pour secondaires
      '9:16': '256x456',     // Portrait pour secondaires (personnages, décors)
      '16:9': '456x256',     // Paysage mini
      '3:4': '256x342',      // Portrait 3:4
      '4:3': '342x256',      // Paysage 4:3
      '21:9': '598x256',     // Cinémascope mini pour first/last frames
    };
    
    const sizeMap = testMode ? testSizeMap : normalSizeMap;
    const size = sizeMap[aspectRatio] || (testMode ? '256x256' : '1024x1024');
    console.log(`[API Image Edit] aspectRatio=${aspectRatio} -> size=${size}${testMode ? ' (test)' : ''}`);

    // Support ancien format (string[]) et nouveau format ({ url, originalUrl }[])
    // IMPORTANT: originalUrl est l'URL CloudFront publique pour WaveSpeed (évite base64)
    const normalizedImages = sourceImages.map((img: string | { url: string; originalUrl?: string }) => {
      if (typeof img === 'string') {
        return { url: img, type: 'image/png' };
      }
      return { url: img.url, type: 'image/png', originalUrl: img.originalUrl };
    });

    const result = await editImageAction({
      images: normalizedImages,
      modelId: model,
      instructions: prompt,
      nodeId,
      projectId: effectiveProjectId,
      size,
      numInferenceSteps: testMode ? (numInferenceSteps ?? 5) : numInferenceSteps,
      guidanceScale: testMode ? (guidanceScale ?? 2.5) : guidanceScale,
    });

    if ('error' in result) {
      console.error('[API Image Edit] Erreur:', result.error);
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    console.log(`[API Image Edit] Succès pour nœud ${nodeId}`);
    return NextResponse.json({ 
      success: true, 
      nodeId,
      nodeData: result.nodeData,
    });
  } catch (error) {
    console.error('[API Image Edit] Erreur:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500 }
    );
  }
}

