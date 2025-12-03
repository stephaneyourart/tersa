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
    } = body;

    if (!nodeId || !prompt || !sourceImages || sourceImages.length === 0) {
      return NextResponse.json(
        { error: 'nodeId, prompt et sourceImages sont requis' },
        { status: 400 }
      );
    }

    const effectiveProjectId = projectId || 'local-generation';

    console.log(`[API Image Edit] Édition pour nœud ${nodeId} avec modèle ${model}`);
    console.log(`[API Image Edit] Source images: ${sourceImages.length}, prompt: ${prompt.substring(0, 80)}...`);

    // Mapper l'aspect ratio vers une taille
    const sizeMap: Record<string, string> = {
      '1:1': '1024x1024',
      '9:16': '576x1024',
      '16:9': '1024x576',
      '3:4': '768x1024',
      '4:3': '1024x768',
    };
    const size = sizeMap[aspectRatio] || '1024x1024';

    const result = await editImageAction({
      images: sourceImages.map((url: string) => ({ url, type: 'image/png' })),
      modelId: model,
      instructions: prompt,
      nodeId,
      projectId: effectiveProjectId,
      size,
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

