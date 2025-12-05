/**
 * API Route: /api/batch
 * Gère les requêtes de batch processing pour les runs parallèles
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  createBatchJob, 
  getBatchJob, 
  executeBatch, 
  cancelBatchJob,
  getJobsForNode,
  type BatchSettings,
  type GenerateFunction,
} from '@/lib/batch';
import { videoModels } from '@/lib/models/video';
import { imageModels } from '@/lib/models/image';

// Types de génération supportés
type GenerationType = 'video' | 'image' | 'audio';

/**
 * POST /api/batch
 * Démarre un nouveau batch job
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      nodeId, 
      type,
      settings,
    } = body as {
      nodeId: string;
      type: GenerationType;
      settings: BatchSettings;
    };

    // Validation
    if (!nodeId || !type || !settings) {
      return NextResponse.json(
        { error: 'Paramètres manquants: nodeId, type, settings requis' },
        { status: 400 }
      );
    }

    if (!settings.count || settings.count < 1 || settings.count > 100) {
      return NextResponse.json(
        { error: 'count doit être entre 1 et 100' },
        { status: 400 }
      );
    }

    // Créer le job
    const job = createBatchJob(nodeId, settings);

    // Obtenir la fonction de génération appropriée
    const generateFn = getGenerateFunction(type, settings.model, settings.provider);
    
    if (!generateFn) {
      return NextResponse.json(
        { error: `Modèle non supporté: ${settings.model}` },
        { status: 400 }
      );
    }

    // Lancer l'exécution en background (ne pas attendre)
    executeBatch(job, generateFn).catch(console.error);

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: `Batch job créé avec ${settings.count} runs`,
    });

  } catch (error) {
    console.error('Erreur batch POST:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/batch?jobId=xxx ou GET /api/batch?nodeId=xxx
 * Récupère le statut d'un job ou tous les jobs d'un noeud
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    const nodeId = searchParams.get('nodeId');

    if (jobId) {
      const job = getBatchJob(jobId);
      if (!job) {
        return NextResponse.json(
          { error: 'Job non trouvé' },
          { status: 404 }
        );
      }
      return NextResponse.json({ job });
    }

    if (nodeId) {
      const jobs = getJobsForNode(nodeId);
      return NextResponse.json({ jobs });
    }

    return NextResponse.json(
      { error: 'jobId ou nodeId requis' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Erreur batch GET:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/batch?jobId=xxx
 * Annule un job en cours
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        { error: 'jobId requis' },
        { status: 400 }
      );
    }

    const cancelled = cancelBatchJob(jobId);
    
    if (!cancelled) {
      return NextResponse.json(
        { error: 'Job non trouvé ou déjà terminé' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Job annulé',
    });

  } catch (error) {
    console.error('Erreur batch DELETE:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}

/**
 * Retourne la fonction de génération appropriée selon le type et modèle
 */
function getGenerateFunction(
  type: GenerationType,
  modelId: string,
  providerId: string
): GenerateFunction | null {
  switch (type) {
    case 'video':
      return createVideoGenerateFunction(modelId, providerId);
    case 'image':
      return createImageGenerateFunction(modelId, providerId);
    case 'audio':
      return createAudioGenerateFunction(modelId, providerId);
    default:
      return null;
  }
}

/**
 * Crée une fonction de génération vidéo
 */
function createVideoGenerateFunction(
  modelId: string, 
  providerId: string
): GenerateFunction | null {
  const modelConfig = videoModels[modelId];
  if (!modelConfig) return null;

  const provider = modelConfig.providers.find(p => p.id === providerId);
  if (!provider) return null;

  return async (settings) => {
    const result = await (provider as typeof modelConfig.providers[0]).model.generate({
      prompt: settings.prompt,
      imagePrompt: settings.inputs?.imageUrl,
      duration: (settings.duration || 5) as 5 | 10,
      aspectRatio: settings.aspectRatio || '16:9',
    });
    return result;
  };
}

/**
 * Crée une fonction de génération image
 */
function createImageGenerateFunction(
  modelId: string,
  providerId: string
): GenerateFunction | null {
  const modelConfig = imageModels[modelId];
  if (!modelConfig) return null;

  const provider = modelConfig.providers.find((p: { id: string }) => p.id === providerId);
  if (!provider) return null;

  return async (settings) => {
    // Adapter selon l'interface du modèle image
    const typedProvider = provider as typeof modelConfig.providers[0];
    const result = await (typedProvider.model as unknown as { generate: (params: Record<string, unknown>) => Promise<string> }).generate({
      prompt: settings.prompt,
      seed: settings.seed,
      width: parseInt(settings.resolution?.split('x')[0] || '1024'),
      height: parseInt(settings.resolution?.split('x')[1] || '1024'),
    });
    return result;
  };
}

/**
 * Crée une fonction de génération audio
 */
function createAudioGenerateFunction(
  modelId: string,
  providerId: string
): GenerateFunction | null {
  // TODO: Implémenter selon les modèles audio disponibles
  return async (settings, index) => {
    throw new Error('Génération audio non implémentée');
  };
}

