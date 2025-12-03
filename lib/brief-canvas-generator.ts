/**
 * Générateur de canvas à partir d'un projet structuré
 * Phase 2 : Crée les nœuds, shapes et edges dans le canvas
 */

import { nanoid } from 'nanoid';
import type { Node, Edge } from '@xyflow/react';
import type {
  GeneratedProjectStructure,
  GeneratedCharacter,
  GeneratedLocation,
  GeneratedScene,
  GeneratedPlan,
  SceneCluster,
  CanvasNodePosition,
} from '@/types/generated-project';
import { getSceneColor } from '@/types/generated-project';

// ========== CONSTANTES DE LAYOUT ==========
const LAYOUT = {
  // Marges et espacement
  MARGIN: 100,
  SCENE_GAP: 400,           // Espace entre les scènes
  CLUSTER_PADDING: 80,      // Padding intérieur des clusters
  
  // Tailles des nœuds
  TEXT_NODE_WIDTH: 300,
  TEXT_NODE_HEIGHT: 150,
  IMAGE_NODE_SIZE: 200,
  COLLECTION_NODE_WIDTH: 380,
  VIDEO_NODE_WIDTH: 400,
  
  // Espacement entre nœuds
  NODE_GAP_X: 50,
  NODE_GAP_Y: 30,
  
  // Titre de scène
  SCENE_TITLE_FONT_SIZE: 120,
  SCENE_TITLE_HEIGHT: 150,
  
  // Z-Index
  SHAPE_Z_INDEX: -1000,
  TITLE_Z_INDEX: -999,
};

// ========== GÉNÉRATEUR D'IDS ==========
function nodeId(prefix: string): string {
  return `${prefix}-${nanoid(8)}`;
}

// ========== CRÉATION DES NŒUDS PERSONNAGES ==========
interface CharacterNodes {
  textNode: Node;
  imageNodes: Node[];
  collectionNode: Node;
  edges: Edge[];
}

function createCharacterNodes(
  character: GeneratedCharacter,
  startX: number,
  startY: number
): CharacterNodes {
  const textNodeId = nodeId('text-perso');
  const collectionNodeId = nodeId('collection-perso');
  const imageNodeIds = {
    face: nodeId('img-face'),
    profile: nodeId('img-profile'),
    fullBody: nodeId('img-fullbody'),
    back: nodeId('img-back'),
  };

  // Nœud TEXT avec la description
  const textNode: Node = {
    id: textNodeId,
    type: 'text',
    position: { x: startX, y: startY },
    data: {
      text: `**${character.name}**\n\n${character.description}\n\n---\n\n**Face:** ${character.prompts.face}\n\n**Profil:** ${character.prompts.profile}\n\n**Pied:** ${character.prompts.fullBody}\n\n**Dos:** ${character.prompts.back}`,
    },
    width: LAYOUT.TEXT_NODE_WIDTH,
  };

  // Nœuds IMAGE (4 images)
  const imageNodes: Node[] = [
    {
      id: imageNodeIds.face,
      type: 'image',
      position: { x: startX + LAYOUT.TEXT_NODE_WIDTH + LAYOUT.NODE_GAP_X, y: startY },
      data: { 
        label: `${character.name} - Face`,
        instructions: character.prompts.face,
      },
      width: LAYOUT.IMAGE_NODE_SIZE,
      height: LAYOUT.IMAGE_NODE_SIZE,
    },
    {
      id: imageNodeIds.profile,
      type: 'image',
      position: { x: startX + LAYOUT.TEXT_NODE_WIDTH + LAYOUT.NODE_GAP_X + LAYOUT.IMAGE_NODE_SIZE + LAYOUT.NODE_GAP_X, y: startY },
      data: { 
        label: `${character.name} - Profil`,
        instructions: character.prompts.profile,
      },
      width: LAYOUT.IMAGE_NODE_SIZE,
      height: LAYOUT.IMAGE_NODE_SIZE,
    },
    {
      id: imageNodeIds.fullBody,
      type: 'image',
      position: { x: startX + LAYOUT.TEXT_NODE_WIDTH + LAYOUT.NODE_GAP_X, y: startY + LAYOUT.IMAGE_NODE_SIZE + LAYOUT.NODE_GAP_Y },
      data: { 
        label: `${character.name} - Pied`,
        instructions: character.prompts.fullBody,
      },
      width: LAYOUT.IMAGE_NODE_SIZE,
      height: LAYOUT.IMAGE_NODE_SIZE,
    },
    {
      id: imageNodeIds.back,
      type: 'image',
      position: { x: startX + LAYOUT.TEXT_NODE_WIDTH + LAYOUT.NODE_GAP_X + LAYOUT.IMAGE_NODE_SIZE + LAYOUT.NODE_GAP_X, y: startY + LAYOUT.IMAGE_NODE_SIZE + LAYOUT.NODE_GAP_Y },
      data: { 
        label: `${character.name} - Dos`,
        instructions: character.prompts.back,
      },
      width: LAYOUT.IMAGE_NODE_SIZE,
      height: LAYOUT.IMAGE_NODE_SIZE,
    },
  ];

  // Nœud COLLECTION pour regrouper les images
  const collectionNode: Node = {
    id: collectionNodeId,
    type: 'collection',
    position: { 
      x: startX + LAYOUT.TEXT_NODE_WIDTH + 2 * (LAYOUT.IMAGE_NODE_SIZE + LAYOUT.NODE_GAP_X) + LAYOUT.NODE_GAP_X + 50, 
      y: startY + LAYOUT.IMAGE_NODE_SIZE / 2 
    },
    data: {
      label: `Personnage ${character.name}`,
      items: [],
      headerColor: '#F6C744',
    },
    width: LAYOUT.COLLECTION_NODE_WIDTH,
  };

  // Edges : images → collection
  const edges: Edge[] = Object.values(imageNodeIds).map((imgId) => ({
    id: `edge-${imgId}-${collectionNodeId}`,
    source: imgId,
    target: collectionNodeId,
    type: 'default',
  }));

  return { textNode, imageNodes, collectionNode, edges };
}

// ========== CRÉATION DES NŒUDS LIEUX ==========
interface LocationNodes {
  textNode: Node;
  imageNodes: Node[];
  collectionNode: Node;
  edges: Edge[];
}

function createLocationNodes(
  location: GeneratedLocation,
  startX: number,
  startY: number
): LocationNodes {
  const textNodeId = nodeId('text-lieu');
  const collectionNodeId = nodeId('collection-lieu');
  const imageNodeIds = {
    angle1: nodeId('img-angle1'),
    angle2: nodeId('img-angle2'),
    angle3: nodeId('img-angle3'),
  };

  // Nœud TEXT avec la description
  const textNode: Node = {
    id: textNodeId,
    type: 'text',
    position: { x: startX, y: startY },
    data: {
      text: `**${location.name}**\n\n${location.description}\n\n---\n\n**Angle 1:** ${location.prompts.angle1}\n\n**Angle 2:** ${location.prompts.angle2}\n\n**Angle 3:** ${location.prompts.angle3}`,
    },
    width: LAYOUT.TEXT_NODE_WIDTH,
  };

  // Nœuds IMAGE (3 angles)
  const imageNodes: Node[] = [
    {
      id: imageNodeIds.angle1,
      type: 'image',
      position: { x: startX + LAYOUT.TEXT_NODE_WIDTH + LAYOUT.NODE_GAP_X, y: startY },
      data: { 
        label: `${location.name} - Angle 1`,
        instructions: location.prompts.angle1,
      },
      width: LAYOUT.IMAGE_NODE_SIZE,
      height: LAYOUT.IMAGE_NODE_SIZE,
    },
    {
      id: imageNodeIds.angle2,
      type: 'image',
      position: { x: startX + LAYOUT.TEXT_NODE_WIDTH + LAYOUT.NODE_GAP_X + LAYOUT.IMAGE_NODE_SIZE + LAYOUT.NODE_GAP_X, y: startY },
      data: { 
        label: `${location.name} - Angle 2`,
        instructions: location.prompts.angle2,
      },
      width: LAYOUT.IMAGE_NODE_SIZE,
      height: LAYOUT.IMAGE_NODE_SIZE,
    },
    {
      id: imageNodeIds.angle3,
      type: 'image',
      position: { x: startX + LAYOUT.TEXT_NODE_WIDTH + LAYOUT.NODE_GAP_X + 2 * (LAYOUT.IMAGE_NODE_SIZE + LAYOUT.NODE_GAP_X), y: startY },
      data: { 
        label: `${location.name} - Angle 3`,
        instructions: location.prompts.angle3,
      },
      width: LAYOUT.IMAGE_NODE_SIZE,
      height: LAYOUT.IMAGE_NODE_SIZE,
    },
  ];

  // Nœud COLLECTION
  const collectionNode: Node = {
    id: collectionNodeId,
    type: 'collection',
    position: { 
      x: startX + LAYOUT.TEXT_NODE_WIDTH + 3 * (LAYOUT.IMAGE_NODE_SIZE + LAYOUT.NODE_GAP_X) + 50, 
      y: startY 
    },
    data: {
      label: `Lieu ${location.name}`,
      items: [],
      headerColor: '#22c55e',
    },
    width: LAYOUT.COLLECTION_NODE_WIDTH,
  };

  // Edges
  const edges: Edge[] = Object.values(imageNodeIds).map((imgId) => ({
    id: `edge-${imgId}-${collectionNodeId}`,
    source: imgId,
    target: collectionNodeId,
    type: 'default',
  }));

  return { textNode, imageNodes, collectionNode, edges };
}

// ========== CRÉATION DES NŒUDS PLANS ==========
interface PlanNodes {
  textNode: Node;
  videoNode: Node;
  edges: Edge[];
}

function createPlanNodes(
  plan: GeneratedPlan,
  scene: GeneratedScene,
  characterCollectionIds: Record<string, string>,
  locationCollectionIds: Record<string, string>,
  startX: number,
  startY: number
): PlanNodes {
  const textNodeId = nodeId('text-plan');
  const videoNodeId = nodeId('video-plan');

  // Nœud TEXT avec le prompt
  const textNode: Node = {
    id: textNodeId,
    type: 'text',
    position: { x: startX, y: startY },
    data: {
      text: `**Plan ${scene.sceneNumber}.${plan.planNumber}**\n\n${plan.prompt}${plan.cameraMovement ? `\n\n📷 ${plan.cameraMovement}` : ''}${plan.notes ? `\n\n💡 ${plan.notes}` : ''}`,
    },
    width: LAYOUT.TEXT_NODE_WIDTH,
  };

  // Nœud VIDEO
  const videoNode: Node = {
    id: videoNodeId,
    type: 'video',
    position: { x: startX + LAYOUT.TEXT_NODE_WIDTH + LAYOUT.NODE_GAP_X + 100, y: startY },
    data: {
      label: `Vidéo Plan ${scene.sceneNumber}.${plan.planNumber}`,
      instructions: plan.prompt,
      duration: plan.duration,
    },
    width: LAYOUT.VIDEO_NODE_WIDTH,
  };

  // Edges : collections personnages/lieux → texte prompt → vidéo
  const edges: Edge[] = [];

  // Lier les collections de personnages au prompt
  for (const charRef of plan.characterRefs) {
    const collectionId = characterCollectionIds[charRef];
    if (collectionId) {
      edges.push({
        id: `edge-${collectionId}-${textNodeId}`,
        source: collectionId,
        target: textNodeId,
        type: 'default',
      });
    }
  }

  // Lier la collection du lieu au prompt
  if (plan.locationRef) {
    const collectionId = locationCollectionIds[plan.locationRef];
    if (collectionId) {
      edges.push({
        id: `edge-${collectionId}-${textNodeId}`,
        source: collectionId,
        target: textNodeId,
        type: 'default',
      });
    }
  }

  // Lier le prompt à la vidéo
  edges.push({
    id: `edge-${textNodeId}-${videoNodeId}`,
    source: textNodeId,
    target: videoNodeId,
    type: 'default',
  });

  return { textNode, videoNode, edges };
}

// ========== CRÉATION D'UN CLUSTER SCÈNE ==========
interface SceneClusterResult {
  shapeNode: Node;
  labelNode: Node;
  planNodes: Node[];
  edges: Edge[];
  bounds: { width: number; height: number };
}

function createSceneCluster(
  scene: GeneratedScene,
  characterCollectionIds: Record<string, string>,
  locationCollectionIds: Record<string, string>,
  startX: number,
  startY: number
): SceneClusterResult {
  const shapeNodeId = nodeId('shape-scene');
  const labelNodeId = nodeId('label-scene');
  
  const allPlanNodes: Node[] = [];
  const allEdges: Edge[] = [];

  // Calculer la disposition des plans
  const plansPerRow = 2;
  const planWidth = LAYOUT.TEXT_NODE_WIDTH + LAYOUT.NODE_GAP_X + LAYOUT.VIDEO_NODE_WIDTH + 100;
  const planHeight = 250;

  let currentX = startX + LAYOUT.CLUSTER_PADDING;
  let currentY = startY + LAYOUT.SCENE_TITLE_HEIGHT + LAYOUT.CLUSTER_PADDING;
  let maxRowWidth = 0;

  scene.plans.forEach((plan, index) => {
    const col = index % plansPerRow;
    const row = Math.floor(index / plansPerRow);

    const planX = currentX + col * (planWidth + LAYOUT.NODE_GAP_X);
    const planY = currentY + row * (planHeight + LAYOUT.NODE_GAP_Y);

    const { textNode, videoNode, edges } = createPlanNodes(
      plan,
      scene,
      characterCollectionIds,
      locationCollectionIds,
      planX,
      planY
    );

    allPlanNodes.push(textNode, videoNode);
    allEdges.push(...edges);

    maxRowWidth = Math.max(maxRowWidth, (col + 1) * (planWidth + LAYOUT.NODE_GAP_X));
  });

  const rows = Math.ceil(scene.plans.length / plansPerRow);
  const clusterWidth = maxRowWidth + LAYOUT.CLUSTER_PADDING * 2;
  const clusterHeight = LAYOUT.SCENE_TITLE_HEIGHT + rows * (planHeight + LAYOUT.NODE_GAP_Y) + LAYOUT.CLUSTER_PADDING * 2;

  // Rectangle de fond (shape)
  const shapeNode: Node = {
    id: shapeNodeId,
    type: 'shape',
    position: { x: startX, y: startY },
    data: {
      color: scene.color,
      opacity: 15,
      borderRadius: 20,
    },
    style: {
      width: clusterWidth,
      height: clusterHeight,
    },
    zIndex: LAYOUT.SHAPE_Z_INDEX,
  };

  // Label/Titre de la scène (nœud text très grand)
  const labelNode: Node = {
    id: labelNodeId,
    type: 'label',
    position: { 
      x: startX + LAYOUT.CLUSTER_PADDING, 
      y: startY + 20 
    },
    data: {
      text: `SCÈNE ${scene.sceneNumber}: ${scene.title.toUpperCase()}`,
      fontSize: LAYOUT.SCENE_TITLE_FONT_SIZE,
      color: scene.color,
    },
    zIndex: LAYOUT.TITLE_Z_INDEX,
  };

  return {
    shapeNode,
    labelNode,
    planNodes: allPlanNodes,
    edges: allEdges,
    bounds: { width: clusterWidth, height: clusterHeight },
  };
}

// ========== GÉNÉRATEUR PRINCIPAL ==========
export interface GeneratedCanvasData {
  nodes: Node[];
  edges: Edge[];
  viewport: { x: number; y: number; zoom: number };
}

export function generateCanvasFromProject(
  project: GeneratedProjectStructure
): GeneratedCanvasData {
  const allNodes: Node[] = [];
  const allEdges: Edge[] = [];

  // Maps pour retrouver les IDs des collections
  const characterCollectionIds: Record<string, string> = {};
  const locationCollectionIds: Record<string, string> = {};

  // ========== ZONE PERSONNAGES (en haut à gauche) ==========
  let currentY = LAYOUT.MARGIN;
  
  // Titre zone personnages
  allNodes.push({
    id: nodeId('label-personnages'),
    type: 'label',
    position: { x: LAYOUT.MARGIN, y: currentY },
    data: {
      text: '👤 PERSONNAGES',
      fontSize: 80,
      color: '#F6C744',
    },
  });
  currentY += 120;

  for (const character of project.characters) {
    const { textNode, imageNodes, collectionNode, edges } = createCharacterNodes(
      character,
      LAYOUT.MARGIN,
      currentY
    );

    allNodes.push(textNode, ...imageNodes, collectionNode);
    allEdges.push(...edges);
    characterCollectionIds[character.id] = collectionNode.id;

    currentY += 2 * LAYOUT.IMAGE_NODE_SIZE + LAYOUT.NODE_GAP_Y + 80;
  }

  // ========== ZONE LIEUX (sous les personnages) ==========
  currentY += 100;
  
  // Titre zone lieux
  allNodes.push({
    id: nodeId('label-lieux'),
    type: 'label',
    position: { x: LAYOUT.MARGIN, y: currentY },
    data: {
      text: '📍 LIEUX',
      fontSize: 80,
      color: '#22c55e',
    },
  });
  currentY += 120;

  for (const location of project.locations) {
    const { textNode, imageNodes, collectionNode, edges } = createLocationNodes(
      location,
      LAYOUT.MARGIN,
      currentY
    );

    allNodes.push(textNode, ...imageNodes, collectionNode);
    allEdges.push(...edges);
    locationCollectionIds[location.id] = collectionNode.id;

    currentY += LAYOUT.IMAGE_NODE_SIZE + 80;
  }

  // ========== ZONES SCÈNES (à droite) ==========
  const scenesStartX = LAYOUT.MARGIN + 1500; // Décalé à droite
  let sceneY = LAYOUT.MARGIN;

  for (let i = 0; i < project.scenes.length; i++) {
    const scene = project.scenes[i];
    scene.color = getSceneColor(i);

    const { shapeNode, labelNode, planNodes, edges, bounds } = createSceneCluster(
      scene,
      characterCollectionIds,
      locationCollectionIds,
      scenesStartX,
      sceneY
    );

    allNodes.push(shapeNode, labelNode, ...planNodes);
    allEdges.push(...edges);

    sceneY += bounds.height + LAYOUT.SCENE_GAP;
  }

  return {
    nodes: allNodes,
    edges: allEdges,
    viewport: { x: 0, y: 0, zoom: 0.3 },
  };
}

// ========== HELPER : Créer un projet vide avec structure ==========
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

