/**
 * Générateur de médias en parallèle pour les briefs
 * 
 * NOUVELLE ARCHITECTURE DE GÉNÉRATION :
 * 1. TOUTES les images primaires (personnages + décors) sont lancées SIMULTANÉMENT
 * 2. Dès qu'une image primaire est prête, ses 3 variantes sont lancées EN PARALLÈLE
 * 3. NOUVEAU: Images de plan (départ 21:9 + fin 21:9) générées par EDIT depuis les collections
 * 4. Vidéos avec first frame (départ) + last frame (fin) + prompt action - KLING v2.6
 */

import type { QualityLevel } from '@/types/brief';
import { 
  getTextToImageModel, 
  getEditModel, 
  getQualityParams,
  IMAGE_RATIOS,
  DEFAULT_QUALITY_MODEL_CONFIG
} from '@/lib/brief-defaults';

// ========== TYPES ==========

interface ImageGenerationTask {
  nodeId: string;
  type: 'primary' | 'variant' | 'plan_depart' | 'plan_fin';
  entityType: 'character' | 'decor' | 'plan';
  entityId: string;
  viewType: string;
  prompt: string;
  aspectRatio: string;
  referenceImageId?: string;  // Pour les variantes : ID du nœud de l'image primaire
  referenceImageUrl?: string; // Pour les variantes : URL de l'image primaire une fois générée
  referenceImageUrls?: string[]; // Pour les images de plan : URLs des collections
}

interface VideoGenerationTask {
  planId: string;
  videoNodeId: string;
  prompt: string;
  imageDepartUrl?: string;    // NOUVEAU: URL de l'image de départ (first frame)
  imageFinUrl?: string;       // NOUVEAU: URL de l'image de fin (last frame)
  duration: number;
  usesFirstLastFrame: boolean;
}

interface GenerationProgress {
  phase: 'primary_images' | 'variant_images' | 'plan_images' | 'videos' | 'complete';
  total: number;
  completed: number;
  failed: number;
  currentTasks: string[];
}

interface GenerationResult {
  nodeId: string;
  success: boolean;
  url?: string;
  error?: string;
}

// ========== GÉNÉRATEUR PRINCIPAL ==========

export interface ParallelGenerationOptions {
  quality: QualityLevel;
  characterImages: Array<{
    characterId: string;
    imageNodeIds: string[];
    prompts: Record<string, string>;
    aspectRatios: Record<string, string>;
    order: string[];
    generationTypes?: Record<string, string>;
    primaryNodeId?: string;
  }>;
  decorImages: Array<{
    decorId: string;
    imageNodeIds: string[];
    prompts: Record<string, string>;
    aspectRatios: Record<string, string>;
    order: string[];
    generationTypes?: Record<string, string>;
    primaryNodeId?: string;
  }>;
  // NOUVEAU: Images de plan (départ/fin)
  planImages?: Array<{
    planId: string;
    imageDepartNodeId: string;
    imageFinNodeId: string;
    promptDepart: string;
    promptFin: string;
    aspectRatio: string;  // 21:9
    characterCollectionIds: string[];
    decorCollectionId?: string;
  }>;
  videos: Array<{
    planId: string;
    videoNodeIds: string[];
    prompt: string;
    imageDepartNodeId?: string;   // NOUVEAU: ID de l'image de départ
    imageFinNodeId?: string;      // NOUVEAU: ID de l'image de fin
    characterCollectionIds: string[];
    decorCollectionId?: string;
    usesFirstLastFrame?: boolean;
  }>;
  videoSettings: { duration: number; aspectRatio: string };
  onProgress?: (progress: GenerationProgress) => void;
  onImageGenerated?: (result: GenerationResult) => void;
  onVideoGenerated?: (result: GenerationResult) => void;
}

/**
 * Lance la génération de TOUS les médias en parallèle maximal
 */
export async function generateAllMediaParallel(
  options: ParallelGenerationOptions
): Promise<{ images: GenerationResult[]; videos: GenerationResult[] }> {
  const {
    quality,
    characterImages,
    decorImages,
    planImages,
    videos,
    videoSettings,
    onProgress,
    onImageGenerated,
    onVideoGenerated,
  } = options;

  const imageResults: GenerationResult[] = [];
  const videoResults: GenerationResult[] = [];

  // Map pour stocker les URLs des images par nodeId
  const imageUrlsMap = new Map<string, string>();
  
  // Map pour suivre les collections prêtes (personnages et décors)
  const readyCollections = new Set<string>();

  console.log('[ParallelGen] Démarrage génération parallèle (NOUVEAU WORKFLOW)');
  console.log(`[ParallelGen] ${characterImages.length} personnages, ${decorImages.length} décors`);
  console.log(`[ParallelGen] ${planImages?.length || 0} plans avec images départ/fin`);
  console.log(`[ParallelGen] ${videos.length} vidéos avec first+last frame`);

  // ========== PHASE 1 : TOUTES LES IMAGES PRIMAIRES EN PARALLÈLE ==========
  const primaryTasks: ImageGenerationTask[] = [];

  // Collecter toutes les tâches d'images primaires
  for (const char of characterImages) {
    const primaryKey = char.order[0]; // 'primary' ou 'fullBody'
    const nodeIdIndex = char.order.indexOf(primaryKey);
    if (nodeIdIndex >= 0 && char.imageNodeIds[nodeIdIndex]) {
      primaryTasks.push({
        nodeId: char.imageNodeIds[nodeIdIndex],
        type: 'primary',
        entityType: 'character',
        entityId: char.characterId,
        viewType: primaryKey,
        prompt: char.prompts[primaryKey],
        aspectRatio: char.aspectRatios[primaryKey] || IMAGE_RATIOS.character.primary,
      });
    }
  }

  for (const decor of decorImages) {
    const primaryKey = decor.order[0]; // 'primary' ou 'angle1'
    const nodeIdIndex = decor.order.indexOf(primaryKey);
    if (nodeIdIndex >= 0 && decor.imageNodeIds[nodeIdIndex]) {
      primaryTasks.push({
        nodeId: decor.imageNodeIds[nodeIdIndex],
        type: 'primary',
        entityType: 'decor',
        entityId: decor.decorId,
        viewType: primaryKey,
        prompt: decor.prompts[primaryKey],
        aspectRatio: decor.aspectRatios[primaryKey] || IMAGE_RATIOS.decor.primary,
      });
    }
  }

  console.log(`[ParallelGen] Phase 1 : ${primaryTasks.length} images primaires à générer SIMULTANÉMENT`);
  onProgress?.({
    phase: 'primary_images',
    total: primaryTasks.length,
    completed: 0,
    failed: 0,
    currentTasks: primaryTasks.map(t => t.nodeId),
  });

  // Lancer TOUTES les images primaires EN PARALLÈLE
  const primaryPromises = primaryTasks.map(async (task) => {
    try {
      const model = getTextToImageModel(quality);
      const extraParams = getQualityParams(quality);
      
      console.log(`[ParallelGen] Génération primaire ${task.entityType}/${task.entityId}/${task.viewType}`);
      
      const result = await generateImage({
        prompt: task.prompt,
        model,
        aspectRatio: task.aspectRatio,
        ...extraParams,
      });

      if (result.success && result.url) {
        imageUrlsMap.set(task.nodeId, result.url);
        imageResults.push({ nodeId: task.nodeId, success: true, url: result.url });
        onImageGenerated?.({ nodeId: task.nodeId, success: true, url: result.url });
        console.log(`[ParallelGen] ✓ Primaire ${task.nodeId} générée`);
      } else {
        imageResults.push({ nodeId: task.nodeId, success: false, error: result.error });
        onImageGenerated?.({ nodeId: task.nodeId, success: false, error: result.error });
        console.error(`[ParallelGen] ✗ Primaire ${task.nodeId} échouée:`, result.error);
      }

      return { task, result };
    } catch (error: any) {
      imageResults.push({ nodeId: task.nodeId, success: false, error: error.message });
      onImageGenerated?.({ nodeId: task.nodeId, success: false, error: error.message });
      return { task, result: { success: false, error: error.message } };
    }
  });

  // Attendre que toutes les images primaires soient générées
  const primaryResults = await Promise.allSettled(primaryPromises);
  
  const successfulPrimaries = primaryResults.filter(
    r => r.status === 'fulfilled' && r.value.result.success
  ).length;
  
  console.log(`[ParallelGen] Phase 1 terminée : ${successfulPrimaries}/${primaryTasks.length} réussies`);

  // ========== PHASE 2 : TOUTES LES VARIANTES EN PARALLÈLE ==========
  const variantTasks: ImageGenerationTask[] = [];

  for (const char of characterImages) {
    const primaryNodeId = char.primaryNodeId || char.imageNodeIds[0];
    const primaryUrl = imageUrlsMap.get(primaryNodeId);
    
    if (!primaryUrl) {
      console.log(`[ParallelGen] Pas d'image primaire pour personnage ${char.characterId}, skip variantes`);
      continue;
    }

    // Ajouter les variantes (tous sauf le premier qui est primaire)
    for (let i = 1; i < char.order.length; i++) {
      const viewType = char.order[i];
      const nodeId = char.imageNodeIds[i];
      
      variantTasks.push({
        nodeId,
        type: 'variant',
        entityType: 'character',
        entityId: char.characterId,
        viewType,
        prompt: char.prompts[viewType],
        aspectRatio: char.aspectRatios[viewType] || '1:1',
        referenceImageId: primaryNodeId,
        referenceImageUrl: primaryUrl,
      });
    }
  }

  for (const decor of decorImages) {
    const primaryNodeId = decor.primaryNodeId || decor.imageNodeIds[0];
    const primaryUrl = imageUrlsMap.get(primaryNodeId);
    
    if (!primaryUrl) {
      console.log(`[ParallelGen] Pas d'image primaire pour décor ${decor.decorId}, skip variantes`);
      continue;
    }

    // Ajouter les variantes (tous sauf le premier qui est primaire)
    for (let i = 1; i < decor.order.length; i++) {
      const viewType = decor.order[i];
      const nodeId = decor.imageNodeIds[i];
      
      variantTasks.push({
        nodeId,
        type: 'variant',
        entityType: 'decor',
        entityId: decor.decorId,
        viewType,
        prompt: decor.prompts[viewType],
        aspectRatio: decor.aspectRatios[viewType] || '16:9',
        referenceImageId: primaryNodeId,
        referenceImageUrl: primaryUrl,
      });
    }
  }

  console.log(`[ParallelGen] Phase 2 : ${variantTasks.length} variantes à générer SIMULTANÉMENT`);
  onProgress?.({
    phase: 'variant_images',
    total: variantTasks.length,
    completed: 0,
    failed: 0,
    currentTasks: variantTasks.map(t => t.nodeId),
  });

  // Lancer TOUTES les variantes EN PARALLÈLE
  const variantPromises = variantTasks.map(async (task) => {
    try {
      const model = getEditModel(quality);
      const extraParams = getQualityParams(quality);
      
      console.log(`[ParallelGen] Génération variante ${task.entityType}/${task.entityId}/${task.viewType}`);
      
      const result = await generateImageEdit({
        prompt: task.prompt,
        referenceImageUrl: task.referenceImageUrl!,
        model,
        aspectRatio: task.aspectRatio,
        ...extraParams,
      });

      if (result.success && result.url) {
        imageUrlsMap.set(task.nodeId, result.url);
        imageResults.push({ nodeId: task.nodeId, success: true, url: result.url });
        onImageGenerated?.({ nodeId: task.nodeId, success: true, url: result.url });
        console.log(`[ParallelGen] ✓ Variante ${task.nodeId} générée`);
      } else {
        imageResults.push({ nodeId: task.nodeId, success: false, error: result.error });
        onImageGenerated?.({ nodeId: task.nodeId, success: false, error: result.error });
        console.error(`[ParallelGen] ✗ Variante ${task.nodeId} échouée:`, result.error);
      }

      return { task, result };
    } catch (error: any) {
      imageResults.push({ nodeId: task.nodeId, success: false, error: error.message });
      onImageGenerated?.({ nodeId: task.nodeId, success: false, error: error.message });
      return { task, result: { success: false, error: error.message } };
    }
  });

  // Attendre que toutes les variantes soient générées
  await Promise.allSettled(variantPromises);

  // Marquer toutes les collections comme prêtes
  for (const char of characterImages) {
    readyCollections.add(char.characterId);
  }
  for (const decor of decorImages) {
    readyCollections.add(decor.decorId);
  }

  // ========== PHASE 3 : IMAGES DE PLAN (DÉPART/FIN) EN PARALLÈLE ==========
  // Ces images sont générées par EDIT à partir des images des collections
  if (planImages && planImages.length > 0) {
    const planImageTasks: ImageGenerationTask[] = [];

    for (const plan of planImages) {
      // Collecter toutes les URLs des images de référence pour ce plan
      const referenceUrls: string[] = [];
      
      // Images des personnages impliqués (prendre la primaire de chaque)
      for (const charId of plan.characterCollectionIds) {
        // Trouver le nodeId de l'image primaire du personnage
        const charInfo = characterImages.find(c => c.characterId === charId);
        if (charInfo) {
          const primaryNodeId = charInfo.primaryNodeId || charInfo.imageNodeIds[0];
          const url = imageUrlsMap.get(primaryNodeId);
          if (url) referenceUrls.push(url);
        }
      }
      
      // Image du décor (prendre la primaire)
      if (plan.decorCollectionId) {
        const decorInfo = decorImages.find(d => d.decorId === plan.decorCollectionId);
        if (decorInfo) {
          const primaryNodeId = decorInfo.primaryNodeId || decorInfo.imageNodeIds[0];
          const url = imageUrlsMap.get(primaryNodeId);
          if (url) referenceUrls.push(url);
        }
      }

      // Image de DÉPART
      planImageTasks.push({
        nodeId: plan.imageDepartNodeId,
        type: 'plan_depart',
        entityType: 'plan',
        entityId: plan.planId,
        viewType: 'depart',
        prompt: plan.promptDepart,
        aspectRatio: plan.aspectRatio || IMAGE_RATIOS.plan?.depart || '21:9',
        referenceImageUrls: referenceUrls,
      });

      // Image de FIN
      planImageTasks.push({
        nodeId: plan.imageFinNodeId,
        type: 'plan_fin',
        entityType: 'plan',
        entityId: plan.planId,
        viewType: 'fin',
        prompt: plan.promptFin,
        aspectRatio: plan.aspectRatio || IMAGE_RATIOS.plan?.fin || '21:9',
        referenceImageUrls: referenceUrls,
      });
    }

    console.log(`[ParallelGen] Phase 3 : ${planImageTasks.length} images de plan à générer SIMULTANÉMENT`);
    onProgress?.({
      phase: 'plan_images',
      total: planImageTasks.length,
      completed: 0,
      failed: 0,
      currentTasks: planImageTasks.map(t => t.nodeId),
    });

    // Lancer TOUTES les images de plan EN PARALLÈLE
    const planImagePromises = planImageTasks.map(async (task) => {
      try {
        const model = getEditModel(quality);
        const extraParams = getQualityParams(quality);
        
        console.log(`[ParallelGen] Génération image plan ${task.entityId}/${task.viewType}`);
        
        // Utiliser la première image de référence pour l'edit
        const mainReference = task.referenceImageUrls?.[0];
        if (!mainReference) {
          throw new Error(`Pas d'image de référence pour le plan ${task.entityId}`);
        }
        
        const result = await generateImageEditMultiple({
          prompt: task.prompt,
          referenceImageUrls: task.referenceImageUrls || [],
          model,
          aspectRatio: task.aspectRatio,
          ...extraParams,
        });

        if (result.success && result.url) {
          imageUrlsMap.set(task.nodeId, result.url);
          imageResults.push({ nodeId: task.nodeId, success: true, url: result.url });
          onImageGenerated?.({ nodeId: task.nodeId, success: true, url: result.url });
          console.log(`[ParallelGen] ✓ Image plan ${task.nodeId} générée`);
        } else {
          imageResults.push({ nodeId: task.nodeId, success: false, error: result.error });
          onImageGenerated?.({ nodeId: task.nodeId, success: false, error: result.error });
          console.error(`[ParallelGen] ✗ Image plan ${task.nodeId} échouée:`, result.error);
        }

        return { task, result };
      } catch (error: any) {
        imageResults.push({ nodeId: task.nodeId, success: false, error: error.message });
        onImageGenerated?.({ nodeId: task.nodeId, success: false, error: error.message });
        return { task, result: { success: false, error: error.message } };
      }
    });

    // Attendre que toutes les images de plan soient générées
    await Promise.allSettled(planImagePromises);
  }

  // ========== PHASE 4 : VIDÉOS EN PARALLÈLE (avec first+last frame) ==========
  const videoTasks: VideoGenerationTask[] = [];
  
  for (const video of videos) {
    // Récupérer les URLs des images de plan
    const imageDepartUrl = video.imageDepartNodeId ? imageUrlsMap.get(video.imageDepartNodeId) : undefined;
    const imageFinUrl = video.imageFinNodeId ? imageUrlsMap.get(video.imageFinNodeId) : undefined;
    
    for (const videoNodeId of video.videoNodeIds) {
      videoTasks.push({
        planId: video.planId,
        videoNodeId,
        prompt: video.prompt,
        imageDepartUrl,
        imageFinUrl,
        duration: videoSettings.duration,
        usesFirstLastFrame: video.usesFirstLastFrame || false,
      });
    }
  }

  console.log(`[ParallelGen] Phase 4 : ${videoTasks.length} vidéos à générer SIMULTANÉMENT (first+last frame)`);
  onProgress?.({
    phase: 'videos',
    total: videoTasks.length,
    completed: 0,
    failed: 0,
    currentTasks: videoTasks.map(t => t.videoNodeId),
  });

  // Lancer TOUTES les vidéos EN PARALLÈLE
  const videoPromises = videoTasks.map(async (task) => {
    try {
      console.log(`[ParallelGen] Génération vidéo ${task.videoNodeId} (first+last: ${task.usesFirstLastFrame})`);
      
      let result;
      if (task.usesFirstLastFrame && task.imageDepartUrl && task.imageFinUrl) {
        // NOUVEAU WORKFLOW : first frame + last frame + prompt action
        result = await generateVideoFirstLast({
          prompt: task.prompt,
          firstFrameUrl: task.imageDepartUrl,
          lastFrameUrl: task.imageFinUrl,
          duration: task.duration,
        });
      } else {
        // Ancien workflow : juste une image de référence
        result = await generateVideo({
          prompt: task.prompt,
          referenceImages: task.imageDepartUrl ? [task.imageDepartUrl] : [],
          aspectRatio: '16:9',
          duration: task.duration,
        });
      }

      if (result.success && result.url) {
        videoResults.push({ nodeId: task.videoNodeId, success: true, url: result.url });
        onVideoGenerated?.({ nodeId: task.videoNodeId, success: true, url: result.url });
        console.log(`[ParallelGen] ✓ Vidéo ${task.videoNodeId} générée`);
      } else {
        videoResults.push({ nodeId: task.videoNodeId, success: false, error: result.error });
        onVideoGenerated?.({ nodeId: task.videoNodeId, success: false, error: result.error });
        console.error(`[ParallelGen] ✗ Vidéo ${task.videoNodeId} échouée:`, result.error);
      }

      return { task, result };
    } catch (error: any) {
      videoResults.push({ nodeId: task.videoNodeId, success: false, error: error.message });
      onVideoGenerated?.({ nodeId: task.videoNodeId, success: false, error: error.message });
      return { task, result: { success: false, error: error.message } };
    }
  });

  // Attendre que toutes les vidéos soient générées
  await Promise.allSettled(videoPromises);

  const totalTasks = primaryTasks.length + variantTasks.length + 
    (planImages?.length || 0) * 2 + videoTasks.length;
  
  onProgress?.({
    phase: 'complete',
    total: totalTasks,
    completed: imageResults.filter(r => r.success).length + videoResults.filter(r => r.success).length,
    failed: imageResults.filter(r => !r.success).length + videoResults.filter(r => !r.success).length,
    currentTasks: [],
  });

  console.log('[ParallelGen] Génération terminée (NOUVEAU WORKFLOW)');
  console.log(`[ParallelGen] Images : ${imageResults.filter(r => r.success).length}/${imageResults.length}`);
  console.log(`[ParallelGen] Vidéos : ${videoResults.filter(r => r.success).length}/${videoResults.length}`);

  return { images: imageResults, videos: videoResults };
}

// ========== FONCTIONS D'APPEL API ==========

interface ImageGenerationParams {
  prompt: string;
  model: string;
  aspectRatio: string;
  resolution?: string;
}

async function generateImage(params: ImageGenerationParams): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const response = await fetch('/api/image/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: params.prompt,
        model: params.model,
        aspectRatio: params.aspectRatio,
        resolution: params.resolution,
        format: 'jpeg',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `API error: ${error}` };
    }

    const data = await response.json();
    return { success: true, url: data.url || data.imageUrl };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

interface ImageEditParams {
  prompt: string;
  referenceImageUrl: string;
  model: string;
  aspectRatio: string;
  resolution?: string;
}

async function generateImageEdit(params: ImageEditParams): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const response = await fetch('/api/image/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: params.prompt,
        imageUrl: params.referenceImageUrl,
        model: params.model,
        aspectRatio: params.aspectRatio,
        resolution: params.resolution,
        format: 'jpeg',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `API error: ${error}` };
    }

    const data = await response.json();
    return { success: true, url: data.url || data.imageUrl };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

interface ImageEditMultipleParams {
  prompt: string;
  referenceImageUrls: string[];
  model: string;
  aspectRatio: string;
  resolution?: string;
}

/**
 * Génère une image en utilisant plusieurs images de référence
 * Utilisé pour les images de plan (départ/fin) qui combinent personnages + décor
 */
async function generateImageEditMultiple(params: ImageEditMultipleParams): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const response = await fetch('/api/image/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: params.prompt,
        // L'API devrait supporter un tableau d'images
        imageUrls: params.referenceImageUrls,
        imageUrl: params.referenceImageUrls[0], // Fallback pour API qui ne supporte qu'une image
        model: params.model,
        aspectRatio: params.aspectRatio,
        resolution: params.resolution,
        format: 'jpeg',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `API error: ${error}` };
    }

    const data = await response.json();
    return { success: true, url: data.url || data.imageUrl };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

interface VideoGenerationParams {
  prompt: string;
  referenceImages: string[];
  aspectRatio: string;
  duration: number;
}

async function generateVideo(params: VideoGenerationParams): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const response = await fetch('/api/video/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nodeId: `gen-${Date.now()}`,
        prompt: params.prompt,
        images: params.referenceImages.map(url => ({ url, type: 'image/png' })),
        copies: 1,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `API error: ${error}` };
    }

    const data = await response.json();
    // L'API retourne results[0].nodeData.generated.url
    const videoUrl = data.results?.[0]?.nodeData?.generated?.url;
    return { success: !!videoUrl, url: videoUrl };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

interface VideoFirstLastParams {
  prompt: string;
  firstFrameUrl: string;
  lastFrameUrl: string;
  duration: number;
}

/**
 * NOUVEAU: Génère une vidéo avec first frame + last frame
 * Utilise KLING v2.6 Pro via l'API dédiée
 */
async function generateVideoFirstLast(params: VideoFirstLastParams): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const response = await fetch('/api/video/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nodeId: `gen-fl-${Date.now()}`,
        prompt: params.prompt,
        imagePrompt: params.firstFrameUrl,     // First frame (image de départ)
        lastFrameImage: params.lastFrameUrl,   // Last frame (image de fin)
        model: 'kling-v2.6-pro-first-last',    // Modèle optimisé pour first+last
        copies: 1,
        // PAS de aspectRatio - déduit des images
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `API error: ${error}` };
    }

    const data = await response.json();
    // L'API retourne results[0].nodeData.generated.url
    const videoUrl = data.results?.[0]?.nodeData?.generated?.url;
    return { success: !!videoUrl, url: videoUrl };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
