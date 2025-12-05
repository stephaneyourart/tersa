/**
 * API pour déclencher la génération de vidéo sur un nœud
 * Utilisé par le GenerationPanel pour la génération séquentielle
 * 
 * NOUVEAU : Supporte le mode first+last frame pour les briefs
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateVideoAction } from '@/app/actions/video/create';
import { fLog } from '@/lib/file-logger';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { 
      nodeId, 
      prompt, 
      model = 'kling-o1-i2v',
      projectId,
      images = [],
      copies = 1,
      // NOUVEAU : Support first+last frame pour les briefs
      imagePrompt,      // First frame (image de départ)
      lastFrameImage,   // Last frame (image de fin) 
    } = body;

    if (!nodeId || !prompt) {
      fLog.error('nodeId et prompt manquants', { nodeId, hasPrompt: !!prompt });
      return NextResponse.json(
        { error: 'nodeId et prompt sont requis' },
        { status: 400 }
      );
    }

    const effectiveProjectId = projectId || 'local-generation';
    const mode = lastFrameImage ? 'first+last' : 'first-only';

    fLog.videoStart(nodeId, model, 5, mode);
    console.log(`[API Video Generate] Node ${nodeId}, modèle ${model}`);
    
    // Construire le tableau d'images
    // Si on a imagePrompt et lastFrameImage explicites, les utiliser
    // Sinon, utiliser le tableau images classique
    let finalImages: { url: string; type: string }[] = [];
    
    if (imagePrompt || lastFrameImage) {
      // Mode first+last frame (nouveau workflow briefs)
      if (imagePrompt) {
        finalImages.push({ url: imagePrompt, type: 'image/png' });
      }
      if (lastFrameImage) {
        finalImages.push({ url: lastFrameImage, type: 'image/png' });
      }
      console.log(`[API Video Generate] Mode first+last frame: ${imagePrompt ? 'first' : ''} ${lastFrameImage ? 'last' : ''}`);
    } else {
      // Mode classique avec tableau d'images
      finalImages = images.map((img: string | { url: string; type: string }) => 
        typeof img === 'string' 
          ? { url: img, type: 'image/png' } 
          : img
      );
    }
    
    console.log(`[API Video Generate] ${finalImages.length} images, ${copies} copies`);

    const results = [];
    for (let i = 0; i < copies; i++) {
      console.log(`[API Video Generate] Copie ${i + 1}/${copies}`);
      
      const result = await generateVideoAction({
        prompt,
        modelId: model,
        nodeId: `${nodeId}-copy-${i}`,
        projectId: effectiveProjectId,
        images: finalImages,
      });

      if ('error' in result) {
        console.error(`[API Video Generate] Erreur copie ${i + 1}:`, result.error);
        fLog.videoError(nodeId, model, result.error);
        results.push({ success: false, error: result.error });
      } else {
        const duration = Date.now() - startTime;
        console.log(`[API Video Generate] Succès copie ${i + 1}`);
        fLog.videoSuccess(nodeId, model, result.nodeData?.url || 'unknown', duration);
        results.push({ success: true, nodeData: result.nodeData });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalDuration = Date.now() - startTime;
    console.log(`[API Video Generate] ${successCount}/${copies} vidéos OK`);
    fLog.system(`Video batch terminé: ${successCount}/${copies} OK en ${totalDuration}ms`, { nodeId, model });

    return NextResponse.json({ 
      success: successCount > 0, 
      nodeId,
      results,
      successCount,
      totalCopies: copies,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[API Video Generate] Erreur:', error);
    fLog.error(`Video API crash après ${duration}ms: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500 }
    );
  }
}

