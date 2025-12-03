/**
 * Générateur de canvas à partir d'un projet structuré
 * 
 * ARCHITECTURE EN ÉTAPES SÉQUENTIELLES :
 * 1. Créer les nœuds TEXT (descriptions)
 * 2. Créer les nœuds IMAGE (vides, avec prompts)
 * 3. Créer les nœuds COLLECTION (vides)
 * 4. Créer les nœuds VIDEO (plans)
 * 5. Créer les edges de connexion
 * 6. Créer les shapes/labels de scènes
 * 
 * La génération des médias est faite APRÈS dans le canvas
 */

import { nanoid } from 'nanoid';
import type { Node, Edge } from '@xyflow/react';
import type {
  GeneratedProjectStructure,
  GeneratedCharacter,
  GeneratedLocation,
  GeneratedScene,
  GeneratedPlan,
} from '@/types/generated-project';
import { getSceneColor } from '@/types/generated-project';

// ========== CONSTANTES DE LAYOUT AMÉLIORÉES ==========
const LAYOUT = {
  // Marges générales - TRÈS ESPACÉ
  MARGIN: 200,
  SECTION_GAP: 400,        // Espace entre sections (doublé)
  
  // Zone personnages/lieux (colonne gauche)
  LEFT_COLUMN_WIDTH: 2000,
  CHARACTER_ROW_HEIGHT: 800, // Hauteur totale pour un personnage (augmenté)
  LOCATION_ROW_HEIGHT: 500,  // Hauteur totale pour un lieu (augmenté)
  
  // Tailles des nœuds
  TEXT_NODE_WIDTH: 400,
  TEXT_NODE_HEIGHT: 350,     // Estimation pour éviter chevauchement
  IMAGE_NODE_SIZE: 280,      // Images plus grandes
  COLLECTION_NODE_WIDTH: 500,
  COLLECTION_NODE_HEIGHT: 400,
  VIDEO_NODE_WIDTH: 550,
  VIDEO_NODE_HEIGHT: 450,
  
  // Espacement entre nœuds - TRÈS ESPACÉ
  NODE_GAP_X: 120,           // Doublé
  NODE_GAP_Y: 100,           // Doublé
  
  // Zone scènes (colonne droite) - Plus loin
  SCENES_START_X: 2600,      // Plus décalé à droite
  SCENE_GAP: 700,            // Plus d'espace entre scènes
  SCENE_PADDING: 150,
  PLAN_WIDTH: 1200,          // Plans plus larges
  PLAN_HEIGHT: 550,          // Plans plus hauts
  PLANS_PER_ROW: 1,          // 1 plan par ligne pour plus de clarté
  
  // Titre de scène
  SCENE_TITLE_FONT_SIZE: 120,
  SCENE_TITLE_HEIGHT: 180,
  
  // Z-Index
  SHAPE_Z_INDEX: -1000,
  TITLE_Z_INDEX: -999,
};

// ========== GÉNÉRATEUR D'IDS ==========
function nodeId(prefix: string): string {
  return `${prefix}-${nanoid(8)}`;
}

// ========== STRUCTURE DE DONNÉES POUR TRACKING ==========
export interface CanvasStructure {
  // IDs pour les connexions
  characterCollectionIds: Record<string, string>;
  locationCollectionIds: Record<string, string>;
  
  // Nœuds par catégorie (pour génération séquentielle)
  textNodes: Node[];
  imageNodes: Node[];
  collectionNodes: Node[];
  videoNodes: Node[];
  shapeNodes: Node[];
  labelNodes: Node[];
  
  // Edges
  edges: Edge[];
  
  // Métadonnées
  characterImageMap: Record<string, string[]>;  // characterId -> imageNodeIds
  locationImageMap: Record<string, string[]>;   // locationId -> imageNodeIds
  planVideoMap: Record<string, string>;         // planId -> videoNodeId
}

// ========== CRÉATION PERSONNAGE ==========
function createCharacterStructure(
  character: GeneratedCharacter,
  startX: number,
  startY: number,
  structure: CanvasStructure,
  testMode: boolean = false
): void {
  const textNodeId = nodeId('text-perso');
  const collectionNodeId = nodeId('collection-perso');
  
  // En mode test : seulement face et fullBody (2 images)
  const imageNodeIds: Record<string, string> = testMode
    ? {
        face: nodeId('img-face'),
        fullBody: nodeId('img-fullbody'),
      }
    : {
        face: nodeId('img-face'),
        profile: nodeId('img-profile'),
        fullBody: nodeId('img-fullbody'),
        back: nodeId('img-back'),
      };

  // 1. Nœud TEXT (description)
  structure.textNodes.push({
    id: textNodeId,
    type: 'text',
    position: { x: startX, y: startY },
    data: {
      text: `# ${character.name}\n\n${character.description}`,
    },
    width: LAYOUT.TEXT_NODE_WIDTH,
  });

  // 2. Nœuds IMAGE (4 angles ou 2 en mode test)
  const imageY = startY;
  const imageStartX = startX + LAYOUT.TEXT_NODE_WIDTH + LAYOUT.NODE_GAP_X;
  
  const allImageConfigs = [
    { key: 'face', id: imageNodeIds.face, label: 'Face', prompt: character.prompts.face, x: 0, y: 0 },
    { key: 'profile', id: imageNodeIds.profile, label: 'Profil', prompt: character.prompts.profile, x: 1, y: 0 },
    { key: 'fullBody', id: imageNodeIds.fullBody, label: 'Pied', prompt: character.prompts.fullBody, x: testMode ? 1 : 0, y: testMode ? 0 : 1 },
    { key: 'back', id: imageNodeIds.back, label: 'Dos', prompt: character.prompts.back, x: 1, y: 1 },
  ];
  
  // Filtrer selon le mode
  const imageConfigs = allImageConfigs.filter(c => imageNodeIds[c.key]);

  for (const config of imageConfigs) {
    structure.imageNodes.push({
      id: config.id,
      type: 'image',
      position: {
        x: imageStartX + config.x * (LAYOUT.IMAGE_NODE_SIZE + LAYOUT.NODE_GAP_X),
        y: imageY + config.y * (LAYOUT.IMAGE_NODE_SIZE + LAYOUT.NODE_GAP_Y),
      },
      data: {
        label: `${character.name} - ${config.label}`,
        instructions: config.prompt,
      },
      width: LAYOUT.IMAGE_NODE_SIZE,
      height: LAYOUT.IMAGE_NODE_SIZE,
    });
  }

  // 3. Nœud COLLECTION
  const collectionX = imageStartX + 2 * (LAYOUT.IMAGE_NODE_SIZE + LAYOUT.NODE_GAP_X) + LAYOUT.NODE_GAP_X;
  const collectionY = startY + LAYOUT.IMAGE_NODE_SIZE / 2;
  
  structure.collectionNodes.push({
    id: collectionNodeId,
    type: 'collection',
    position: { x: collectionX, y: collectionY },
    data: {
      label: `Personnage ${character.name}`,
      items: [],
      headerColor: '#F6C744',
      collapsed: true,
    },
    width: LAYOUT.COLLECTION_NODE_WIDTH,
  });

  // 4. Edges : images → collection
  for (const imgId of Object.values(imageNodeIds)) {
    structure.edges.push({
      id: `edge-${imgId}-${collectionNodeId}`,
      source: imgId,
      target: collectionNodeId,
      type: 'default',
    });
  }

  // 5. Tracking
  structure.characterCollectionIds[character.id] = collectionNodeId;
  structure.characterImageMap[character.id] = Object.values(imageNodeIds);
}

// ========== CRÉATION LIEU ==========
function createLocationStructure(
  location: GeneratedLocation,
  startX: number,
  startY: number,
  structure: CanvasStructure,
  testMode: boolean = false
): void {
  const textNodeId = nodeId('text-lieu');
  const collectionNodeId = nodeId('collection-lieu');
  
  // En mode test : seulement 2 angles
  const imageNodeIds: Record<string, string> = testMode
    ? {
        angle1: nodeId('img-angle1'),
        angle2: nodeId('img-angle2'),
      }
    : {
        angle1: nodeId('img-angle1'),
        angle2: nodeId('img-angle2'),
        angle3: nodeId('img-angle3'),
      };

  // 1. Nœud TEXT
  structure.textNodes.push({
    id: textNodeId,
    type: 'text',
    position: { x: startX, y: startY },
    data: {
      text: `# ${location.name}\n\n${location.description}`,
    },
    width: LAYOUT.TEXT_NODE_WIDTH,
  });

  // 2. Nœuds IMAGE (3 angles ou 2 en mode test)
  const imageStartX = startX + LAYOUT.TEXT_NODE_WIDTH + LAYOUT.NODE_GAP_X;
  
  const allImageConfigs = [
    { key: 'angle1', id: imageNodeIds.angle1, label: 'Angle 1', prompt: location.prompts.angle1, x: 0 },
    { key: 'angle2', id: imageNodeIds.angle2, label: 'Angle 2', prompt: location.prompts.angle2, x: 1 },
    { key: 'angle3', id: imageNodeIds.angle3, label: 'Angle 3', prompt: location.prompts.angle3, x: 2 },
  ];
  
  // Filtrer selon le mode
  const imageConfigs = allImageConfigs.filter(c => imageNodeIds[c.key]);

  for (const config of imageConfigs) {
    structure.imageNodes.push({
      id: config.id,
      type: 'image',
      position: {
        x: imageStartX + config.x * (LAYOUT.IMAGE_NODE_SIZE + LAYOUT.NODE_GAP_X),
        y: startY,
      },
      data: {
        label: `${location.name} - ${config.label}`,
        instructions: config.prompt,
      },
      width: LAYOUT.IMAGE_NODE_SIZE,
      height: LAYOUT.IMAGE_NODE_SIZE,
    });
  }

  // 3. Nœud COLLECTION (position dynamique selon le nombre d'images)
  const numImages = imageConfigs.length;
  const collectionX = imageStartX + numImages * (LAYOUT.IMAGE_NODE_SIZE + LAYOUT.NODE_GAP_X) + LAYOUT.NODE_GAP_X;
  
  structure.collectionNodes.push({
    id: collectionNodeId,
    type: 'collection',
    position: { x: collectionX, y: startY },
    data: {
      label: `Lieu ${location.name}`,
      items: [],
      headerColor: '#22c55e',
      collapsed: true,
    },
    width: LAYOUT.COLLECTION_NODE_WIDTH,
  });

  // 4. Edges
  for (const imgId of Object.values(imageNodeIds)) {
    structure.edges.push({
      id: `edge-${imgId}-${collectionNodeId}`,
      source: imgId,
      target: collectionNodeId,
      type: 'default',
    });
  }

  // 5. Tracking
  structure.locationCollectionIds[location.id] = collectionNodeId;
  structure.locationImageMap[location.id] = Object.values(imageNodeIds);
}

// ========== CRÉATION PLAN ==========
function createPlanStructure(
  plan: GeneratedPlan,
  scene: GeneratedScene,
  startX: number,
  startY: number,
  structure: CanvasStructure
): { width: number; height: number } {
  const textNodeId = nodeId('text-plan');
  const videoNodeId = nodeId('video-plan');

  // 1. Nœud TEXT (prompt du plan)
  structure.textNodes.push({
    id: textNodeId,
    type: 'text',
    position: { x: startX, y: startY },
    data: {
      text: `## Plan ${scene.sceneNumber}.${plan.planNumber}\n\n${plan.prompt}${plan.cameraMovement ? `\n\n📷 *${plan.cameraMovement}*` : ''}`,
    },
    width: LAYOUT.TEXT_NODE_WIDTH,
  });

  // 2. Nœud VIDEO
  const videoX = startX + LAYOUT.TEXT_NODE_WIDTH + LAYOUT.NODE_GAP_X * 2;
  
  structure.videoNodes.push({
    id: videoNodeId,
    type: 'video',
    position: { x: videoX, y: startY },
    data: {
      label: `Plan ${scene.sceneNumber}.${plan.planNumber}`,
      instructions: plan.prompt,
    },
    width: LAYOUT.VIDEO_NODE_WIDTH,
    height: LAYOUT.VIDEO_NODE_HEIGHT,
  });

  // 3. Edges : collections → video + text (prompt) → video
  // Collections personnages → video (directement)
  for (const charRef of plan.characterRefs) {
    const collectionId = structure.characterCollectionIds[charRef];
    if (collectionId) {
      structure.edges.push({
        id: `edge-${collectionId}-${videoNodeId}-${nanoid(4)}`,
        source: collectionId,
        target: videoNodeId,
        type: 'default',
      });
    }
  }

  // Collection lieu → video (directement)
  if (plan.locationRef) {
    const collectionId = structure.locationCollectionIds[plan.locationRef];
    if (collectionId) {
      structure.edges.push({
        id: `edge-${collectionId}-${videoNodeId}-${nanoid(4)}`,
        source: collectionId,
        target: videoNodeId,
        type: 'default',
      });
    }
  }

  // Text (prompt) → video
  structure.edges.push({
    id: `edge-${textNodeId}-${videoNodeId}`,
    source: textNodeId,
    target: videoNodeId,
    type: 'default',
  });

  // 4. Tracking
  structure.planVideoMap[plan.id] = videoNodeId;

  return { width: LAYOUT.PLAN_WIDTH, height: LAYOUT.PLAN_HEIGHT };
}

// ========== CRÉATION SCÈNE ==========
function createSceneStructure(
  scene: GeneratedScene,
  startX: number,
  startY: number,
  structure: CanvasStructure
): { width: number; height: number } {
  const shapeNodeId = nodeId('shape-scene');
  const labelNodeId = nodeId('label-scene');

  // Calculer les dimensions de la scène
  const plansCount = scene.plans.length;
  const rows = Math.ceil(plansCount / LAYOUT.PLANS_PER_ROW);
  const contentHeight = rows * (LAYOUT.PLAN_HEIGHT + LAYOUT.NODE_GAP_Y);
  const sceneWidth = LAYOUT.PLAN_WIDTH + LAYOUT.SCENE_PADDING * 2;
  const sceneHeight = LAYOUT.SCENE_TITLE_HEIGHT + contentHeight + LAYOUT.SCENE_PADDING * 2;

  // 1. Shape de fond
  structure.shapeNodes.push({
    id: shapeNodeId,
    type: 'shape',
    position: { x: startX, y: startY },
    data: {
      color: scene.color,
      opacity: 12,
      borderRadius: 24,
    },
    style: {
      width: sceneWidth,
      height: sceneHeight,
    },
    zIndex: LAYOUT.SHAPE_Z_INDEX,
  });

  // 2. Label titre
  structure.labelNodes.push({
    id: labelNodeId,
    type: 'label',
    position: {
      x: startX + LAYOUT.SCENE_PADDING,
      y: startY + 30,
    },
    data: {
      text: `SCÈNE ${scene.sceneNumber}: ${scene.title.toUpperCase()}`,
      fontSize: LAYOUT.SCENE_TITLE_FONT_SIZE,
      color: scene.color,
    },
    zIndex: LAYOUT.TITLE_Z_INDEX,
  });

  // 3. Plans
  let planY = startY + LAYOUT.SCENE_TITLE_HEIGHT + LAYOUT.SCENE_PADDING;
  
  for (const plan of scene.plans) {
    createPlanStructure(
      plan,
      scene,
      startX + LAYOUT.SCENE_PADDING,
      planY,
      structure
    );
    planY += LAYOUT.PLAN_HEIGHT + LAYOUT.NODE_GAP_Y;
  }

  return { width: sceneWidth, height: sceneHeight };
}

// ========== GÉNÉRATEUR PRINCIPAL ==========
export interface GeneratedCanvasData {
  nodes: Node[];
  edges: Edge[];
  viewport: { x: number; y: number; zoom: number };
  structure: CanvasStructure;
}

export function generateCanvasFromProject(
  project: GeneratedProjectStructure,
  testMode: boolean = false
): GeneratedCanvasData {
  // Structure pour tracking
  const structure: CanvasStructure = {
    characterCollectionIds: {},
    locationCollectionIds: {},
    textNodes: [],
    imageNodes: [],
    collectionNodes: [],
    videoNodes: [],
    shapeNodes: [],
    labelNodes: [],
    edges: [],
    characterImageMap: {},
    locationImageMap: {},
    planVideoMap: {},
  };

  let currentY = LAYOUT.MARGIN;

  // ========== SECTION PERSONNAGES ==========
  if (project.characters.length > 0) {
    // Titre section
    structure.labelNodes.push({
      id: nodeId('label-section-perso'),
      type: 'label',
      position: { x: LAYOUT.MARGIN, y: currentY },
      data: {
        text: '👤 PERSONNAGES',
        fontSize: 72,
        color: '#F6C744',
      },
    });
    currentY += 100;

    for (const character of project.characters) {
      createCharacterStructure(character, LAYOUT.MARGIN, currentY, structure, testMode);
      currentY += LAYOUT.CHARACTER_ROW_HEIGHT;
    }
  }

  // ========== SECTION LIEUX ==========
  if (project.locations.length > 0) {
    currentY += LAYOUT.SECTION_GAP;

    // Titre section
    structure.labelNodes.push({
      id: nodeId('label-section-lieux'),
      type: 'label',
      position: { x: LAYOUT.MARGIN, y: currentY },
      data: {
        text: '📍 LIEUX',
        fontSize: 72,
        color: '#22c55e',
      },
    });
    currentY += 100;

    for (const location of project.locations) {
      createLocationStructure(location, LAYOUT.MARGIN, currentY, structure, testMode);
      currentY += LAYOUT.LOCATION_ROW_HEIGHT;
    }
  }

  // ========== SECTION SCÈNES (à droite) ==========
  let sceneY = LAYOUT.MARGIN;

  for (let i = 0; i < project.scenes.length; i++) {
    const scene = project.scenes[i];
    scene.color = getSceneColor(i);

    const { height } = createSceneStructure(
      scene,
      LAYOUT.SCENES_START_X,
      sceneY,
      structure
    );

    sceneY += height + LAYOUT.SCENE_GAP;
  }

  // ========== ASSEMBLER LES NŒUDS ==========
  // Ordre important pour le z-index visuel
  const allNodes: Node[] = [
    ...structure.shapeNodes,     // Fond en premier (z-index négatif)
    ...structure.labelNodes,     // Labels
    ...structure.textNodes,      // Textes
    ...structure.imageNodes,     // Images
    ...structure.collectionNodes, // Collections
    ...structure.videoNodes,     // Vidéos
  ];

  return {
    nodes: allNodes,
    edges: structure.edges,
    viewport: { x: 50, y: 50, zoom: 0.6 },
    structure,
  };
}

// ========== HELPER : Structure vide ==========
export function createEmptyProjectStructure(title: string, synopsis: string): GeneratedProjectStructure {
  return {
    title,
    synopsis,
    characters: [],
    locations: [],
    scenes: [],
    totalPlans: 0,
    estimatedDuration: 0,
  };
}

// ========== HELPER : Obtenir les IDs pour génération séquentielle ==========
export function getGenerationSequence(structure: CanvasStructure, project?: GeneratedProjectStructure) {
  // Créer un map des plans par ID pour accès rapide
  const plansMap = new Map<string, { prompt: string; characterRefs: string[]; locationRef?: string }>();
  
  if (project) {
    for (const scene of project.scenes) {
      for (const plan of scene.plans) {
        plansMap.set(plan.id, {
          prompt: plan.prompt,
          characterRefs: plan.characterRefs || [],
          locationRef: plan.locationRef,
        });
      }
    }
  }

  return {
    // Étape 1 : Images de personnages à générer
    characterImages: Object.entries(structure.characterImageMap).map(([charId, imageIds]) => ({
      characterId: charId,
      imageNodeIds: imageIds,
    })),
    
    // Étape 2 : Images de lieux à générer
    locationImages: Object.entries(structure.locationImageMap).map(([locId, imageIds]) => ({
      locationId: locId,
      imageNodeIds: imageIds,
    })),
    
    // Étape 3 : Collections à populer (après génération images)
    characterCollections: Object.entries(structure.characterCollectionIds),
    locationCollections: Object.entries(structure.locationCollectionIds),
    
    // Étape 4 : Vidéos à générer (après collections remplies)
    videos: Object.entries(structure.planVideoMap).map(([planId, videoId]) => {
      const planInfo = plansMap.get(planId);
      
      // Résoudre les IDs de collections depuis les références
      const characterCollectionIds: string[] = [];
      if (planInfo?.characterRefs) {
        for (const charRef of planInfo.characterRefs) {
          const collectionId = structure.characterCollectionIds[charRef];
          if (collectionId) {
            characterCollectionIds.push(collectionId);
          }
        }
      }
      
      let locationCollectionId: string | undefined;
      if (planInfo?.locationRef) {
        locationCollectionId = structure.locationCollectionIds[planInfo.locationRef];
      }

      return {
        planId,
        videoNodeId: videoId,
        prompt: planInfo?.prompt || '',
        characterCollectionIds,
        locationCollectionId,
      };
    }),
  };
}
