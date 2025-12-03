/**
 * API pour déclencher la génération de vidéo sur un nœud
 * Utilisé par le GenerationPanel pour la génération séquentielle
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateVideoAction } from '@/app/actions/video/create';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      nodeId, 
      prompt, 
      model = 'kling-o1-i2v',
      projectId,
      images = [],
      copies = 1,
    } = body;

    if (!nodeId || !prompt) {
      return NextResponse.json(
        { error: 'nodeId et prompt sont requis' },
        { status: 400 }
      );
    }

    const effectiveProjectId = projectId || 'local-generation';

    console.log(`[API Video Generate] Node ${nodeId}, modèle ${model}`);
    console.log(`[API Video Generate] ${images.length} images, ${copies} copies`);

    const results = [];
    for (let i = 0; i < copies; i++) {
      console.log(`[API Video Generate] Copie ${i + 1}/${copies}`);
      
      const result = await generateVideoAction({
        prompt,
        modelId: model,
        nodeId: `${nodeId}-copy-${i}`,
        projectId: effectiveProjectId,
        images: images.map((img: string | { url: string; type: string }) => 
          typeof img === 'string' 
            ? { url: img, type: 'image/png' } 
            : img
        ),
      });

      if ('error' in result) {
        console.error(`[API Video Generate] Erreur copie ${i + 1}:`, result.error);
        results.push({ success: false, error: result.error });
      } else {
        console.log(`[API Video Generate] Succès copie ${i + 1}`);
        results.push({ success: true, nodeData: result.nodeData });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`[API Video Generate] ${successCount}/${copies} vidéos OK`);

    return NextResponse.json({ 
      success: successCount > 0, 
      nodeId,
      results,
      successCount,
      totalCopies: copies,
    });
  } catch (error) {
    console.error('[API Video Generate] Erreur:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500 }
    );
  }
}

