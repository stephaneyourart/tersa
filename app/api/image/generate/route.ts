/**
 * API pour déclencher la génération d'image sur un nœud
 * Utilisé par le GenerationPanel pour la génération séquentielle
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateImageAction } from '@/app/actions/image/create';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nodeId, prompt, model = 'nano-banana-pro-wavespeed', projectId, size = '1024x1024' } = body;

    if (!nodeId || !prompt) {
      return NextResponse.json(
        { error: 'nodeId et prompt sont requis' },
        { status: 400 }
      );
    }

    // Utiliser le projectId fourni ou un ID par défaut pour les projets locaux
    const effectiveProjectId = projectId || 'local-generation';

    console.log(`[API Image Generate] Génération pour nœud ${nodeId} avec modèle ${model}`);

    const result = await generateImageAction({
      prompt,
      modelId: model,
      nodeId,
      projectId: effectiveProjectId,
      size,
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

