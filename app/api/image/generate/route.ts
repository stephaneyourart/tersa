/**
 * API pour déclencher la génération d'image sur un nœud
 * Utilisé par le GenerationPanel pour la génération séquentielle
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateImageAction } from '@/app/actions/image/create';

// Convertir aspect ratio en taille
function aspectRatioToSize(aspectRatio: string): string {
  const sizeMap: Record<string, string> = {
    '1:1': '1024x1024',
    '9:16': '576x1024',
    '16:9': '1024x576',
    '3:4': '768x1024',
    '4:3': '1024x768',
    '21:9': '1344x576',  // Cinémascope pour les images de plan
  };
  return sizeMap[aspectRatio] || '1024x1024';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      nodeId, 
      prompt, 
      model = 'nano-banana-pro-ultra-wavespeed',
      projectId, 
      size,
      aspectRatio = '1:1'
    } = body;

    if (!nodeId || !prompt) {
      return NextResponse.json(
        { error: 'nodeId et prompt sont requis' },
        { status: 400 }
      );
    }

    // Utiliser le projectId fourni ou un ID par défaut pour les projets locaux
    const effectiveProjectId = projectId || 'local-generation';
    
    // Convertir l'aspect ratio en size si pas de size explicite
    const effectiveSize = size || aspectRatioToSize(aspectRatio);

    console.log(`[API Image Generate] Génération pour nœud ${nodeId} avec modèle ${model}, taille: ${effectiveSize}`);

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

    console.log(`[API Image Generate] Succès pour nœud ${nodeId}`);
    return NextResponse.json({ 
      success: true, 
      nodeId,
      nodeData: result.nodeData,
    });
  } catch (error) {
    console.error('[API Image Generate] Erreur:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500 }
    );
  }
}

