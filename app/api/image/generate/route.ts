/**
 * API pour déclencher la génération d'image sur un nœud
 * 
 * MODE TEST : utilise size (dimensions en pixels)
 * MODE PROD : utilise aspectRatio + resolution (directement pour WaveSpeed)
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateImageAction } from '@/app/actions/image/create';

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
      model = 'nano-banana-pro-ultra-wavespeed',
      projectId, 
      // Mode TEST ou PROD
      testMode = false,
      // AspectRatio (string comme '9:16', '1:1', etc.)
      aspectRatio = '1:1',
      // Résolution pour PROD (4k ou 8k)
      resolution = '4k',
      // Legacy: size en pixels (utilisé si fourni, sinon calculé pour TEST)
      size,
    } = body;

    if (!nodeId || !prompt) {
      return NextResponse.json(
        { error: 'nodeId et prompt sont requis' },
        { status: 400 }
      );
    }

    const effectiveProjectId = projectId || 'local-generation';
    
    if (testMode) {
      // ========== MODE TEST ==========
      // Utiliser des dimensions en pixels (petites tailles)
      const effectiveSize = size || aspectRatioToTestSize(aspectRatio);
      console.log(`[API Image Generate] 🧪 TEST - ${nodeId}, size: ${effectiveSize}`);

      const result = await generateImageAction({
        prompt,
        modelId: model,
        nodeId,
        projectId: effectiveProjectId,
        size: effectiveSize,
        instructions: '',
      });

      if ('error' in result) {
        console.error('[API Image Generate] Erreur:', result.error);
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true, 
        nodeId,
        nodeData: result.nodeData,
      });
    } else {
      // ========== MODE PROD ==========
      // Passer aspect_ratio et resolution directement à WaveSpeed
      console.log(`[API Image Generate] 🎬 PROD - ${nodeId}, aspect_ratio: ${aspectRatio}, resolution: ${resolution}`);

      const result = await generateImageAction({
        prompt,
        modelId: model,
        nodeId,
        projectId: effectiveProjectId,
        // En mode PROD, on passe aspectRatio et resolution au lieu de size
        aspectRatio,
        resolution,
        instructions: '',
      });

      if ('error' in result) {
        console.error('[API Image Generate] Erreur:', result.error);
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true, 
        nodeId,
        nodeData: result.nodeData,
      });
    }
  } catch (error) {
    console.error('[API Image Generate] Erreur:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500 }
    );
  }
}

