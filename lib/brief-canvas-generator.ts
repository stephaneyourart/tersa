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
  GeneratedDecor,
  GeneratedLocation,
  GeneratedScene,
  GeneratedPlan,
} from '@/types/generated-project';
import { getSceneColor } from '@/types/generated-project';
import { IMAGE_RATIOS } from '@/lib/brief-defaults';

// ========== CONSTANTES DE LAYOUT - CANVAS INFINI, TRÈS ESPACÉ ==========
const LAYOUT = {
  // Marges générales - ÉNORME ESPACEMENT (canvas infini)
  MARGIN: 500,
  SECTION_GAP: 5000,         // Espace entre grandes sections (x50)
  VERTICAL_GAP: 3000,        // Espace vertical entre sections
  
  // Zone personnages/décors
  CHARACTER_ROW_HEIGHT: 2500, // Énorme espace entre personnages
  LOCATION_ROW_HEIGHT: 1500,  // Espace décors
  
  // Tailles des nœuds
  TEXT_NODE_WIDTH: 400,
  TEXT_NODE_HEIGHT: 300,
  IMAGE_NODE_WIDTH: 400,     // Plus grand
  IMAGE_NODE_HEIGHT_1_1: 400,
  IMAGE_NODE_HEIGHT_9_16: 710,  // 400 * 16/9
  IMAGE_NODE_HEIGHT_16_9: 225,  // 400 * 9/16
  IMAGE_NODE_HEIGHT_21_9: 171,  // 400 * 9/21
  COLLECTION_NODE_WIDTH: 500,
  COLLECTION_NODE_HEIGHT: 400,
  VIDEO_NODE_WIDTH: 600,
  VIDEO_NODE_HEIGHT: 500,
  
  // Espacement entre nœuds - ÉNORME
  NODE_GAP_X: 800,           // Énorme gap horizontal
  NODE_GAP_Y: 600,           // Énorme gap vertical
  
  // Dans une section
  ITEM_GAP: 400,             // Gap entre items dans une section
  
  // Sections rectangles
  SECTION_PADDING: 400,
  SECTION_BORDER_RADIUS: 48,
  
  // Labels géants
  GIANT_LABEL_FONT_SIZE: 124, // Taille demandée
  SCENE_TITLE_FONT_SIZE: 120,
  SECTION_LABEL_OFFSET_Y: -200, // Au-dessus du rectangle
  
  // Plans (FIRST/LAST frames)
  PLAN_ROW_HEIGHT: 1200,     // Hauteur d'une rangée de plan
  PLAN_GAP: 2000,            // Gap entre plans (augmenté)
  
  // Videos dans scènes
  VIDEO_ROW_HEIGHT: 800,
  VIDEO_GAP: 400,
  
  // Z-Index
  SHAPE_Z_INDEX: -1000,
  TITLE_Z_INDEX: -999,
};

// ========== CONSTANTES POUR LES PROMPTS ==========
// Les prompts sont maintenant dans brief-defaults.ts
// Ici on garde juste des suffixes de qualité
const QUALITY_SUFFIX = `, 8K, ultra detailed, sharp focus, professional photography`;

// ========== GÉNÉRATEUR D'IDS ==========
function nodeId(prefix: string): string {
  return `${prefix}-${nanoid(8)}`;
}

// ========== HELPER: Le prompt primaire est déjà complet, on ajoute juste la qualité ==========
function enrichPrimaryPrompt(originalPrompt: string): string {
  // Le prompt primaire est créé par l'IA et est déjà très détaillé
  // On ajoute juste le suffixe de qualité
  return `${originalPrompt}${QUALITY_SUFFIX}`;
}

// ========== HELPER: Les prompts de variantes sont fixes ==========
// Ces prompts sont utilisés tels quels pour générer les variantes depuis l'image primaire

// ========== STRUCTURE DE DONNÉES POUR TRACKING ==========
export interface ImageGenerationInfo {
  nodeIds: string[];
  prompts: Record<string, string>;
  aspectRatios: Record<string, string>;
  order: string[];
  // Nouveau : type de génération pour chaque image
  generationTypes?: Record<string, string>;  // 'text-to-image' | 'edit'
  // Nouveau : ID de l'image primaire (pour les variantes)
  primaryNodeId?: string;
}

// Info pour les images de plan (départ/fin)
export interface PlanImageInfo {
  planId: string;
  imageDepartNodeId: string;
  imageFinNodeId: string;
  promptDepart: string;
  promptFin: string;
  aspectRatio: string;  // 21:9
  characterRefs: string[];
  decorRef?: string;
}

export interface CanvasStructure {
  // IDs pour les connexions
  characterCollectionIds: Record<string, string>;
  locationCollectionIds: Record<string, string>;  // Alias pour decorCollectionIds
  decorCollectionIds?: Record<string, string>;    // Nouveau nom
  
  // Nœuds par catégorie (pour génération séquentielle)
  textNodes: Node[];
  imageNodes: Node[];
  collectionNodes: Node[];
  videoNodes: Node[];
  shapeNodes: Node[];
  labelNodes: Node[];
  
  // Edges
  edges: Edge[];
  
  // Métadonnées - avec ordre de génération et types
  characterImageMap: Record<string, ImageGenerationInfo>;
  locationImageMap: Record<string, ImageGenerationInfo>;  // Alias pour decorImageMap
  decorImageMap?: Record<string, ImageGenerationInfo>;    // Nouveau nom
  planVideoMap: Record<string, string[]>;       // planId -> videoNodeIds (TABLEAU pour les copies)
  planImageMap: Record<string, PlanImageInfo>;  // planId -> info images départ/fin
  
  // Config vidéos
  videoCopies: number;                          // Nombre de copies par plan
  videoSettings: { duration: number; aspectRatio: string }; // Paramètres vidéo
}

// ========== CRÉATION PERSONNAGE ==========
// Nouveau système : 1 image primaire (text-to-image) + 3 variantes (edit depuis primaire)
function createCharacterStructure(
  character: GeneratedCharacter,
  startX: number,
  startY: number,
  structure: CanvasStructure,
  testMode: boolean = false
): void {
  const textNodeId = nodeId('text-perso');
  const collectionNodeId = nodeId('collection-perso');
  
  // 4 images : primary (référence) + 3 variantes
  const imageNodeIds: Record<string, string> = {
    primary: nodeId('img-primary'),   // IMAGE PRIMAIRE (text-to-image)
    face: nodeId('img-face'),         // Variante 1 : visage de face (edit)
    profile: nodeId('img-profile'),   // Variante 2 : visage de profil (edit)
    back: nodeId('img-back'),         // Variante 3 : vue de dos (edit)
  };
  
  // Ordre de génération : primary d'abord (text-to-image), puis les 3 variantes EN PARALLÈLE (edit)
  const generationOrder = ['primary', 'face', 'profile', 'back'];

  // Texte descriptif
  const textContent = `# ${character.name}\n\n${character.description}\n\n**Code référence:** ${character.referenceCode}`;
  
  // 1. Nœud TEXT (description)
  structure.textNodes.push({
    id: textNodeId,
    type: 'text',
    position: { x: startX, y: startY },
    data: {
      generated: {
        text: textContent,
      },
      updatedAt: new Date().toISOString(),
    },
    width: LAYOUT.TEXT_NODE_WIDTH,
  });

  // 2. Nœuds IMAGE (1 primaire + 3 variantes)
  const imageY = startY;
  const imageStartX = startX + LAYOUT.TEXT_NODE_WIDTH + LAYOUT.NODE_GAP_X;
  
  // Utiliser les prompts du nouveau format (ou legacy si nécessaire)
  const primaryPrompt = character.prompts.primary || character.prompts.fullBody || '';
  
  const imageConfigs = [
    { 
      key: 'primary', 
      id: imageNodeIds.primary, 
      label: 'Primaire (Réf)', 
      prompt: enrichPrimaryPrompt(primaryPrompt), 
      x: 0, y: 0, 
      aspectRatio: IMAGE_RATIOS.character.primary, 
      isReference: true,
      generationType: 'text-to-image' // Généré par text-to-image
    },
    { 
      key: 'face', 
      id: imageNodeIds.face, 
      label: 'Visage face', 
      prompt: character.prompts.face, 
      x: 1, y: 0, 
      aspectRatio: IMAGE_RATIOS.character.face, 
      isReference: false,
      generationType: 'edit' // Généré par edit depuis primaire
    },
    { 
      key: 'profile', 
      id: imageNodeIds.profile, 
      label: 'Visage profil', 
      prompt: character.prompts.profile, 
      x: 0, y: 1, 
      aspectRatio: IMAGE_RATIOS.character.profile, 
      isReference: false,
      generationType: 'edit'
    },
    { 
      key: 'back', 
      id: imageNodeIds.back, 
      label: 'Vue de dos', 
      prompt: character.prompts.back, 
      x: 1, y: 1, 
      aspectRatio: IMAGE_RATIOS.character.back, 
      isReference: false,
      generationType: 'edit'
    },
  ];

  const prompts: Record<string, string> = {};
  const aspectRatios: Record<string, string> = {};
  const generationTypes: Record<string, string> = {};

  for (const config of imageConfigs) {
    prompts[config.key] = config.prompt;
    aspectRatios[config.key] = config.aspectRatio;
    generationTypes[config.key] = config.generationType;
    
    // Calculer la hauteur selon l'aspect ratio (personnages = 9:16 sauf face 1:1)
    const nodeHeight = config.aspectRatio === '1:1' 
      ? LAYOUT.IMAGE_NODE_HEIGHT_1_1 
      : LAYOUT.IMAGE_NODE_HEIGHT_9_16;
    
    structure.imageNodes.push({
      id: config.id,
      type: 'image',
      position: {
        // Utiliser la PLUS GRANDE hauteur possible pour le positionnement vertical
        x: imageStartX + config.x * (LAYOUT.IMAGE_NODE_WIDTH + LAYOUT.NODE_GAP_X),
        y: imageY + config.y * (LAYOUT.IMAGE_NODE_HEIGHT_9_16 + LAYOUT.NODE_GAP_Y),
      },
      data: {
        label: `${character.name} - ${config.label}`,
        instructions: config.prompt,
        aspectRatio: config.aspectRatio,
        isReference: config.isReference,
        characterId: character.id,
        viewType: config.key,
        generationType: config.generationType,
        // Pour les variantes, on référence l'image primaire
        referenceImageId: config.key !== 'primary' ? imageNodeIds.primary : undefined,
      },
      width: LAYOUT.IMAGE_NODE_WIDTH,
      height: nodeHeight,
    });
  }

  // 3. Nœud COLLECTION - positionné à droite des images
  const collectionX = imageStartX + 2 * (LAYOUT.IMAGE_NODE_WIDTH + LAYOUT.NODE_GAP_X) + LAYOUT.NODE_GAP_X;
  const collectionY = startY + LAYOUT.IMAGE_NODE_HEIGHT_9_16 / 2;
  
  structure.collectionNodes.push({
    id: collectionNodeId,
    type: 'collection',
    position: { x: collectionX, y: collectionY },
    data: {
      label: `Personnage ${character.name}`,
      items: [],
      headerColor: '#F6C744',
      collapsed: false,  // Ouvert par défaut
    },
    width: LAYOUT.COLLECTION_NODE_WIDTH,
  });

  // 4. Edges : Primaire → Variantes (les variantes DÉPENDENT de l'image primaire)
  const variantKeys = ['face', 'profile', 'back'];
  for (const key of variantKeys) {
    structure.edges.push({
      id: `edge-${imageNodeIds.primary}-${imageNodeIds[key]}`,
      source: imageNodeIds.primary,
      target: imageNodeIds[key],
      type: 'default',
    });
  }

  // 5. Edges : images → collection
  for (const imgId of Object.values(imageNodeIds)) {
    structure.edges.push({
      id: `edge-${imgId}-${collectionNodeId}`,
      source: imgId,
      target: collectionNodeId,
      type: 'default',
    });
  }

  // 6. Tracking avec info de génération
  structure.characterCollectionIds[character.id] = collectionNodeId;
  structure.characterImageMap[character.id] = {
    nodeIds: Object.values(imageNodeIds),
    prompts,
    aspectRatios,
    order: generationOrder,
    generationTypes, // Nouveau : type de génération pour chaque image
    primaryNodeId: imageNodeIds.primary, // Nouveau : ID de l'image primaire pour les variantes
  };
}

// ========== CRÉATION DÉCOR (anciennement LIEU) ==========
// Nouveau système : 1 image primaire (text-to-image) + 3 variantes (edit depuis primaire)
function createDecorStructure(
  decor: GeneratedDecor | GeneratedLocation,
  startX: number,
  startY: number,
  structure: CanvasStructure,
  testMode: boolean = false
): void {
  const textNodeId = nodeId('text-decor');
  const collectionNodeId = nodeId('collection-decor');
  
  // 4 images : primary (référence) + 3 variantes
  const imageNodeIds: Record<string, string> = {
    primary: nodeId('img-primary'),       // IMAGE PRIMAIRE (text-to-image)
    angle2: nodeId('img-angle2'),         // Variante 1 : nouvel angle (edit)
    plongee: nodeId('img-plongee'),       // Variante 2 : plongée (edit)
    contrePlongee: nodeId('img-contre'),  // Variante 3 : contre-plongée (edit)
  };
  
  // Ordre de génération : primary d'abord (text-to-image), puis les 3 variantes EN PARALLÈLE (edit)
  const generationOrder = ['primary', 'angle2', 'plongee', 'contrePlongee'];

  // Texte descriptif - adapter selon le format (nouveau décor ou ancien lieu)
  const textContent = `# ${decor.name}\n\n${decor.description}\n\n**Code référence:** ${decor.referenceCode}`;

  // 1. Nœud TEXT
  structure.textNodes.push({
    id: textNodeId,
    type: 'text',
    position: { x: startX, y: startY },
    data: {
      generated: {
        text: textContent,
      },
      updatedAt: new Date().toISOString(),
    },
    width: LAYOUT.TEXT_NODE_WIDTH,
  });

  // 2. Nœuds IMAGE (1 primaire + 3 variantes)
  const imageStartX = startX + LAYOUT.TEXT_NODE_WIDTH + LAYOUT.NODE_GAP_X;
  
  // Gérer les deux formats (nouveau avec prompts.primary ou ancien avec prompts.angle1)
  const decorPrompts = decor.prompts as any;
  const primaryPrompt = decorPrompts.primary || decorPrompts.angle1 || '';
  const angle2Prompt = decorPrompts.angle2 || "Propose un angle très différent et révélateur de ce décor, sans varier la hauteur et l'inclinaison de la caméra.";
  const plongeePrompt = decorPrompts.plongee || decorPrompts.angle3 || "Vue en plongée top down de ce décor, avec une assez courte focale pour avoir une vue d'ensemble de ce décor.";
  const contrePlongeePrompt = decorPrompts.contrePlongee || "Vue en forte contre plongée, caméra basse et inclinée vers le haut, avec une assez courte focale.";
  
  // Disposition 2x2 comme les personnages
  const imageConfigs = [
    { 
      key: 'primary', 
      id: imageNodeIds.primary, 
      label: 'Primaire (Réf)', 
      prompt: enrichPrimaryPrompt(primaryPrompt), 
      x: 0, y: 0,
      aspectRatio: IMAGE_RATIOS.decor.primary, 
      isReference: true,
      generationType: 'text-to-image'
    },
    { 
      key: 'angle2', 
      id: imageNodeIds.angle2, 
      label: 'Nouvel angle', 
      prompt: angle2Prompt, 
      x: 1, y: 0,
      aspectRatio: IMAGE_RATIOS.decor.angle2, 
      isReference: false,
      generationType: 'edit'
    },
    { 
      key: 'plongee', 
      id: imageNodeIds.plongee, 
      label: 'Plongée', 
      prompt: plongeePrompt, 
      x: 0, y: 1,
      aspectRatio: IMAGE_RATIOS.decor.plongee, 
      isReference: false,
      generationType: 'edit'
    },
    { 
      key: 'contrePlongee', 
      id: imageNodeIds.contrePlongee, 
      label: 'Contre-plongée', 
      prompt: contrePlongeePrompt, 
      x: 1, y: 1,
      aspectRatio: IMAGE_RATIOS.decor.contrePlongee, 
      isReference: false,
      generationType: 'edit'
    },
  ];

  const prompts: Record<string, string> = {};
  const aspectRatios: Record<string, string> = {};
  const generationTypes: Record<string, string> = {};

  for (const config of imageConfigs) {
    prompts[config.key] = config.prompt;
    aspectRatios[config.key] = config.aspectRatio;
    generationTypes[config.key] = config.generationType;
    
    // Décors = 16:9, disposition 2x2 comme les personnages
    structure.imageNodes.push({
      id: config.id,
      type: 'image',
      position: {
        x: imageStartX + config.x * (LAYOUT.IMAGE_NODE_WIDTH + LAYOUT.NODE_GAP_X),
        y: startY + config.y * (LAYOUT.IMAGE_NODE_HEIGHT_16_9 + LAYOUT.NODE_GAP_Y),
      },
      data: {
        label: `${decor.name} - ${config.label}`,
        instructions: config.prompt,
        aspectRatio: config.aspectRatio,
        isReference: config.isReference,
        decorId: decor.id,
        viewType: config.key,
        generationType: config.generationType,
        // Pour les variantes, on référence l'image primaire
        referenceImageId: config.key !== 'primary' ? imageNodeIds.primary : undefined,
      },
      width: LAYOUT.IMAGE_NODE_WIDTH,
      height: LAYOUT.IMAGE_NODE_HEIGHT_16_9,
    });
  }

  // 3. Nœud COLLECTION - positionné à droite de la grille 2x2 (comme personnages)
  const collectionX = imageStartX + 2 * (LAYOUT.IMAGE_NODE_WIDTH + LAYOUT.NODE_GAP_X) + LAYOUT.NODE_GAP_X;
  const collectionY = startY + LAYOUT.IMAGE_NODE_HEIGHT_16_9 / 2;
  
  structure.collectionNodes.push({
    id: collectionNodeId,
    type: 'collection',
    position: { x: collectionX, y: collectionY },
    data: {
      label: `Décor ${decor.name}`,
      items: [],
      headerColor: '#22c55e',
      collapsed: false,  // Ouvert par défaut
    },
    width: LAYOUT.COLLECTION_NODE_WIDTH,
  });

  // 4. Edges : Primaire → Variantes (les variantes DÉPENDENT de l'image primaire)
  const variantKeys = ['angle2', 'plongee', 'contrePlongee'];
  for (const key of variantKeys) {
    structure.edges.push({
      id: `edge-${imageNodeIds.primary}-${imageNodeIds[key]}`,
      source: imageNodeIds.primary,
      target: imageNodeIds[key],
      type: 'default',
    });
  }

  // 5. Edges : images → collection
  for (const imgId of Object.values(imageNodeIds)) {
    structure.edges.push({
      id: `edge-${imgId}-${collectionNodeId}`,
      source: imgId,
      target: collectionNodeId,
      type: 'default',
    });
  }

  // 6. Tracking avec info de génération
  // Garder la compatibilité avec locationCollectionIds et locationImageMap
  structure.locationCollectionIds[decor.id] = collectionNodeId;
  structure.locationImageMap[decor.id] = {
    nodeIds: Object.values(imageNodeIds),
    prompts,
    aspectRatios,
    order: generationOrder,
    generationTypes,
    primaryNodeId: imageNodeIds.primary,
  };
}

// Alias pour rétrocompatibilité
function createLocationStructure(
  location: GeneratedLocation,
  startX: number,
  startY: number,
  structure: CanvasStructure,
  testMode: boolean = false
): void {
  createDecorStructure(location, startX, startY, structure, testMode);
}

// ========== CRÉATION FRAMES (FIRST/LAST) POUR UN PLAN ==========
// Crée les prompts + images de first/last frame dans la section FRAMES
// Les vidéos sont créées séparément dans la section SCÈNES
function createPlanFramesStructure(
  plan: GeneratedPlan,
  scene: GeneratedScene,
  startX: number,
  startY: number,
  structure: CanvasStructure
): { 
  width: number; 
  height: number;
  textActionNodeId: string;
  imageDepartNodeId: string;
  imageFinNodeId: string;
} {
  const textActionNodeId = nodeId('text-action');
  const textFirstFrameNodeId = nodeId('text-first-frame');
  const textLastFrameNodeId = nodeId('text-last-frame');
  const imageDepartNodeId = nodeId('img-plan-depart');
  const imageFinNodeId = nodeId('img-plan-fin');

  // Ratio pour les images de plan (21:9 cinémascope)
  const planImageRatio = IMAGE_RATIOS.plan?.depart || '21:9';

  // Layout constants - TRÈS ESPACÉ
  const LABEL_OFFSET_Y = -200; // Plus haut pour éviter chevauchement
  const COL_GAP = LAYOUT.NODE_GAP_X;
  const ROW_GAP = LAYOUT.NODE_GAP_Y;

  // Prompts déduits
  const promptDepart = plan.promptImageDepart || `Début du plan : ${plan.prompt}`;
  const promptFin = plan.promptImageFin || `Fin du plan : ${plan.prompt}`;

  // ========== COLONNE 1 : PROMPT ACTION ==========
  const col1X = startX;
  const textContent = `## Plan ${scene.sceneNumber}.${plan.planNumber}\n\n**Action:** ${plan.prompt}${plan.cameraMovement ? `\n\n📷 *${plan.cameraMovement}*` : ''}`;

  structure.labelNodes.push({
    id: nodeId('label-prompt-action'),
    type: 'label',
    position: { x: col1X, y: startY + LABEL_OFFSET_Y },
    data: {
      text: 'PROMPT ACTION',
      fontSize: LAYOUT.GIANT_LABEL_FONT_SIZE,
      color: '#60a5fa',
    },
  });

  structure.textNodes.push({
    id: textActionNodeId,
    type: 'text',
    position: { x: col1X, y: startY },
    data: {
      generated: { text: textContent },
      updatedAt: new Date().toISOString(),
    },
    width: LAYOUT.TEXT_NODE_WIDTH,
  });

  // ========== COLONNE 2 : PROMPT FIRST + PROMPT LAST ==========
  const col2X = col1X + LAYOUT.TEXT_NODE_WIDTH + COL_GAP;

  // PROMPT FIRST FRAME
  structure.labelNodes.push({
    id: nodeId('label-prompt-first'),
    type: 'label',
    position: { x: col2X, y: startY + LABEL_OFFSET_Y },
    data: {
      text: 'PROMPT FIRST',
      fontSize: LAYOUT.GIANT_LABEL_FONT_SIZE,
      color: '#60a5fa',
    },
  });

  structure.textNodes.push({
    id: textFirstFrameNodeId,
    type: 'text',
    position: { x: col2X, y: startY },
    data: {
      generated: { text: `**First Frame:**\n${promptDepart}` },
      updatedAt: new Date().toISOString(),
    },
    width: LAYOUT.TEXT_NODE_WIDTH,
  });

  // PROMPT LAST FRAME (en dessous)
  const row2Y = startY + LAYOUT.TEXT_NODE_HEIGHT + ROW_GAP;

  structure.labelNodes.push({
    id: nodeId('label-prompt-last'),
    type: 'label',
    position: { x: col2X, y: row2Y + LABEL_OFFSET_Y },
    data: {
      text: 'PROMPT LAST',
      fontSize: LAYOUT.GIANT_LABEL_FONT_SIZE,
      color: '#60a5fa',
    },
  });

  structure.textNodes.push({
    id: textLastFrameNodeId,
    type: 'text',
    position: { x: col2X, y: row2Y },
    data: {
      generated: { text: `**Last Frame:**\n${promptFin}` },
      updatedAt: new Date().toISOString(),
    },
    width: LAYOUT.TEXT_NODE_WIDTH,
  });

  // ========== COLONNE 3 : FIRST FRAME + LAST FRAME ==========
  const col3X = col2X + LAYOUT.TEXT_NODE_WIDTH + COL_GAP;

  // FIRST FRAME IMAGE
  structure.labelNodes.push({
    id: nodeId('label-first-frame'),
    type: 'label',
    position: { x: col3X, y: startY + LABEL_OFFSET_Y },
    data: {
      text: 'FIRST FRAME',
      fontSize: LAYOUT.GIANT_LABEL_FONT_SIZE,
      color: '#60a5fa',
    },
  });
  
  structure.imageNodes.push({
    id: imageDepartNodeId,
    type: 'image',
    position: { x: col3X, y: startY },
    data: {
      label: `Plan ${scene.sceneNumber}.${plan.planNumber} - Départ`,
      instructions: promptDepart,
      aspectRatio: planImageRatio,
      isPlanImage: true,
      planId: plan.id,
      frameType: 'depart',
      generationType: 'edit',
      characterRefs: plan.characterRefs,
      decorRef: plan.decorRef || plan.locationRef,
    },
    width: LAYOUT.IMAGE_NODE_WIDTH,
    height: LAYOUT.IMAGE_NODE_HEIGHT_21_9,
  });

  // LAST FRAME IMAGE (en dessous)
  structure.labelNodes.push({
    id: nodeId('label-last-frame'),
    type: 'label',
    position: { x: col3X, y: row2Y + LABEL_OFFSET_Y },
    data: {
      text: 'LAST FRAME',
      fontSize: LAYOUT.GIANT_LABEL_FONT_SIZE,
      color: '#60a5fa',
    },
  });
  
  structure.imageNodes.push({
    id: imageFinNodeId,
    type: 'image',
    position: { x: col3X, y: row2Y },
    data: {
      label: `Plan ${scene.sceneNumber}.${plan.planNumber} - Fin`,
      instructions: promptFin,
      aspectRatio: planImageRatio,
      isPlanImage: true,
      planId: plan.id,
      frameType: 'fin',
      generationType: 'edit',
      characterRefs: plan.characterRefs,
      decorRef: plan.decorRef || plan.locationRef,
    },
    width: LAYOUT.IMAGE_NODE_WIDTH,
    height: LAYOUT.IMAGE_NODE_HEIGHT_21_9,
  });

  // ========== EDGES : Prompts → Images ==========
  structure.edges.push({
    id: `edge-${textFirstFrameNodeId}-${imageDepartNodeId}-${nanoid(4)}`,
    source: textFirstFrameNodeId,
    target: imageDepartNodeId,
    type: 'default',
  });

  structure.edges.push({
    id: `edge-${textLastFrameNodeId}-${imageFinNodeId}-${nanoid(4)}`,
    source: textLastFrameNodeId,
    target: imageFinNodeId,
    type: 'default',
  });

  // ========== EDGES : Collections → Images de plan ==========
  for (const charRef of plan.characterRefs) {
    const collectionId = structure.characterCollectionIds[charRef];
    if (collectionId) {
      structure.edges.push({
        id: `edge-${collectionId}-${imageDepartNodeId}-${nanoid(4)}`,
        source: collectionId,
        target: imageDepartNodeId,
        type: 'default',
      });
      structure.edges.push({
        id: `edge-${collectionId}-${imageFinNodeId}-${nanoid(4)}`,
        source: collectionId,
        target: imageFinNodeId,
        type: 'default',
      });
    }
  }

  const decorRef = plan.decorRef || plan.locationRef;
  if (decorRef) {
    const collectionId = structure.locationCollectionIds[decorRef];
    if (collectionId) {
      structure.edges.push({
        id: `edge-${collectionId}-${imageDepartNodeId}-${nanoid(4)}`,
        source: collectionId,
        target: imageDepartNodeId,
        type: 'default',
      });
      structure.edges.push({
        id: `edge-${collectionId}-${imageFinNodeId}-${nanoid(4)}`,
        source: collectionId,
        target: imageFinNodeId,
        type: 'default',
      });
    }
  }

  // ========== TRACKING ==========
  structure.planImageMap[plan.id] = {
    planId: plan.id,
    imageDepartNodeId,
    imageFinNodeId,
    promptDepart,
    promptFin,
    aspectRatio: planImageRatio,
    characterRefs: plan.characterRefs,
    decorRef: decorRef || undefined,
  };

  // Calcul dimensions
  const totalWidth = col3X - startX + LAYOUT.IMAGE_NODE_WIDTH;
  const totalHeight = row2Y - startY + LAYOUT.IMAGE_NODE_HEIGHT_21_9;
  
  return { 
    width: totalWidth, 
    height: totalHeight,
    textActionNodeId,
    imageDepartNodeId,
    imageFinNodeId,
  };
}

// ========== CRÉATION VIDÉOS POUR UN PLAN ==========
// Crée UNIQUEMENT les nœuds vidéo (dans la section SCÈNES)
function createPlanVideosStructure(
  plan: GeneratedPlan,
  scene: GeneratedScene,
  startX: number,
  startY: number,
  frameNodeIds: { textActionNodeId: string; imageDepartNodeId: string; imageFinNodeId: string },
  structure: CanvasStructure
): { width: number; height: number } {
  const videoCopies = structure.videoCopies || 4;
  const videoNodeIds: string[] = [];
  const { duration } = structure.videoSettings;
  
  const videoGap = LAYOUT.VIDEO_GAP;
  
  for (let copyIndex = 0; copyIndex < videoCopies; copyIndex++) {
    const videoId = nodeId(`video-plan-${copyIndex + 1}`);
    videoNodeIds.push(videoId);
    
    structure.videoNodes.push({
      id: videoId,
      type: 'video',
      position: { 
        x: startX + (copyIndex * (LAYOUT.VIDEO_NODE_WIDTH + videoGap)), 
        y: startY,
      },
      data: {
        label: `Plan ${scene.sceneNumber}.${plan.planNumber} - Copie ${copyIndex + 1}`,
        instructions: plan.prompt,
        copyIndex: copyIndex + 1,
        totalCopies: videoCopies,
        duration,
        model: 'kling-v2.6-pro-i2v',
        usesFirstLastFrame: true,
      },
      width: LAYOUT.VIDEO_NODE_WIDTH,
      height: LAYOUT.VIDEO_NODE_HEIGHT,
    });

    // Edges : Images + Prompt Action → Vidéo
    structure.edges.push({
      id: `edge-${frameNodeIds.imageDepartNodeId}-${videoId}-${nanoid(4)}`,
      source: frameNodeIds.imageDepartNodeId,
      target: videoId,
      type: 'default',
    });

    structure.edges.push({
      id: `edge-${frameNodeIds.imageFinNodeId}-${videoId}-${nanoid(4)}`,
      source: frameNodeIds.imageFinNodeId,
      target: videoId,
      type: 'default',
    });

    structure.edges.push({
      id: `edge-${frameNodeIds.textActionNodeId}-${videoId}-${nanoid(4)}`,
      source: frameNodeIds.textActionNodeId,
      target: videoId,
      type: 'default',
    });
  }

  structure.planVideoMap[plan.id] = videoNodeIds;

  const totalWidth = videoCopies * (LAYOUT.VIDEO_NODE_WIDTH + videoGap) - videoGap;
  const totalHeight = LAYOUT.VIDEO_NODE_HEIGHT;
  
  return { width: totalWidth, height: totalHeight };
}

// ========== CRÉATION SCÈNE (VIDÉOS UNIQUEMENT) ==========
// Cette fonction crée le rectangle de scène avec UNIQUEMENT les nœuds vidéo
// Les frames sont créés séparément dans la section FIRST AND LAST FRAMES
function createSceneStructure(
  scene: GeneratedScene,
  startX: number,
  startY: number,
  frameNodeIdsMap: Map<string, { textActionNodeId: string; imageDepartNodeId: string; imageFinNodeId: string }>,
  structure: CanvasStructure
): { width: number; height: number } {
  const shapeNodeId = nodeId('shape-scene');
  const labelNodeId = nodeId('label-scene');

  // Calculer les dimensions de la scène (UNIQUEMENT vidéos)
  const videoCopies = structure.videoCopies || 4;
  const videoRowWidth = videoCopies * (LAYOUT.VIDEO_NODE_WIDTH + LAYOUT.VIDEO_GAP) - LAYOUT.VIDEO_GAP;
  
  const plansCount = scene.plans.length;
  const contentHeight = plansCount * (LAYOUT.VIDEO_NODE_HEIGHT + LAYOUT.NODE_GAP_Y);
  const sceneWidth = videoRowWidth + LAYOUT.SECTION_PADDING * 2;
  const sceneHeight = 250 + contentHeight + LAYOUT.SECTION_PADDING * 2; // 250 pour le titre

  // 1. Shape de fond
  structure.shapeNodes.push({
    id: shapeNodeId,
    type: 'shape',
    position: { x: startX, y: startY },
    data: {
      color: scene.color,
      opacity: 12,
      borderRadius: LAYOUT.SECTION_BORDER_RADIUS,
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
      x: startX + LAYOUT.SECTION_PADDING,
      y: startY + 50,
    },
    data: {
      text: `SCÈNE ${scene.sceneNumber}: ${scene.title.toUpperCase()}`,
      fontSize: LAYOUT.SCENE_TITLE_FONT_SIZE,
      color: scene.color,
    },
    zIndex: LAYOUT.TITLE_Z_INDEX,
  });

  // 3. Vidéos UNIQUEMENT (les frames sont ailleurs)
  let planY = startY + 250 + LAYOUT.SECTION_PADDING;
  
  for (const plan of scene.plans) {
    const frameIds = frameNodeIdsMap.get(plan.id);
    if (frameIds) {
      createPlanVideosStructure(
        plan,
        scene,
        startX + LAYOUT.SECTION_PADDING,
        planY,
        frameIds,
        structure
      );
    }
    planY += LAYOUT.VIDEO_NODE_HEIGHT + LAYOUT.NODE_GAP_Y;
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
  const videoDuration = config?.videoDuration || 10;
  const videoAspectRatio = config?.videoAspectRatio || '16:9';
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
    planImageMap: {},
    videoCopies: effectiveVideoCopies,
    videoSettings: {
      duration: videoDuration,
      aspectRatio: videoAspectRatio,
    },
  };

  // Couleurs des sections
  const SECTION_COLORS = {
    primaryImages: '#F6C744',    // Jaune doré
    frames: '#60a5fa',           // Bleu
    scenes: '#22c55e',           // Vert
  };

  // ================================================================================
  // SECTION 1 : IMAGES PRIMAIRES ET SECONDAIRES (tout à gauche)
  // Contient : Personnages + Décors avec leurs collections
  // ================================================================================
  
  let section1StartX = LAYOUT.MARGIN;
  let section1StartY = LAYOUT.MARGIN;
  let section1ContentY = section1StartY + 200; // Après le label géant
  let section1MaxX = section1StartX;
  let section1MaxY = section1ContentY;

  // Label géant de section
  structure.labelNodes.push({
    id: nodeId('label-section-primary'),
    type: 'label',
    position: { x: section1StartX, y: section1StartY },
    data: {
      text: '🖼️ IMAGES PRIMAIRES ET SECONDAIRES',
      fontSize: LAYOUT.GIANT_LABEL_FONT_SIZE,
      color: SECTION_COLORS.primaryImages,
    },
  });

  // Personnages
  if (project.characters.length > 0) {
    structure.labelNodes.push({
      id: nodeId('label-personnages'),
      type: 'label',
      position: { x: section1StartX, y: section1ContentY },
      data: {
        text: '👤 PERSONNAGES',
        fontSize: 72,
        color: SECTION_COLORS.primaryImages,
      },
    });
    section1ContentY += 120;

    for (const character of project.characters) {
      createCharacterStructure(character, section1StartX, section1ContentY, structure, testMode);
      section1ContentY += LAYOUT.CHARACTER_ROW_HEIGHT;
    }
  }

  // Décors
  const decors = project.decors || project.locations || [];
  if (decors.length > 0) {
    section1ContentY += LAYOUT.VERTICAL_GAP / 2;

    structure.labelNodes.push({
      id: nodeId('label-decors'),
      type: 'label',
      position: { x: section1StartX, y: section1ContentY },
      data: {
        text: '🎬 DÉCORS',
        fontSize: 72,
        color: SECTION_COLORS.primaryImages,
      },
    });
    section1ContentY += 120;

    for (const decor of decors) {
      createDecorStructure(decor, section1StartX, section1ContentY, structure, testMode);
      section1ContentY += LAYOUT.LOCATION_ROW_HEIGHT;
    }
  }

  // Calcul taille section 1
  section1MaxY = section1ContentY;
  // Estimer la largeur basée sur le nombre d'images (4) + collection + marge
  section1MaxX = section1StartX + (4 * (LAYOUT.IMAGE_NODE_WIDTH + LAYOUT.NODE_GAP_X)) + LAYOUT.COLLECTION_NODE_WIDTH + LAYOUT.SECTION_PADDING;

  // Rectangle de fond section 1
  const section1Width = section1MaxX - section1StartX + LAYOUT.SECTION_PADDING;
  const section1Height = section1MaxY - section1StartY + LAYOUT.SECTION_PADDING;
  
  structure.shapeNodes.push({
    id: nodeId('shape-section-primary'),
    type: 'shape',
    position: { x: section1StartX - LAYOUT.SECTION_PADDING/2, y: section1StartY - LAYOUT.SECTION_PADDING/2 },
    data: {
      color: SECTION_COLORS.primaryImages,
      opacity: 5,
      borderRadius: LAYOUT.SECTION_BORDER_RADIUS,
    },
    style: {
      width: section1Width,
      height: section1Height,
    },
    zIndex: LAYOUT.SHAPE_Z_INDEX,
  });

  // ================================================================================
  // SECTION 2 : FIRST AND LAST FRAMES (au milieu)
  // Contient : Prompts action + Prompts first/last + Images first/last
  // ================================================================================
  
  const section2StartX = section1StartX + section1Width + LAYOUT.SECTION_GAP;
  let section2StartY = LAYOUT.MARGIN;
  let section2ContentY = section2StartY + 200;
  let section2MaxX = section2StartX;
  let section2MaxY = section2ContentY;

  // Map pour stocker les IDs des frames par plan (pour les connecter aux vidéos)
  const frameNodeIdsMap = new Map<string, { 
    textActionNodeId: string; 
    imageDepartNodeId: string; 
    imageFinNodeId: string; 
  }>();

  // Label géant de section
  structure.labelNodes.push({
    id: nodeId('label-section-frames'),
    type: 'label',
    position: { x: section2StartX, y: section2StartY },
    data: {
      text: '🎬 FIRST AND LAST FRAMES',
      fontSize: LAYOUT.GIANT_LABEL_FONT_SIZE,
      color: SECTION_COLORS.frames,
    },
  });

  // GRAND ESPACE après le label géant
  section2ContentY = section2StartY + 400;

  // Créer les frames pour chaque scène/plan
  for (let i = 0; i < project.scenes.length; i++) {
    const scene = project.scenes[i];
    scene.color = getSceneColor(i);

    // Label de scène dans la section frames
    structure.labelNodes.push({
      id: nodeId(`label-frames-scene-${i}`),
      type: 'label',
      position: { x: section2StartX, y: section2ContentY },
      data: {
        text: `SCÈNE ${scene.sceneNumber}: ${scene.title.toUpperCase()}`,
        fontSize: 72,
        color: SECTION_COLORS.frames,
      },
    });
    section2ContentY += 200; // Plus d'espace après le label de scène

    // Frames de chaque plan
    for (const plan of scene.plans) {
      const result = createPlanFramesStructure(
        plan,
        scene,
        section2StartX,
        section2ContentY,
        structure
      );
      
      frameNodeIdsMap.set(plan.id, {
        textActionNodeId: result.textActionNodeId,
        imageDepartNodeId: result.imageDepartNodeId,
        imageFinNodeId: result.imageFinNodeId,
      });
      
      section2ContentY += result.height + LAYOUT.PLAN_GAP;
      section2MaxX = Math.max(section2MaxX, section2StartX + result.width);
    }

    section2ContentY += LAYOUT.VERTICAL_GAP / 2;
  }

  section2MaxY = section2ContentY;

  // Rectangle de fond section 2
  const section2Width = section2MaxX - section2StartX + LAYOUT.SECTION_PADDING * 2;
  const section2Height = section2MaxY - section2StartY + LAYOUT.SECTION_PADDING;
  
  structure.shapeNodes.push({
    id: nodeId('shape-section-frames'),
    type: 'shape',
    position: { x: section2StartX - LAYOUT.SECTION_PADDING/2, y: section2StartY - LAYOUT.SECTION_PADDING/2 },
    data: {
      color: SECTION_COLORS.frames,
      opacity: 5,
      borderRadius: LAYOUT.SECTION_BORDER_RADIUS,
    },
    style: {
      width: section2Width,
      height: section2Height,
    },
    zIndex: LAYOUT.SHAPE_Z_INDEX,
  });

  // ================================================================================
  // SECTION 3 : SCÈNES - VIDÉOS UNIQUEMENT (à droite)
  // Contient : Uniquement les nœuds vidéo
  // ================================================================================
  
  const section3StartX = section2StartX + section2Width + LAYOUT.SECTION_GAP;
  let section3StartY = LAYOUT.MARGIN;

  // Label géant de section
  structure.labelNodes.push({
    id: nodeId('label-section-scenes'),
    type: 'label',
    position: { x: section3StartX, y: section3StartY },
    data: {
      text: '🎥 SCÈNES - VIDÉOS',
      fontSize: LAYOUT.GIANT_LABEL_FONT_SIZE,
      color: SECTION_COLORS.scenes,
    },
  });

  let sceneY = section3StartY + 200;

  for (let i = 0; i < project.scenes.length; i++) {
    const scene = project.scenes[i];
    scene.color = getSceneColor(i);

    const { height } = createSceneStructure(
      scene,
      section3StartX,
      sceneY,
      frameNodeIdsMap,
      structure
    );

    sceneY += height + LAYOUT.NODE_GAP_Y * 2;
  }

  // ========== ASSEMBLER LES NŒUDS ==========
  const allNodes: Node[] = [
    ...structure.shapeNodes,
    ...structure.labelNodes,
    ...structure.textNodes,
    ...structure.imageNodes,
    ...structure.collectionNodes,
    ...structure.videoNodes,
  ];

  return {
    nodes: allNodes,
    edges: structure.edges,
    viewport: { x: 50, y: 50, zoom: 0.15 }, // Zoom arrière pour voir l'ensemble
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
  const plansMap = new Map<string, { 
    prompt: string; 
    promptImageDepart?: string;
    promptImageFin?: string;
    characterRefs: string[]; 
    decorRef?: string; 
    locationRef?: string;
  }>();
  
  if (project) {
    for (const scene of project.scenes) {
      for (const plan of scene.plans) {
        plansMap.set(plan.id, {
          prompt: plan.prompt,
          promptImageDepart: plan.promptImageDepart,
          promptImageFin: plan.promptImageFin,
          characterRefs: plan.characterRefs || [],
          decorRef: plan.decorRef || plan.locationRef || undefined,
          locationRef: plan.locationRef || plan.decorRef || undefined, // Alias
        });
      }
    }
  }

  return {
    // Étape 1 : Images de personnages à générer
    // NOUVEAU FORMAT : primary d'abord (text-to-image), puis les variantes EN PARALLÈLE (edit)
    characterImages: Object.entries(structure.characterImageMap).map(([charId, data]) => ({
      characterId: charId,
      imageNodeIds: data.nodeIds,
      prompts: data.prompts,
      aspectRatios: data.aspectRatios,
      order: data.order, // ['primary', 'face', 'profile', 'back']
      generationTypes: data.generationTypes || {}, // 'text-to-image' ou 'edit'
      primaryNodeId: data.primaryNodeId, // ID de l'image primaire pour les variantes
    })),
    
    // Étape 2 : Images de décors à générer
    // NOUVEAU FORMAT : primary d'abord (text-to-image), puis les variantes EN PARALLÈLE (edit)
    decorImages: Object.entries(structure.locationImageMap).map(([decorId, data]) => ({
      decorId: decorId,
      imageNodeIds: data.nodeIds,
      prompts: data.prompts,
      aspectRatios: data.aspectRatios,
      order: data.order, // ['primary', 'angle2', 'plongee', 'contrePlongee']
      generationTypes: data.generationTypes || {},
      primaryNodeId: data.primaryNodeId,
    })),
    
    // Alias pour rétrocompatibilité
    locationImages: Object.entries(structure.locationImageMap).map(([locId, data]) => ({
      locationId: locId,
      imageNodeIds: data.nodeIds,
      prompts: data.prompts,
      aspectRatios: data.aspectRatios,
      order: data.order,
      generationTypes: data.generationTypes || {},
      primaryNodeId: data.primaryNodeId,
    })),
    
    // Étape 3 : Collections à populer (après génération images)
    characterCollections: Object.entries(structure.characterCollectionIds),
    decorCollections: Object.entries(structure.locationCollectionIds),
    locationCollections: Object.entries(structure.locationCollectionIds), // Alias
    
    // Config vidéo
    videoCopies: structure.videoCopies || 4,
    videoSettings: structure.videoSettings,
    
    // NOUVEAU - Étape 4 : Images de plan (départ/fin) à générer
    // Ces images sont générées par EDIT à partir des collections
    // Elles doivent être générées APRÈS que les collections soient remplies
    planImages: Object.entries(structure.planImageMap).map(([planId, info]) => {
      // Résoudre les IDs de collections pour les images de plan
      const characterCollectionIds: string[] = [];
      for (const charRef of info.characterRefs) {
        const collectionId = structure.characterCollectionIds[charRef];
        if (collectionId) {
          characterCollectionIds.push(collectionId);
        }
      }
      
      let decorCollectionId: string | undefined;
      if (info.decorRef) {
        decorCollectionId = structure.locationCollectionIds[info.decorRef];
      }

      return {
        planId,
        imageDepartNodeId: info.imageDepartNodeId,
        imageFinNodeId: info.imageFinNodeId,
        promptDepart: info.promptDepart,
        promptFin: info.promptFin,
        aspectRatio: info.aspectRatio, // 21:9
        characterCollectionIds,
        decorCollectionId,
      };
    }),
    
    // Étape 5 : Vidéos à générer (NOUVEAU WORKFLOW)
    // Les vidéos attendent que leurs images de plan (départ/fin) soient prêtes
    // Elles utilisent first frame (départ) + last frame (fin) + prompt action
    videos: Object.entries(structure.planVideoMap).map(([planId, videoNodeIds]) => {
      const planInfo = plansMap.get(planId);
      const planImageInfo = structure.planImageMap[planId];
      
      // Résoudre les IDs de collections depuis les références (pour référence)
      const characterCollectionIds: string[] = [];
      if (planInfo?.characterRefs) {
        for (const charRef of planInfo.characterRefs) {
          const collectionId = structure.characterCollectionIds[charRef];
          if (collectionId) {
            characterCollectionIds.push(collectionId);
          }
        }
      }
      
      let decorCollectionId: string | undefined;
      const decorRef = planInfo?.decorRef || planInfo?.locationRef;
      if (decorRef) {
        decorCollectionId = structure.locationCollectionIds[decorRef];
      }

      return {
        planId,
        videoNodeIds: videoNodeIds, // TABLEAU pour les copies
        prompt: planInfo?.prompt || '',
        // NOUVEAU : IDs des images de plan pour first/last frame
        imageDepartNodeId: planImageInfo?.imageDepartNodeId,
        imageFinNodeId: planImageInfo?.imageFinNodeId,
        // Garder les collections pour référence (même si on utilise les images de plan)
        characterCollectionIds,
        decorCollectionId,
        locationCollectionId: decorCollectionId, // Alias
        // Flag pour le nouveau workflow
        usesFirstLastFrame: true,
      };
    }),
  };
}
