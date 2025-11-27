/**
 * API Route: /api/upscale
 * Gère les requêtes d'upscaling d'images et vidéos
 */

import { NextRequest, NextResponse } from 'next/server';
import { upscaleModels } from '@/lib/models/upscale';
import { saveFromUrl } from '@/lib/storage-local';

type UpscaleRequest = {
  type: 'image' | 'video';
  model: string;
  imageUrl?: string;
  videoUrl?: string;
  scale?: number;
  enhanceFace?: boolean;
  denoiseStrength?: number;
  saveLocally?: boolean;
};

/**
 * POST /api/upscale
 * Effectue un upscaling d'image ou vidéo
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as UpscaleRequest;
    const { 
      type,
      model: modelId,
      imageUrl,
      videoUrl,
      scale = 2,
      enhanceFace = false,
      denoiseStrength,
      saveLocally = true,
    } = body;

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

    // Exécuter l'upscaling
    const startTime = Date.now();
    
    const resultUrl = await provider.model.generate({
      imageUrl: type === 'image' ? imageUrl : undefined,
      videoUrl: type === 'video' ? videoUrl : undefined,
      scale,
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
    console.error('Erreur upscale:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
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

