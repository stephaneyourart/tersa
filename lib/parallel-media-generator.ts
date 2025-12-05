/**
 * Générateur de médias en parallèle pour les briefs
 * 
 * ARCHITECTURE TOUT EN // :
 * 1. TOUTES les images primaires (personnages + décors) sont lancées SIMULTANÉMENT
 * 2. Dès qu'une primaire est prête, ses variantes sont lancées IMMÉDIATEMENT en //
 *    (pas d'attente que les autres primaires soient terminées)
 * 3. Images de plan (départ 21:9 + fin 21:9) générées par EDIT depuis les collections
 * 4. Vidéos avec first frame (départ) + last frame (fin) + prompt action
 */

import type { QualityLevel } from '@/types/brief';
import type { FrameMode } from '@/lib/creative-plan-settings';
import { 
  getTextToImageModel, 
  getEditModel, 
  IMAGE_RATIOS,
} from '@/lib/brief-defaults';
import { getVideoModel, VIDEO_MODELS } from '@/lib/models-registry';

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
  imageFinUrl?: string;       // NOUVEAU: URL de l'image de fin (last frame) - uniquement en mode first-last
  duration: number;
  usesFirstLastFrame: boolean;
  frameMode: FrameMode;       // NOUVEAU: Mode de génération (first-last ou first-only)
  modelId: string;            // NOUVEAU: ID du modèle vidéo sélectionné (OBLIGATOIRE)
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
  
  // ============================================================
  // MODÈLES T2I / I2I - SÉLECTIONNÉS PAR L'UTILISATEUR
  // Ces valeurs DOIVENT être utilisées à la place de getTextToImageModel/getEditModel
  // ============================================================
  /** Modèle Text-to-Image (ex: nano-banana-pro-ultra-wavespeed) */
  t2iModel?: string;
  /** Modèle Image-to-Image / Edit (ex: nano-banana-pro-edit-ultra-wavespeed) */
  i2iModel?: string;
  /** Modèle Vidéo (ex: kwaivgi/kling-v2.5-turbo-pro/image-to-video) */
  videoModel?: string;
  
  /** Résolution T2I (ex: '4k', '8k') */
  t2iResolution?: string;
  /** Résolution I2I (ex: '4k', '8k') */
  i2iResolution?: string;
  /** Aspect ratio T2I */
  t2iAspectRatio?: string;
  /** Aspect ratio I2I */
  i2iAspectRatio?: string;
  
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
    imageFinNodeId?: string;      // OPTIONNEL: uniquement en mode first-last
    promptDepart: string;
    promptFin?: string;           // OPTIONNEL: uniquement en mode first-last
    aspectRatio: string;  // 21:9
    characterCollectionIds: string[];
    decorCollectionId?: string;
  }>;
  videos: Array<{
    planId: string;
    videoNodeIds: string[];
    prompt: string;
    imageDepartNodeId?: string;   // NOUVEAU: ID de l'image de départ
    imageFinNodeId?: string;      // NOUVEAU: ID de l'image de fin (uniquement first-last)
    characterCollectionIds: string[];
    decorCollectionId?: string;
    usesFirstLastFrame?: boolean;
    // NOUVEAU: Flags pour génération directe depuis les collections primaires
    skipSecondaryImages?: boolean;
    firstFrameIsPrimary?: boolean;
  }>;
  videoSettings: { duration: number; aspectRatio: string; frameMode?: FrameMode };
  // NOUVEAU: Flags globaux
  skipSecondaryImages?: boolean;
  firstFrameIsPrimary?: boolean;
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
    // MODÈLES T2I/I2I SÉLECTIONNÉS PAR L'UTILISATEUR
    t2iModel,
    i2iModel,
    videoModel,
    t2iResolution,
    i2iResolution,
    characterImages,
    decorImages,
    planImages,
    videos,
    videoSettings,
    onProgress,
    onImageGenerated,
    onVideoGenerated,
  } = options;
  
  // ============================================================
  // RÉSOLUTION DES MODÈLES : PRIORITÉ AUX SÉLECTIONS UTILISATEUR
  // ============================================================
  // Si l'utilisateur a sélectionné un modèle, on l'utilise.
  // Sinon, fallback sur l'ancien système basé sur "quality"
  const resolvedT2IModel = t2iModel || getTextToImageModel(quality);
  const resolvedI2IModel = i2iModel || getEditModel(quality);
  // Fallback vidéo: utiliser le premier modèle first+last disponible (Kling 2.5) ou le premier tout court
  const defaultVideoModel = VIDEO_MODELS.find(m => m.supportsImagesFirstLast)?.id || VIDEO_MODELS[0]?.id;
  const resolvedVideoModel = videoModel || defaultVideoModel;
  
  const resolvedT2IResolution = t2iResolution || (quality === 'elevee' ? '4K' : undefined);
  const resolvedI2IResolution = i2iResolution || (quality === 'elevee' ? '4K' : undefined);
  
  console.log('[ParallelGen] Modèles résolus:');
  console.log(`  T2I: ${resolvedT2IModel} (résolution: ${resolvedT2IResolution || 'défaut'})`);
  console.log(`  I2I: ${resolvedI2IModel} (résolution: ${resolvedI2IResolution || 'défaut'})`);
  console.log(`  VIDEO: ${resolvedVideoModel}`);
  
  if (t2iModel) console.log('  ✓ T2I model from user selection');
  if (i2iModel) console.log('  ✓ I2I model from user selection');
  if (videoModel) console.log('  ✓ Video model from user selection');

  const imageResults: GenerationResult[] = [];
  const videoResults: GenerationResult[] = [];

  // Map pour stocker les URLs des images par nodeId
  const imageUrlsMap = new Map<string, string>();
  
  // Map pour suivre les collections prêtes (personnages et décors)
  const readyCollections = new Set<string>();

  console.log('[ParallelGen] Démarrage génération parallèle (TOUT EN //)');
  console.log(`[ParallelGen] ${characterImages.length} personnages, ${decorImages.length} décors`);
  console.log(`[ParallelGen] ${planImages?.length || 0} plans avec images départ/fin`);
  console.log(`[ParallelGen] ${videos.length} vidéos`);

  // ========== COLLECTER TOUTES LES TÂCHES D'IMAGES (PRIMAIRES + VARIANTES) ==========
  const allImageTasks: ImageGenerationTask[] = [];

  // Collecter TOUTES les tâches d'images personnages (primaires + variantes)
  for (const char of characterImages) {
    for (let i = 0; i < char.order.length; i++) {
      const viewType = char.order[i];
      const nodeId = char.imageNodeIds[i];
      if (!nodeId) continue;
      
      const isPrimary = i === 0;
      allImageTasks.push({
        nodeId,
        type: isPrimary ? 'primary' : 'variant',
        entityType: 'character',
        entityId: char.characterId,
        viewType,
        prompt: char.prompts[viewType],
        aspectRatio: char.aspectRatios[viewType] || (isPrimary ? IMAGE_RATIOS.character.primary : '1:1'),
        referenceImageId: isPrimary ? undefined : (char.primaryNodeId || char.imageNodeIds[0]),
      });
    }
  }

  // Collecter TOUTES les tâches d'images décors (primaires + variantes)
  for (const decor of decorImages) {
    for (let i = 0; i < decor.order.length; i++) {
      const viewType = decor.order[i];
      const nodeId = decor.imageNodeIds[i];
      if (!nodeId) continue;
      
      const isPrimary = i === 0;
      allImageTasks.push({
        nodeId,
        type: isPrimary ? 'primary' : 'variant',
        entityType: 'decor',
        entityId: decor.decorId,
        viewType,
        prompt: decor.prompts[viewType],
        aspectRatio: decor.aspectRatios[viewType] || (isPrimary ? IMAGE_RATIOS.decor.primary : '16:9'),
        referenceImageId: isPrimary ? undefined : (decor.primaryNodeId || decor.imageNodeIds[0]),
      });
    }
  }

  // Séparer primaires et variantes pour le workflow
  const primaryTasks = allImageTasks.filter(t => t.type === 'primary');
  const variantTasks = allImageTasks.filter(t => t.type === 'variant');

  const totalImages = primaryTasks.length + variantTasks.length;
  console.log(`[ParallelGen] TOUT EN // : ${totalImages} images (${primaryTasks.length} primaires + ${variantTasks.length} variantes)`);
  
  onProgress?.({
    phase: 'primary_images',
    total: totalImages,
    completed: 0,
    failed: 0,
    currentTasks: allImageTasks.map(t => t.nodeId),
  });

  // ========== LANCER TOUTES LES IMAGES EN PARALLÈLE ==========
  // Chaque primaire lance immédiatement ses variantes dès qu'elle est prête
  
  const allImagePromises = primaryTasks.map(async (primaryTask) => {
    const results: GenerationResult[] = [];
    
    try {
      // UTILISE LE MODÈLE T2I SÉLECTIONNÉ PAR L'UTILISATEUR
      const model = resolvedT2IModel;
      const extraParams = resolvedT2IResolution ? { resolution: resolvedT2IResolution } : {};
      
      console.log(`[ParallelGen] 🚀 Primaire ${primaryTask.entityType}/${primaryTask.entityId}/${primaryTask.viewType} (model: ${model})`);
      
      const result = await generateImage({
        prompt: primaryTask.prompt,
        model,
        aspectRatio: primaryTask.aspectRatio,
        ...extraParams,
      });

      if (result.success && result.url) {
        imageUrlsMap.set(primaryTask.nodeId, result.url);
        results.push({ nodeId: primaryTask.nodeId, success: true, url: result.url });
        onImageGenerated?.({ nodeId: primaryTask.nodeId, success: true, url: result.url });
        console.log(`[ParallelGen] ✓ Primaire ${primaryTask.nodeId} OK`);
        
        // IMMÉDIATEMENT lancer les variantes de cette primaire EN PARALLÈLE
        const myVariants = variantTasks.filter(v => v.referenceImageId === primaryTask.nodeId);
        if (myVariants.length > 0) {
          console.log(`[ParallelGen] 🚀 ${myVariants.length} variantes pour ${primaryTask.entityId} lancées EN //`);
          
          const variantPromises = myVariants.map(async (variantTask) => {
            try {
              // UTILISE LE MODÈLE I2I SÉLECTIONNÉ PAR L'UTILISATEUR
              const editModel = resolvedI2IModel;
              const editParams = resolvedI2IResolution ? { resolution: resolvedI2IResolution } : {};
              
              const variantResult = await generateImageEdit({
                prompt: variantTask.prompt,
                referenceImageUrl: result.url!,
                model: editModel,
                aspectRatio: variantTask.aspectRatio,
                ...editParams,
              });

              if (variantResult.success && variantResult.url) {
                imageUrlsMap.set(variantTask.nodeId, variantResult.url);
                results.push({ nodeId: variantTask.nodeId, success: true, url: variantResult.url });
                onImageGenerated?.({ nodeId: variantTask.nodeId, success: true, url: variantResult.url });
                console.log(`[ParallelGen] ✓ Variante ${variantTask.nodeId} OK`);
              } else {
                results.push({ nodeId: variantTask.nodeId, success: false, error: variantResult.error });
                onImageGenerated?.({ nodeId: variantTask.nodeId, success: false, error: variantResult.error });
              }
            } catch (err: any) {
              results.push({ nodeId: variantTask.nodeId, success: false, error: err.message });
              onImageGenerated?.({ nodeId: variantTask.nodeId, success: false, error: err.message });
            }
          });
          
          await Promise.allSettled(variantPromises);
        }
      } else {
        results.push({ nodeId: primaryTask.nodeId, success: false, error: result.error });
        onImageGenerated?.({ nodeId: primaryTask.nodeId, success: false, error: result.error });
        console.error(`[ParallelGen] ✗ Primaire ${primaryTask.nodeId} échouée:`, result.error);
      }
    } catch (error: any) {
      results.push({ nodeId: primaryTask.nodeId, success: false, error: error.message });
      onImageGenerated?.({ nodeId: primaryTask.nodeId, success: false, error: error.message });
    }
    
    return results;
  });

  // Attendre que TOUT soit terminé (primaires + leurs variantes)
  const allResults = await Promise.allSettled(allImagePromises);
  
  // Collecter tous les résultats
  for (const result of allResults) {
    if (result.status === 'fulfilled') {
      imageResults.push(...result.value);
    }
  }
  
  const successCount = imageResults.filter(r => r.success).length;
  console.log(`[ParallelGen] TOUTES images terminées : ${successCount}/${totalImages} réussies`);

  // Marquer toutes les collections comme prêtes
  for (const char of characterImages) {
    readyCollections.add(char.characterId);
  }
  for (const decor of decorImages) {
    readyCollections.add(decor.decorId);
  }

  // ========== PHASE 3 : IMAGES DE PLAN (DÉPART/FIN) EN PARALLÈLE ==========
  // Ces images sont générées par EDIT à partir des images des collections
  // En mode first-only, seule l'image de départ est générée
  const frameMode = videoSettings.frameMode || 'first-last';
  
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

      // Image de DÉPART (toujours générée)
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

      // Image de FIN - UNIQUEMENT en mode first-last
      if (frameMode === 'first-last' && plan.imageFinNodeId && plan.promptFin) {
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
        // UTILISE LE MODÈLE I2I SÉLECTIONNÉ PAR L'UTILISATEUR
        const model = resolvedI2IModel;
        const extraParams = resolvedI2IResolution ? { resolution: resolvedI2IResolution } : {};
        
        console.log(`[ParallelGen] Génération image plan ${task.entityId}/${task.viewType} (model: ${model})`);
        
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

  // ========== PHASE 4 : VIDÉOS EN PARALLÈLE (avec first+last frame ou first only) ==========
  const videoTasks: VideoGenerationTask[] = [];
  
  // NOUVEAU: Flags globaux pour le mode de génération
  const globalSkipSecondary = options.skipSecondaryImages || false;
  const globalFirstFrameIsPrimary = options.firstFrameIsPrimary || false;
  
  for (const video of videos) {
    // Déterminer si on utilise les images primaires directement
    const useDirectPrimary = video.skipSecondaryImages || video.firstFrameIsPrimary || globalSkipSecondary || globalFirstFrameIsPrimary;
    
    let imageDepartUrl: string | undefined;
    let imageFinUrl: string | undefined;
    
    if (useDirectPrimary) {
      // MODE DIRECT: Utiliser les images primaires des collections
      console.log(`[ParallelGen] Plan ${video.planId}: Mode direct (skipSecondary=${video.skipSecondaryImages}, firstFrameIsPrimary=${video.firstFrameIsPrimary})`);
      
      // Récupérer les URLs des images primaires des personnages
      for (const charData of characterImages) {
        if (charData.primaryNodeId) {
          const url = imageUrlsMap.get(charData.primaryNodeId);
          if (url) {
            imageDepartUrl = url;
            console.log(`[ParallelGen] Utilisation image primaire personnage: ${charData.primaryNodeId}`);
            break;
          }
        }
      }
      
      // Si pas d'image personnage, essayer les décors
      if (!imageDepartUrl) {
        for (const decorData of decorImages) {
          if (decorData.primaryNodeId) {
            const url = imageUrlsMap.get(decorData.primaryNodeId);
            if (url) {
              imageDepartUrl = url;
              console.log(`[ParallelGen] Utilisation image primaire décor: ${decorData.primaryNodeId}`);
              break;
            }
          }
        }
      }
      
      // En mode direct, pas d'image de fin (on utilise uniquement first frame)
      imageFinUrl = undefined;
    } else {
      // MODE NORMAL: Utiliser les images de plan (départ/fin)
      imageDepartUrl = video.imageDepartNodeId ? imageUrlsMap.get(video.imageDepartNodeId) : undefined;
      // En mode first-only, pas d'image de fin
      imageFinUrl = frameMode === 'first-last' && video.imageFinNodeId 
        ? imageUrlsMap.get(video.imageFinNodeId) 
        : undefined;
    }
    
    for (const videoNodeId of video.videoNodeIds) {
      videoTasks.push({
        planId: video.planId,
        videoNodeId,
        prompt: video.prompt,
        imageDepartUrl,
        imageFinUrl,
        duration: videoSettings.duration,
        // En mode direct, on utilise first-only car on n'a qu'une image primaire
        usesFirstLastFrame: !useDirectPrimary && frameMode === 'first-last' && (video.usesFirstLastFrame || false),
        frameMode: useDirectPrimary ? 'first-only' : frameMode,
        modelId: resolvedVideoModel, // UTILISER LE MODÈLE RÉSOLU
      });
    }
  }

  const modeLabel = frameMode === 'first-only' ? 'first frame only' : 'first+last frame';
  console.log(`[ParallelGen] Phase 4 : ${videoTasks.length} vidéos à générer SIMULTANÉMENT (${modeLabel})`);
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
      const modeDesc = task.frameMode === 'first-only' 
        ? 'first frame only' 
        : `first+last: ${task.usesFirstLastFrame}`;
      console.log(`[ParallelGen] Génération vidéo ${task.videoNodeId} (${modeDesc}) avec modèle ${task.modelId}`);
      
      let result;
      
      // MODE FIRST+LAST: utiliser first+last frame si les deux images sont disponibles
      if (task.frameMode === 'first-last' && task.usesFirstLastFrame && task.imageDepartUrl && task.imageFinUrl) {
        
        // Vérifier si le modèle supporte first+last
        const modelConfig = getVideoModel(task.modelId);
        if (modelConfig && !modelConfig.supportsImagesFirstLast) {
            console.warn(`[ParallelGen] ⚠️ Le modèle ${task.modelId} ne supporte pas first+last ! Fallback sur first-only.`);
            // Fallback first-only avec ce modèle (ou un autre ?)
            // Ici on garde le même modèle mais on l'appelle en first-only
            result = await generateVideoFirstOnly({
                prompt: task.prompt,
                firstFrameUrl: task.imageDepartUrl,
                duration: task.duration,
                modelId: task.modelId,
              });
        } else {
            result = await generateVideoFirstLast({
              prompt: task.prompt,
              firstFrameUrl: task.imageDepartUrl,
              lastFrameUrl: task.imageFinUrl,
              duration: task.duration,
              modelId: task.modelId, // Passer le modèle
            });
        }
      } 
      // MODE FIRST ONLY
      else if (task.frameMode === 'first-only' && task.imageDepartUrl) {
        result = await generateVideoFirstOnly({
          prompt: task.prompt,
          firstFrameUrl: task.imageDepartUrl,
          duration: task.duration,
          modelId: task.modelId, // Passer le modèle
        });
      }
      // Fallback: génération vidéo standard avec image de référence
      else {
        result = await generateVideo({
          prompt: task.prompt,
          referenceImages: task.imageDepartUrl ? [task.imageDepartUrl] : [],
          aspectRatio: '16:9',
          duration: task.duration,
          modelId: task.modelId, // Passer le modèle
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
  modelId: string;
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
        model: params.modelId, // Passer le modèle
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
  modelId: string;
}

interface VideoFirstOnlyParams {
  prompt: string;
  firstFrameUrl: string;
  duration: number;
  modelId: string;
}

/**
 * Génère une vidéo avec FIRST frame uniquement
 */
async function generateVideoFirstOnly(params: VideoFirstOnlyParams): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Récupérer la config du modèle
    const modelConfig = getVideoModel(params.modelId);
    const guidanceField = modelConfig?.guidanceField || 'cfg_scale';
    const guidanceDefault = modelConfig?.guidanceDefault || 0.5;

    const body: any = {
      nodeId: `gen-fo-${Date.now()}`,
      prompt: params.prompt,
      imagePrompt: params.firstFrameUrl,
      model: params.modelId, // Endpoint WaveSpeed réel (dynamique)
      copies: 1,
      duration: params.duration,
    };
    
    // Ajouter guidance avec le bon nom
    body[guidanceField] = guidanceDefault;

    const response = await fetch('/api/video/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `API error: ${error}` };
    }

    const data = await response.json();
    const videoUrl = data.results?.[0]?.nodeData?.generated?.url;
    return { success: !!videoUrl, url: videoUrl };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Génère une vidéo avec first frame + last frame
 */
async function generateVideoFirstLast(params: VideoFirstLastParams): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Récupérer la config du modèle
    const modelConfig = getVideoModel(params.modelId);
    const guidanceField = modelConfig?.guidanceField || 'guidance_scale';
    const guidanceDefault = modelConfig?.guidanceDefault || 0.5;
    const lastImageField = modelConfig?.lastImageField || 'last_image';

    const body: any = {
      nodeId: `gen-fl-${Date.now()}`,
      prompt: params.prompt,
      imagePrompt: params.firstFrameUrl,
      model: params.modelId, // Endpoint WaveSpeed réel (dynamique)
      copies: 1,
      duration: params.duration,
    };
    
    // Ajouter last frame avec le bon nom de champ (dépend du modèle)
    body[lastImageField] = params.lastFrameUrl;
    // Ajouter guidance
    body[guidanceField] = guidanceDefault;

    const response = await fetch('/api/video/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `API error: ${error}` };
    }

    const data = await response.json();
    const videoUrl = data.results?.[0]?.nodeData?.generated?.url;
    return { success: !!videoUrl, url: videoUrl };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
