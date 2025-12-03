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
  CHARACTER_ROW_HEIGHT: 1000, // Augmenté pour 4 images
  LOCATION_ROW_HEIGHT: 600,   // Augmenté pour 4 images
  
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

// ========== CONSTANTES POUR LES PROMPTS ==========
const CHARACTER_PROMPT_PREFIX = `Professional studio photography, solid black background, neutral studio lighting with soft key light, `;
const CHARACTER_PROMPT_SUFFIX = `, neutral facial expression, relaxed pose, high-end fashion photography style, 8K, ultra detailed, sharp focus`;

const LOCATION_PROMPT_SUFFIX = `, professional cinematography, 8K, ultra detailed, cinematic lighting`;

// ========== GÉNÉRATEUR D'IDS ==========
function nodeId(prefix: string): string {
  return `${prefix}-${nanoid(8)}`;
}

// ========== HELPER: Convertir texte en format Tiptap ==========
function textToTiptapContent(text: string): object {
  // Convertir le markdown basique en paragraphes Tiptap
  const lines = text.split('\n');
  const content: any[] = [];
  
  for (const line of lines) {
    if (line.trim() === '') {
      // Paragraphe vide
      content.push({ type: 'paragraph' });
    } else if (line.startsWith('# ')) {
      // Titre H1
      content.push({
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: line.slice(2) }],
      });
    } else if (line.startsWith('## ')) {
      // Titre H2
      content.push({
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: line.slice(3) }],
      });
    } else if (line.startsWith('### ')) {
      // Titre H3
      content.push({
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: line.slice(4) }],
      });
    } else if (line.startsWith('📷 *') && line.endsWith('*')) {
      // Texte italique avec emoji
      content.push({
        type: 'paragraph',
        content: [
          { type: 'text', text: '📷 ' },
          { type: 'text', marks: [{ type: 'italic' }], text: line.slice(4, -1) },
        ],
      });
    } else {
      // Paragraphe normal
      content.push({
        type: 'paragraph',
        content: [{ type: 'text', text: line }],
      });
    }
  }
  
  return {
    type: 'doc',
    content: content.length > 0 ? content : [{ type: 'paragraph' }],
  };
}

// ========== HELPER: Enrichir prompt personnage avec fond noir ==========
function enrichCharacterPrompt(originalPrompt: string, viewType: 'fullBody' | 'face' | 'profile' | 'back'): string {
  // Ajouter le préfixe et suffixe pour fond noir et expression neutre
  let poseDescription = '';
  switch (viewType) {
    case 'fullBody':
      poseDescription = 'full body shot, standing front facing, ';
      break;
    case 'face':
      poseDescription = 'close-up portrait, front facing, ';
      break;
    case 'profile':
      poseDescription = 'side profile portrait, ';
      break;
    case 'back':
      poseDescription = 'back view, full body from behind, ';
      break;
  }
  
  return `${CHARACTER_PROMPT_PREFIX}${poseDescription}${originalPrompt}${CHARACTER_PROMPT_SUFFIX}`;
}

// ========== HELPER: Enrichir prompt lieu ==========
function enrichLocationPrompt(originalPrompt: string, angleNum: number): string {
  let angleDescription = '';
  switch (angleNum) {
    case 1:
      angleDescription = 'establishing shot, wide angle view, ';
      break;
    case 2:
      angleDescription = 'medium shot, alternative angle, ';
      break;
    case 3:
      angleDescription = 'detail shot, atmospheric angle, ';
      break;
    case 4:
      angleDescription = 'close-up detail shot, ';
      break;
  }
  
  return `${angleDescription}${originalPrompt}${LOCATION_PROMPT_SUFFIX}`;
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
  
  // Métadonnées - avec ordre de génération
  characterImageMap: Record<string, { nodeIds: string[]; prompts: Record<string, string>; aspectRatios: Record<string, string>; order: string[] }>;
  locationImageMap: Record<string, { nodeIds: string[]; prompts: Record<string, string>; aspectRatios: Record<string, string>; order: string[] }>;
  planVideoMap: Record<string, string[]>;       // planId -> videoNodeIds (TABLEAU pour les copies)
  
  // Config vidéos
  videoCopies: number;                          // Nombre de copies par plan
  videoSettings: { duration: number; aspectRatio: string }; // Paramètres vidéo
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
  
  // TOUJOURS 4 images pour les personnages (mode test ou non)
  // La première est fullBody (référence), les autres sont générées par edit-multi
  const imageNodeIds: Record<string, string> = {
    fullBody: nodeId('img-fullbody'),  // PREMIÈRE IMAGE (référence)
    face: nodeId('img-face'),
    profile: nodeId('img-profile'),
    back: nodeId('img-back'),
  };
  
  // Ordre de génération : fullBody d'abord (text-to-image), puis les autres (edit-multi)
  const generationOrder = ['fullBody', 'face', 'profile', 'back'];

  // Texte descriptif
  const textContent = `# ${character.name}\n\n${character.description}\n\n**Code référence:** ${character.referenceCode}`;
  
  // 1. Nœud TEXT (description)
  structure.textNodes.push({
    id: textNodeId,
    type: 'text',
    position: { x: startX, y: startY },
    data: {
      text: textContent,
      content: textToTiptapContent(textContent),
    },
    width: LAYOUT.TEXT_NODE_WIDTH,
  });

  // 2. Nœuds IMAGE (4 vues)
  // fullBody en 9:16, les autres en 1:1 pour les portraits
  const imageY = startY;
  const imageStartX = startX + LAYOUT.TEXT_NODE_WIDTH + LAYOUT.NODE_GAP_X;
  
  const imageConfigs = [
    { key: 'fullBody', id: imageNodeIds.fullBody, label: 'Pied (Réf)', prompt: character.prompts.fullBody, x: 0, y: 0, aspectRatio: '9:16', isReference: true },
    { key: 'face', id: imageNodeIds.face, label: 'Visage', prompt: character.prompts.face, x: 1, y: 0, aspectRatio: '1:1', isReference: false },
    { key: 'profile', id: imageNodeIds.profile, label: 'Profil', prompt: character.prompts.profile, x: 0, y: 1, aspectRatio: '1:1', isReference: false },
    { key: 'back', id: imageNodeIds.back, label: 'Dos', prompt: character.prompts.back, x: 1, y: 1, aspectRatio: '9:16', isReference: false },
  ];

  const prompts: Record<string, string> = {};
  const aspectRatios: Record<string, string> = {};

  for (const config of imageConfigs) {
    // Enrichir le prompt avec fond noir et style studio
    const enrichedPrompt = enrichCharacterPrompt(config.prompt, config.key as any);
    prompts[config.key] = enrichedPrompt;
    aspectRatios[config.key] = config.aspectRatio;
    
    structure.imageNodes.push({
      id: config.id,
      type: 'image',
      position: {
        x: imageStartX + config.x * (LAYOUT.IMAGE_NODE_SIZE + LAYOUT.NODE_GAP_X),
        y: imageY + config.y * (LAYOUT.IMAGE_NODE_SIZE + LAYOUT.NODE_GAP_Y),
      },
      data: {
        label: `${character.name} - ${config.label}`,
        instructions: enrichedPrompt,
        aspectRatio: config.aspectRatio,
        isReference: config.isReference,
        characterId: character.id,
        viewType: config.key,
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

  // 5. Tracking avec info de génération
  structure.characterCollectionIds[character.id] = collectionNodeId;
  structure.characterImageMap[character.id] = {
    nodeIds: Object.values(imageNodeIds),
    prompts,
    aspectRatios,
    order: generationOrder,
  };
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
  
  // TOUJOURS 4 images pour les lieux (mode test ou non)
  // La première est angle1 (référence), les autres sont générées par edit-multi
  const imageNodeIds: Record<string, string> = {
    angle1: nodeId('img-angle1'),  // PREMIÈRE IMAGE (référence)
    angle2: nodeId('img-angle2'),
    angle3: nodeId('img-angle3'),
    angle4: nodeId('img-angle4'),
  };
  
  const generationOrder = ['angle1', 'angle2', 'angle3', 'angle4'];

  // Texte descriptif
  const textContent = `# ${location.name}\n\n${location.description}\n\n**Code référence:** ${location.referenceCode}`;

  // 1. Nœud TEXT
  structure.textNodes.push({
    id: textNodeId,
    type: 'text',
    position: { x: startX, y: startY },
    data: {
      text: textContent,
      content: textToTiptapContent(textContent),
    },
    width: LAYOUT.TEXT_NODE_WIDTH,
  });

  // 2. Nœuds IMAGE (4 angles)
  const imageStartX = startX + LAYOUT.TEXT_NODE_WIDTH + LAYOUT.NODE_GAP_X;
  
  const imageConfigs = [
    { key: 'angle1', id: imageNodeIds.angle1, label: 'Vue 1 (Réf)', prompt: location.prompts.angle1, x: 0, isReference: true },
    { key: 'angle2', id: imageNodeIds.angle2, label: 'Vue 2', prompt: location.prompts.angle2, x: 1, isReference: false },
    { key: 'angle3', id: imageNodeIds.angle3, label: 'Vue 3', prompt: location.prompts.angle3, x: 2, isReference: false },
    { key: 'angle4', id: imageNodeIds.angle4, label: 'Vue 4', prompt: location.prompts.angle3, x: 3, isReference: false }, // Réutilise angle3 prompt
  ];

  const prompts: Record<string, string> = {};
  const aspectRatios: Record<string, string> = {};

  for (const config of imageConfigs) {
    const angleNum = parseInt(config.key.replace('angle', ''));
    const enrichedPrompt = enrichLocationPrompt(config.prompt, angleNum);
    prompts[config.key] = enrichedPrompt;
    aspectRatios[config.key] = '16:9'; // Tous les lieux en 16:9
    
    structure.imageNodes.push({
      id: config.id,
      type: 'image',
      position: {
        x: imageStartX + config.x * (LAYOUT.IMAGE_NODE_SIZE + LAYOUT.NODE_GAP_X),
        y: startY,
      },
      data: {
        label: `${location.name} - ${config.label}`,
        instructions: enrichedPrompt,
        aspectRatio: '16:9',
        isReference: config.isReference,
        locationId: location.id,
        viewType: config.key,
      },
      width: LAYOUT.IMAGE_NODE_SIZE,
      height: LAYOUT.IMAGE_NODE_SIZE,
    });
  }

  // 3. Nœud COLLECTION (position dynamique)
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

  // 5. Tracking avec info de génération
  structure.locationCollectionIds[location.id] = collectionNodeId;
  structure.locationImageMap[location.id] = {
    nodeIds: Object.values(imageNodeIds),
    prompts,
    aspectRatios,
    order: generationOrder,
  };
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
  const videoCopies = structure.videoCopies || 4;
  const videoNodeIds: string[] = [];
  const { duration, aspectRatio } = structure.videoSettings;

  // Texte du plan
  const textContent = `## Plan ${scene.sceneNumber}.${plan.planNumber}\n\n${plan.prompt}${plan.cameraMovement ? `\n\n📷 *${plan.cameraMovement}*` : ''}`;

  // 1. Nœud TEXT (prompt du plan)
  structure.textNodes.push({
    id: textNodeId,
    type: 'text',
    position: { x: startX, y: startY },
    data: {
      text: textContent,
      content: textToTiptapContent(textContent),
    },
    width: LAYOUT.TEXT_NODE_WIDTH,
  });

  // 2. Créer N nœuds VIDEO (copies)
  const videoStartX = startX + LAYOUT.TEXT_NODE_WIDTH + LAYOUT.NODE_GAP_X * 2;
  const videoGap = LAYOUT.VIDEO_NODE_WIDTH + LAYOUT.NODE_GAP_X;
  
  for (let copyIndex = 0; copyIndex < videoCopies; copyIndex++) {
    const videoNodeId = nodeId(`video-plan-${copyIndex + 1}`);
    videoNodeIds.push(videoNodeId);
    
    structure.videoNodes.push({
      id: videoNodeId,
      type: 'video',
      position: { 
        x: videoStartX + (copyIndex * videoGap), 
        y: startY 
      },
      data: {
        label: `Plan ${scene.sceneNumber}.${plan.planNumber} - Copie ${copyIndex + 1}`,
        instructions: plan.prompt,
        copyIndex: copyIndex + 1,
        totalCopies: videoCopies,
        duration,
        aspectRatio,
      },
      width: LAYOUT.VIDEO_NODE_WIDTH,
      height: LAYOUT.VIDEO_NODE_HEIGHT,
    });

    // 3. Edges pour chaque vidéo : collections → video + text (prompt) → video
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
      id: `edge-${textNodeId}-${videoNodeId}-${nanoid(4)}`,
      source: textNodeId,
      target: videoNodeId,
      type: 'default',
    });
  }

  // 4. Tracking (tableau de videoNodeIds)
  structure.planVideoMap[plan.id] = videoNodeIds;

  // Largeur totale : prompt + N vidéos
  const totalWidth = LAYOUT.TEXT_NODE_WIDTH + LAYOUT.NODE_GAP_X * 2 + (videoCopies * videoGap);
  return { width: totalWidth, height: LAYOUT.PLAN_HEIGHT };
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
  // IMPORTANT: La largeur dépend du nombre de copies vidéo
  const videoCopies = structure.videoCopies || 4;
  const videoGap = LAYOUT.VIDEO_NODE_WIDTH + LAYOUT.NODE_GAP_X;
  const planWidth = LAYOUT.TEXT_NODE_WIDTH + LAYOUT.NODE_GAP_X * 2 + (videoCopies * videoGap);
  
  const plansCount = scene.plans.length;
  const rows = Math.ceil(plansCount / LAYOUT.PLANS_PER_ROW);
  const contentHeight = rows * (LAYOUT.PLAN_HEIGHT + LAYOUT.NODE_GAP_Y);
  const sceneWidth = planWidth + LAYOUT.SCENE_PADDING * 2;
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

export interface GenerationConfig {
  videoCopies?: number;
  videoDuration?: number;
  videoAspectRatio?: string;
  testMode?: boolean;
}

export function generateCanvasFromProject(
  project: GeneratedProjectStructure,
  testMode: boolean = false,
  videoCopies: number = 4,
  config?: GenerationConfig
): GeneratedCanvasData {
  // Paramètres vidéo
  const videoDuration = config?.videoDuration || 10; // 10 secondes par défaut
  const videoAspectRatio = config?.videoAspectRatio || '16:9'; // 16:9 par défaut
  
  // TOUJOURS créer N copies vidéo (même en mode test)
  const effectiveVideoCopies = videoCopies;
  
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
    videoCopies: effectiveVideoCopies,
    videoSettings: {
      duration: videoDuration,
      aspectRatio: videoAspectRatio,
    },
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
    // Incluant l'ordre, les prompts enrichis et les aspect ratios
    characterImages: Object.entries(structure.characterImageMap).map(([charId, data]) => ({
      characterId: charId,
      imageNodeIds: data.nodeIds,
      prompts: data.prompts,
      aspectRatios: data.aspectRatios,
      order: data.order, // fullBody d'abord, puis les autres
    })),
    
    // Étape 2 : Images de lieux à générer
    locationImages: Object.entries(structure.locationImageMap).map(([locId, data]) => ({
      locationId: locId,
      imageNodeIds: data.nodeIds,
      prompts: data.prompts,
      aspectRatios: data.aspectRatios,
      order: data.order, // angle1 d'abord, puis les autres
    })),
    
    // Étape 3 : Collections à populer (après génération images)
    characterCollections: Object.entries(structure.characterCollectionIds),
    locationCollections: Object.entries(structure.locationCollectionIds),
    
    // Config vidéo
    videoCopies: structure.videoCopies || 4,
    videoSettings: structure.videoSettings,
    
    // Étape 4 : Vidéos à générer (après collections remplies)
    // Chaque plan a N nœuds vidéo (copies)
    videos: Object.entries(structure.planVideoMap).map(([planId, videoNodeIds]) => {
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
        videoNodeIds: videoNodeIds, // TABLEAU maintenant
        prompt: planInfo?.prompt || '',
        characterCollectionIds,
        locationCollectionId,
      };
    }),
  };
}
