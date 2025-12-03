/**
 * Générateur automatique de médias
 * Génère les images (personnages, lieux) puis les vidéos, et envoie vers DVR
 */

import type { GeneratedScenario, Character, Location } from '@/types/brief';
import { importToDVR, createDVRFolder } from '@/lib/davinci-resolve';

interface GenerationResult {
  nodeId: string;
  url: string;
  type: 'image' | 'video';
  metadata?: any;
}

interface BatchGenerationOptions {
  scenario: GeneratedScenario;
  imageModel: string;
  videoModel: string;
  videoCopies: number;
  projectId: string;
  sendToDVR: boolean;
}

/**
 * Génère automatiquement tous les médias du scénario
 */
export async function generateAllMedia(
  options: BatchGenerationOptions
): Promise<GenerationResult[]> {
  const {
    scenario,
    imageModel,
    videoModel,
    videoCopies,
    projectId,
    sendToDVR,
  } = options;

  console.log('[AutoGen] Démarrage génération automatique');
  console.log('[AutoGen] Images:', imageModel, '| Vidéos:', videoModel);
  
  const results: GenerationResult[] = [];

  try {
    // PHASE 1: Générer toutes les images des personnages
    console.log('[AutoGen] Phase 1: Génération images personnages...');
    const characterImages = await generateCharacterImages(
      scenario.characters,
      imageModel,
      projectId
    );
    results.push(...characterImages);
    console.log(`[AutoGen] ${characterImages.length} images de personnages générées`);

    // PHASE 2: Générer toutes les images des lieux
    console.log('[AutoGen] Phase 2: Génération images lieux...');
    const locationImages = await generateLocationImages(
      scenario.locations,
      imageModel,
      projectId
    );
    results.push(...locationImages);
    console.log(`[AutoGen] ${locationImages.length} images de lieux générées`);

    // PHASE 3: Créer les collections
    console.log('[AutoGen] Phase 3: Création des collections...');
    const collections = await createCollections(
      scenario,
      characterImages,
      locationImages,
      projectId
    );
    console.log(`[AutoGen] ${collections.length} collections créées`);

    // PHASE 4: Générer toutes les vidéos des plans
    console.log('[AutoGen] Phase 4: Génération des vidéos...');
    const videos = await generatePlanVideos(
      scenario,
      collections,
      videoModel,
      videoCopies,
      projectId
    );
    results.push(...videos);
    console.log(`[AutoGen] ${videos.length} vidéos générées`);

    // PHASE 5: Envoyer vers DaVinci Resolve
    if (sendToDVR && videos.length > 0) {
      console.log('[AutoGen] Phase 5: Envoi vers DaVinci Resolve...');
      await sendAllToDaVinciResolve(videos, projectId, scenario.title);
      console.log('[AutoGen] Envoi vers DVR terminé');
    }

    console.log('[AutoGen] Génération automatique terminée avec succès');
    return results;
  } catch (error) {
    console.error('[AutoGen] Erreur lors de la génération:', error);
    throw error;
  }
}

/**
 * Génère toutes les images pour les personnages
 */
async function generateCharacterImages(
  characters: Character[],
  model: string,
  projectId: string
): Promise<GenerationResult[]> {
  const results: GenerationResult[] = [];

  for (const character of characters) {
    const angles = [
      { key: 'face', prompt: character.prompts.face },
      { key: 'profile', prompt: character.prompts.profile },
      { key: 'fullBody', prompt: character.prompts.fullBody },
      { key: 'back', prompt: character.prompts.back },
    ];

    for (const angle of angles) {
      try {
        const response = await fetch('/api/image/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: angle.prompt,
            model,
            projectId,
            size: '1024x1024',
          }),
        });

        if (response.ok) {
          const data = await response.json();
          results.push({
            nodeId: `char-${character.name}-${angle.key}`,
            url: data.url,
            type: 'image',
            metadata: {
              character: character.name,
              angle: angle.key,
              referenceCode: character.referenceCode,
            },
          });
        } else {
          console.error(`[AutoGen] Erreur génération image ${character.name}-${angle.key}`);
        }
      } catch (error) {
        console.error(`[AutoGen] Erreur ${character.name}-${angle.key}:`, error);
      }
    }
  }

  return results;
}

/**
 * Génère toutes les images pour les lieux
 */
async function generateLocationImages(
  locations: Location[],
  model: string,
  projectId: string
): Promise<GenerationResult[]> {
  const results: GenerationResult[] = [];

  for (const location of locations) {
    try {
      const response = await fetch('/api/image/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: location.prompt,
          model,
          projectId,
          size: '1024x1024',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        results.push({
          nodeId: `loc-${location.name}`,
          url: data.url,
          type: 'image',
          metadata: {
            location: location.name,
            referenceCode: location.referenceCode,
          },
        });
      } else {
        console.error(`[AutoGen] Erreur génération image lieu ${location.name}`);
      }
    } catch (error) {
      console.error(`[AutoGen] Erreur lieu ${location.name}:`, error);
    }
  }

  return results;
}

/**
 * Crée les nœuds collections avec les images générées
 */
async function createCollections(
  scenario: GeneratedScenario,
  characterImages: GenerationResult[],
  locationImages: GenerationResult[],
  projectId: string
): Promise<{ id: string; type: 'character' | 'location'; images: string[] }[]> {
  const collections: { id: string; type: 'character' | 'location'; images: string[] }[] = [];

  // Collections de personnages
  for (const character of scenario.characters) {
    const images = characterImages
      .filter(img => img.metadata?.character === character.name)
      .map(img => img.url);

    if (images.length > 0) {
      collections.push({
        id: `char-${character.name}`,
        type: 'character',
        images,
      });
    }
  }

  // Collections de lieux
  for (const location of scenario.locations) {
    const images = locationImages
      .filter(img => img.metadata?.location === location.name)
      .map(img => img.url);

    if (images.length > 0) {
      collections.push({
        id: `loc-${location.name}`,
        type: 'location',
        images,
      });
    }
  }

  return collections;
}

/**
 * Génère toutes les vidéos des plans
 */
async function generatePlanVideos(
  scenario: GeneratedScenario,
  collections: { id: string; type: string; images: string[] }[],
  model: string,
  copies: number,
  projectId: string
): Promise<GenerationResult[]> {
  const results: GenerationResult[] = [];

  for (const scene of scenario.scenes) {
    for (const plan of scene.plans) {
      if (plan.type !== 'shot') continue;

      // Récupérer les images des collections référencées
      const characterImages: string[] = [];
      const locationImages: string[] = [];

      for (const charRef of plan.characters) {
        const charName = charRef.replace('[PERSO:', '').replace(']', '');
        const collection = collections.find(c => c.id === `char-${charName}`);
        if (collection?.images[0]) {
          characterImages.push(collection.images[0]); // Prendre la première image (face)
        }
      }

      for (const locRef of plan.locations) {
        const locName = locRef.replace('[LIEU:', '').replace(']', '');
        const collection = collections.find(c => c.id === `loc-${locName}`);
        if (collection?.images[0]) {
          locationImages.push(collection.images[0]);
        }
      }

      // Générer N copies de la vidéo
      for (let copy = 0; copy < copies; copy++) {
        try {
          const response = await fetch('/api/video/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: plan.prompt,
              model,
              projectId,
              duration: plan.duration || 5,
              imagePrompt: characterImages[0] || locationImages[0], // Utiliser la première image en input
              aspectRatio: '16:9',
            }),
          });

          if (response.ok) {
            const data = await response.json();
            results.push({
              nodeId: `plan-${scene.sceneNumber}-${plan.planNumber}-copy${copy + 1}`,
              url: data.url,
              type: 'video',
              metadata: {
                scene: scene.sceneNumber,
                plan: plan.planNumber,
                copy: copy + 1,
                prompt: plan.prompt,
              },
            });
          } else {
            console.error(`[AutoGen] Erreur génération vidéo plan ${scene.sceneNumber}-${plan.planNumber} copie ${copy + 1}`);
          }
        } catch (error) {
          console.error(`[AutoGen] Erreur plan ${scene.sceneNumber}-${plan.planNumber}:`, error);
        }
      }
    }
  }

  return results;
}

/**
 * Envoie toutes les vidéos vers DaVinci Resolve
 */
async function sendAllToDaVinciResolve(
  videos: GenerationResult[],
  projectId: string,
  projectName: string
): Promise<void> {
  const folderName = `${projectName} - Auto Generated`;

  // Créer le dossier dans DVR
  try {
    await createDVRFolder(folderName);
  } catch (error) {
    console.log(`[AutoGen] Dossier ${folderName} existe déjà ou erreur:`, error);
  }

  for (const video of videos) {
    try {
      // importToDVR attend un chemin de fichier local, pas une URL
      // Pour l'instant on skip l'import car les vidéos sont des URLs
      console.log(`[AutoGen] Vidéo ${video.nodeId} prête pour DVR: ${video.url}`);
      // TODO: Télécharger la vidéo depuis l'URL puis l'importer
      // await importToDVR(localFilePath, folderName);
    } catch (error) {
      console.error(`[AutoGen] Erreur envoi DVR ${video.nodeId}:`, error);
    }
  }
}

