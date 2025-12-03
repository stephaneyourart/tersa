/**
 * Handlers pour les tools de génération de projets
 * Chaque fonction correspond à un tool appelable par l'IA
 */

import type { ToolResult } from './brief-tools';

// Stockage temporaire des éléments générés pendant une session
interface GenerationSession {
  projectId: string;
  images: Map<string, { id: string; url: string; metadata: any }>;
  collections: Map<string, { id: string; imageIds: string[] }>;
  videos: Map<string, { id: string; url: string; metadata: any }>;
}

const sessions = new Map<string, GenerationSession>();

/**
 * Initialise une nouvelle session de génération
 */
export function initGenerationSession(projectId: string): void {
  sessions.set(projectId, {
    projectId,
    images: new Map(),
    collections: new Map(),
    videos: new Map(),
  });
}

/**
 * Récupère une session
 */
export function getSession(projectId: string): GenerationSession | undefined {
  return sessions.get(projectId);
}

/**
 * Tool: Créer la structure du projet
 */
export async function handleCreateProjectStructure(
  params: {
    title: string;
    synopsis: string;
    totalScenes: number;
    totalPlans: number;
    estimatedDuration: number;
  },
  projectId: string
): Promise<ToolResult> {
  try {
    console.log('[Tool] create_project_structure:', params);
    
    // Créer la structure de base du projet
    // Pour l'instant, on stocke juste les infos
    const session = getSession(projectId);
    if (session) {
      (session as any).structure = params;
    }

    return {
      success: true,
      data: {
        message: `Projet "${params.title}" structuré avec ${params.totalScenes} scènes et ${params.totalPlans} plans`,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Tool: Générer une image de personnage
 */
export async function handleGenerateCharacterImage(
  params: {
    characterName: string;
    angle: 'face' | 'profile' | 'fullBody' | 'back';
    prompt: string;
    referenceCode: string;
  },
  projectId: string,
  imageModel: string
): Promise<ToolResult> {
  try {
    console.log('[Tool] generate_character_image:', params.characterName, params.angle);

    const response = await fetch('http://localhost:3000/api/image/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: params.prompt,
        model: imageModel,
        projectId,
        size: '1024x1024',
      }),
    });

    if (!response.ok) {
      throw new Error(`Erreur génération image: ${response.statusText}`);
    }

    const data = await response.json();
    const imageId = `char-${params.characterName}-${params.angle}`;

    // Stocker dans la session
    const session = getSession(projectId);
    if (session) {
      session.images.set(imageId, {
        id: imageId,
        url: data.url,
        metadata: {
          character: params.characterName,
          angle: params.angle,
          referenceCode: params.referenceCode,
        },
      });
    }

    return {
      success: true,
      id: imageId,
      data: {
        imageId,
        url: data.url,
        message: `Image "${params.characterName} - ${params.angle}" générée`,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Tool: Générer une image de lieu
 */
export async function handleGenerateLocationImage(
  params: {
    locationName: string;
    prompt: string;
    referenceCode: string;
  },
  projectId: string,
  imageModel: string
): Promise<ToolResult> {
  try {
    console.log('[Tool] generate_location_image:', params.locationName);

    const response = await fetch('http://localhost:3000/api/image/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: params.prompt,
        model: imageModel,
        projectId,
        size: '1024x1024',
      }),
    });

    if (!response.ok) {
      throw new Error(`Erreur génération image: ${response.statusText}`);
    }

    const data = await response.json();
    const imageId = `loc-${params.locationName}`;

    // Stocker dans la session
    const session = getSession(projectId);
    if (session) {
      session.images.set(imageId, {
        id: imageId,
        url: data.url,
        metadata: {
          location: params.locationName,
          referenceCode: params.referenceCode,
        },
      });
    }

    return {
      success: true,
      id: imageId,
      data: {
        imageId,
        url: data.url,
        message: `Images du lieu "${params.locationName}" générées`,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Tool: Créer une collection
 */
export async function handleCreateCollection(
  params: {
    name: string;
    type: 'character' | 'location';
    referenceCode: string;
    imageIds: string[];
  },
  projectId: string
): Promise<ToolResult> {
  try {
    console.log('[Tool] create_collection:', params.name);

    const session = getSession(projectId);
    if (!session) {
      throw new Error('Session non trouvée');
    }

    // Récupérer les URLs des images
    const imageUrls = params.imageIds
      .map(id => session.images.get(id)?.url)
      .filter(Boolean) as string[];

    if (imageUrls.length === 0) {
      throw new Error('Aucune image trouvée pour cette collection');
    }

    const collectionId = params.type === 'character' 
      ? `char-${params.name}` 
      : `loc-${params.name}`;

    // Stocker la collection
    session.collections.set(collectionId, {
      id: collectionId,
      imageIds: params.imageIds,
    });

    return {
      success: true,
      id: collectionId,
      data: {
        collectionId,
        name: params.name,
        imageCount: imageUrls.length,
        message: `Collection "${params.name}" créée avec ${imageUrls.length} images`,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Tool: Générer une vidéo pour un plan
 */
export async function handleGenerateVideoPlan(
  params: {
    sceneNumber: number;
    planNumber: number;
    prompt: string;
    characterReferences: string[];
    locationReferences: string[];
    duration: number;
    copies: number;
  },
  projectId: string,
  videoModel: string
): Promise<ToolResult> {
  try {
    console.log('[Tool] generate_video_plan:', `Scene ${params.sceneNumber} - Plan ${params.planNumber}`);

    const session = getSession(projectId);
    if (!session) {
      throw new Error('Session non trouvée');
    }

    // Récupérer les images des collections référencées
    const inputImages: string[] = [];

    for (const ref of params.characterReferences) {
      const charName = ref.replace('[PERSO:', '').replace(']', '');
      const collectionId = `char-${charName}`;
      const collection = session.collections.get(collectionId);
      
      if (collection && collection.imageIds[0]) {
        const image = session.images.get(collection.imageIds[0]);
        if (image) {
          inputImages.push(image.url);
        }
      }
    }

    for (const ref of params.locationReferences) {
      const locName = ref.replace('[LIEU:', '').replace(']', '');
      const collectionId = `loc-${locName}`;
      const collection = session.collections.get(collectionId);
      
      if (collection && collection.imageIds[0]) {
        const image = session.images.get(collection.imageIds[0]);
        if (image) {
          inputImages.push(image.url);
        }
      }
    }

    // Générer les copies de la vidéo
    const videoIds: string[] = [];
    
    for (let i = 0; i < params.copies; i++) {
      const response = await fetch('http://localhost:3000/api/video/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: params.prompt,
          model: videoModel,
          projectId,
          duration: params.duration,
          imagePrompt: inputImages[0], // Première image en input
          aspectRatio: '16:9',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const videoId = `plan-${params.sceneNumber}-${params.planNumber}-copy${i + 1}`;
        
        session.videos.set(videoId, {
          id: videoId,
          url: data.url,
          metadata: {
            scene: params.sceneNumber,
            plan: params.planNumber,
            copy: i + 1,
          },
        });
        
        videoIds.push(videoId);
      }
    }

    return {
      success: true,
      data: {
        videoIds,
        message: `${videoIds.length} vidéos générées pour Plan ${params.sceneNumber}.${params.planNumber}`,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Tool: Envoyer vers DaVinci Resolve
 */
export async function handleSendToDavinci(
  params: {
    videoIds: string[];
    folderName: string;
  },
  projectId: string
): Promise<ToolResult> {
  try {
    console.log('[Tool] send_videos_to_davinci:', params.videoIds.length, 'vidéos');

    const session = getSession(projectId);
    if (!session) {
      throw new Error('Session non trouvée');
    }

    // Pour l'instant, on log juste car les vidéos sont des URLs
    // TODO: Télécharger et importer dans DVR
    const videoUrls = params.videoIds
      .map(id => session.videos.get(id)?.url)
      .filter(Boolean);

    return {
      success: true,
      data: {
        sent: videoUrls.length,
        folderName: params.folderName,
        message: `${videoUrls.length} vidéos prêtes pour DaVinci Resolve`,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

