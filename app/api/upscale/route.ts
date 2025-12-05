/**
 * API Route: /api/upscale
 * Gère les requêtes d'upscaling d'images et vidéos
 */

import { NextRequest, NextResponse } from 'next/server';
import { upscaleModels } from '@/lib/models/upscale';
import { saveFromUrl } from '@/lib/storage-local';
import { fLog } from '@/lib/file-logger';

type UpscaleRequest = {
  type: 'image' | 'video';
  model: string;
  imageUrl?: string;
  videoUrl?: string;
  scale?: number;
  creativity?: number; // Pour Lupa AI (-10 à 10)
  enhanceFace?: boolean;
  denoiseStrength?: number;
  saveLocally?: boolean;
};

/**
 * POST /api/upscale
 * Effectue un upscaling d'image ou vidéo
 */
export async function POST(request: NextRequest) {
  // Variables pour le logging (accessibles dans le catch)
  let nodeId = `upscale-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  let type: 'image' | 'video' | undefined;
  let modelId: string | undefined;
  let scale = 2;
  let imageUrl: string | undefined;
  let videoUrl: string | undefined;
  
  try {
    const body = await request.json() as UpscaleRequest;
    type = body.type;
    modelId = body.model;
    imageUrl = body.imageUrl;
    videoUrl = body.videoUrl;
    scale = body.scale || 2;
    const creativity = body.creativity;
    const enhanceFace = body.enhanceFace || false;
    const denoiseStrength = body.denoiseStrength;
    const saveLocally = body.saveLocally !== false;

    // Validation
    if (!type || !modelId) {
      return NextResponse.json(
        { error: 'Paramètres manquants: type et model requis' },
        { status: 400 }
      );
    }

    if (type === 'image' && !imageUrl) {
      return NextResponse.json(
        { error: 'imageUrl requis pour l\'upscaling d\'image' },
        { status: 400 }
      );
    }

    if (type === 'video' && !videoUrl) {
      return NextResponse.json(
        { error: 'videoUrl requis pour l\'upscaling de vidéo' },
        { status: 400 }
      );
    }

    // Récupérer le modèle
    const modelConfig = upscaleModels[modelId];
    if (!modelConfig) {
      return NextResponse.json(
        { error: `Modèle non trouvé: ${modelId}. Modèles disponibles: ${Object.keys(upscaleModels).join(', ')}` },
        { status: 400 }
      );
    }

    // Vérifier la compatibilité type/modèle
    if (modelConfig.type !== type && modelConfig.type !== 'both') {
      return NextResponse.json(
        { error: `Le modèle ${modelId} ne supporte pas le type ${type}` },
        { status: 400 }
      );
    }

    // Vérifier le scale
    if (modelConfig.maxScale && scale > modelConfig.maxScale) {
      return NextResponse.json(
        { error: `Scale maximum pour ${modelId}: ${modelConfig.maxScale}x` },
        { status: 400 }
      );
    }

    // Obtenir le provider par défaut
    const provider = modelConfig.providers[0];
    if (!provider) {
      return NextResponse.json(
        { error: 'Aucun provider disponible pour ce modèle' },
        { status: 500 }
      );
    }

    // Mettre à jour nodeId avec un ID unique basé sur le timestamp actuel
    nodeId = `upscale-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    
    // Log du démarrage
    fLog.upscaleStart(nodeId, modelId, {
      type,
      imageUrl,
      videoUrl,
      scale,
      creativity,
      enhanceFace,
    });

    // Exécuter l'upscaling
    const startTime = Date.now();
    
    const resultUrl = await provider.model.generate({
      imageUrl: type === 'image' ? imageUrl : undefined,
      videoUrl: type === 'video' ? videoUrl : undefined,
      scale,
      creativity, // Pour Lupa AI
      enhanceFace: modelConfig.supportsEnhanceFace ? enhanceFace : undefined,
      denoiseStrength: modelConfig.supportsDenoise ? denoiseStrength : undefined,
    });

    const duration = Date.now() - startTime;

    // Sauvegarder localement si demandé
    let localPath: string | undefined;
    if (saveLocally) {
      try {
        const extension = type === 'image' ? 'png' : 'mp4';
        const stored = await saveFromUrl(resultUrl, `upscaled-${Date.now()}.${extension}`);
        localPath = stored.path;
      } catch (error) {
        console.error('Erreur sauvegarde locale:', error);
        // Continue même si la sauvegarde échoue
      }
    }

    // Calculer le coût estimé
    const cost = provider.getCost({ scale });

    // Log du succès
    fLog.upscaleSuccess(nodeId, modelId, {
      type,
      resultUrl,
      scale,
      duration,
      cost,
      localPath,
    });

    return NextResponse.json({
      success: true,
      result: {
        url: resultUrl,
        localPath,
        model: modelId,
        scale,
        type,
        duration,
        cost,
      },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur serveur';
    console.error('Erreur upscale:', error);
    
    // Log de l'erreur avec contexte
    fLog.upscaleError(nodeId, modelId || 'unknown', errorMessage, {
      type,
      scale,
      sourceUrl: type === 'image' ? imageUrl : videoUrl,
    });
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * GET /api/upscale/models
 * Liste les modèles d'upscaling disponibles
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') as 'image' | 'video' | null;

  const models = Object.entries(upscaleModels)
    .filter(([_, model]) => !type || model.type === type || model.type === 'both')
    .map(([id, model]) => ({
      id,
      label: model.label,
      type: model.type,
      maxScale: model.maxScale,
      supportsEnhanceFace: model.supportsEnhanceFace,
      supportsDenoise: model.supportsDenoise,
      isDefault: model.default,
      providers: model.providers.map(p => ({
        id: p.id,
        name: p.name,
      })),
    }));

  return NextResponse.json({ models });
}

