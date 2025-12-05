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
import type { FrameMode } from '@/lib/creative-plan-settings';

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

// Info pour UN couple d'images de plan (départ/fin)
export interface PlanCoupleInfo {
  coupleIndex: number;  // Index du couple (0, 1, 2, ...)
  imageDepartNodeId: string;
  imageFinNodeId: string;
  promptDepart: string;
  promptFin: string;
  aspectRatio: string;  // 21:9
  videoNodeIds: string[];  // IDs des vidéos générées pour ce couple
}

// Info pour les images de plan (départ/fin) - NOUVEAU: supporte N couples
export interface PlanImageInfo {
  planId: string;
  couples: PlanCoupleInfo[];  // N couples par plan
  characterRefs: string[];
  decorRef?: string;
  // Rétrocompatibilité : premier couple
  imageDepartNodeId: string;
  imageFinNodeId: string;
  promptDepart: string;
  promptFin: string;
  aspectRatio: string;  // 21:9
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
  
  // Config vidéos - NOUVEAU: N couples × M vidéos
  couplesPerPlan: number;                       // N = Nombre de couples (first/last) par plan
  videosPerCouple: number;                      // M = Nombre de vidéos par couple
  videoCopies?: number;                         // DEPRECATED: utiliser couplesPerPlan × videosPerCouple
  videoSettings: { duration: number; aspectRatio: string }; // Paramètres vidéo
  
  // Mode frame: 'first-last' (2 images) ou 'first-only' (1 image)
  frameMode: FrameMode;
}

// ========== CRÉATION PERSONNAGE ==========
// Nouveau système : 1 image primaire (text-to-image) + 3 variantes (edit depuis primaire)
// Layout: [Narratif] --- [Prompt Primary] → [Image Primary] → [Variantes] → [Collection]
function createCharacterStructure(
  character: GeneratedCharacter,
  startX: number,
  startY: number,
  structure: CanvasStructure,
  testMode: boolean = false
): void {
  const textNarrativeNodeId = nodeId('text-narratif');
  const textPromptNodeId = nodeId('text-prompt');  // NOUVEAU: nœud prompt éditable
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

  // Texte narratif (description du personnage - informatif uniquement)
  const narrativeContent = `# ${character.name}\n\n${character.description}\n\n**Code référence:** ${character.referenceCode}`;
  
  // 1. Nœud TEXT NARRATIF (à gauche, NON connecté - purement informatif)
  structure.textNodes.push({
    id: textNarrativeNodeId,
    type: 'text',
    position: { x: startX, y: startY },
    data: {
      generated: {
        text: narrativeContent,
      },
      updatedAt: new Date().toISOString(),
    },
    width: LAYOUT.TEXT_NODE_WIDTH,
  });

  // Utiliser les prompts du nouveau format (ou legacy si nécessaire)
  const primaryPrompt = character.prompts.primary || character.prompts.fullBody || '';
  
  // 2. Nœud TEXT PROMPT (le VRAI prompt de génération - connecté à l'image primaire)
  const promptNodeX = startX + LAYOUT.TEXT_NODE_WIDTH + LAYOUT.NODE_GAP_X;
  structure.textNodes.push({
    id: textPromptNodeId,
    type: 'text',
    position: { x: promptNodeX, y: startY },
    data: {
      generated: {
        text: `**Prompt génération ${character.name}:**\n\n${primaryPrompt}`,
      },
      // instructions vide - l'utilisateur peut demander des modifications
      updatedAt: new Date().toISOString(),
      isPromptNode: true,  // Flag pour identifier ce type de nœud
      characterId: character.id,
    },
    width: LAYOUT.TEXT_NODE_WIDTH,
  });

  // 3. Nœuds IMAGE (1 primaire + 3 variantes) - décalés pour laisser place au prompt
  const imageY = startY;
  const imageStartX = promptNodeX + LAYOUT.TEXT_NODE_WIDTH + LAYOUT.NODE_GAP_X;
  
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

  // 4. Nœud COLLECTION - positionné à droite des images
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

  // 5. Edge : Prompt → Image Primaire (permet de regénérer avec le prompt édité)
  structure.edges.push({
    id: `edge-${textPromptNodeId}-${imageNodeIds.primary}`,
    source: textPromptNodeId,
    target: imageNodeIds.primary,
    type: 'default',
  });

  // 6. Edges : Primaire → Variantes (les variantes DÉPENDENT de l'image primaire)
  const variantKeys = ['face', 'profile', 'back'];
  for (const key of variantKeys) {
    structure.edges.push({
      id: `edge-${imageNodeIds.primary}-${imageNodeIds[key]}`,
      source: imageNodeIds.primary,
      target: imageNodeIds[key],
      type: 'default',
    });
  }

  // 7. Edges : images → collection
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
// Layout: [Narratif] --- [Prompt Primary] → [Image Primary] → [Variantes] → [Collection]
function createDecorStructure(
  decor: GeneratedDecor | GeneratedLocation,
  startX: number,
  startY: number,
  structure: CanvasStructure,
  testMode: boolean = false
): void {
  const textNarrativeNodeId = nodeId('text-narratif-decor');
  const textPromptNodeId = nodeId('text-prompt-decor');  // NOUVEAU: nœud prompt éditable
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

  // Texte narratif - adapter selon le format (nouveau décor ou ancien lieu)
  const narrativeContent = `# ${decor.name}\n\n${decor.description}\n\n**Code référence:** ${decor.referenceCode}`;

  // 1. Nœud TEXT NARRATIF (à gauche, NON connecté - purement informatif)
  structure.textNodes.push({
    id: textNarrativeNodeId,
    type: 'text',
    position: { x: startX, y: startY },
    data: {
      generated: {
        text: narrativeContent,
      },
      updatedAt: new Date().toISOString(),
    },
    width: LAYOUT.TEXT_NODE_WIDTH,
  });

  // Gérer les deux formats (nouveau avec prompts.primary ou ancien avec prompts.angle1)
  const decorPrompts = decor.prompts as any;
  const primaryPrompt = decorPrompts.primary || decorPrompts.angle1 || '';
  const angle2Prompt = decorPrompts.angle2 || "Propose un angle très différent et révélateur de ce décor, sans varier la hauteur et l'inclinaison de la caméra.";
  const plongeePrompt = decorPrompts.plongee || decorPrompts.angle3 || "Vue en plongée top down de ce décor, avec une assez courte focale pour avoir une vue d'ensemble de ce décor.";
  const contrePlongeePrompt = decorPrompts.contrePlongee || "Vue en forte contre plongée, caméra basse et inclinée vers le haut, avec une assez courte focale.";

  // 2. Nœud TEXT PROMPT (le VRAI prompt de génération - connecté à l'image primaire)
  const promptNodeX = startX + LAYOUT.TEXT_NODE_WIDTH + LAYOUT.NODE_GAP_X;
  structure.textNodes.push({
    id: textPromptNodeId,
    type: 'text',
    position: { x: promptNodeX, y: startY },
    data: {
      generated: {
        text: `**Prompt génération ${decor.name}:**\n\n${primaryPrompt}`,
      },
      // instructions vide - l'utilisateur peut demander des modifications
      updatedAt: new Date().toISOString(),
      isPromptNode: true,  // Flag pour identifier ce type de nœud
      decorId: decor.id,
    },
    width: LAYOUT.TEXT_NODE_WIDTH,
  });

  // 3. Nœuds IMAGE (1 primaire + 3 variantes) - décalés pour laisser place au prompt
  const imageStartX = promptNodeX + LAYOUT.TEXT_NODE_WIDTH + LAYOUT.NODE_GAP_X;
  
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

  // 4. Nœud COLLECTION - positionné à droite de la grille 2x2 (comme personnages)
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

  // 5. Edge : Prompt → Image Primaire (permet de regénérer avec le prompt édité)
  structure.edges.push({
    id: `edge-${textPromptNodeId}-${imageNodeIds.primary}`,
    source: textPromptNodeId,
    target: imageNodeIds.primary,
    type: 'default',
  });

  // 6. Edges : Primaire → Variantes (les variantes DÉPENDENT de l'image primaire)
  const variantKeys = ['angle2', 'plongee', 'contrePlongee'];
  for (const key of variantKeys) {
    structure.edges.push({
      id: `edge-${imageNodeIds.primary}-${imageNodeIds[key]}`,
      source: imageNodeIds.primary,
      target: imageNodeIds[key],
      type: 'default',
    });
  }

  // 7. Edges : images → collection
  for (const imgId of Object.values(imageNodeIds)) {
    structure.edges.push({
      id: `edge-${imgId}-${collectionNodeId}`,
      source: imgId,
      target: collectionNodeId,
      type: 'default',
    });
  }

  // 8. Tracking avec info de génération
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
// Crée les prompts + N couples d'images de first/last frame dans la section FRAMES
// Les vidéos sont créées séparément dans la section SCÈNES
// NOUVEAU: Supporte N couples par plan pour plus de variété de mises en scène
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
  couples: { coupleIndex: number; imageDepartNodeId: string; imageFinNodeId: string }[];
  // Rétrocompatibilité
  imageDepartNodeId: string;
  imageFinNodeId: string;
} {
  const textActionNodeId = nodeId('text-action');
  const textFirstFrameNodeId = nodeId('text-first-frame');
  const textLastFrameNodeId = nodeId('text-last-frame');

  // N = Nombre de couples par plan
  const couplesPerPlan = structure.couplesPerPlan || 1;
  
  // Mode frame: first-last ou first-only
  const frameMode = structure.frameMode || 'first-last';
  const isFirstOnly = frameMode === 'first-only';

  // Ratio pour les images de plan (21:9 cinémascope)
  const planImageRatio = IMAGE_RATIOS.plan?.depart || '21:9';

  // Layout constants - TRÈS ESPACÉ
  const LABEL_OFFSET_Y = -200; // Plus haut pour éviter chevauchement
  const COL_GAP = LAYOUT.NODE_GAP_X;
  const ROW_GAP = LAYOUT.NODE_GAP_Y;
  const COUPLE_GAP = 300; // Gap entre les couples

  // Prompts déduits
  const promptDepart = plan.promptImageDepart || `Début du plan : ${plan.prompt}`;
  const promptFin = isFirstOnly ? '' : (plan.promptImageFin || `Fin du plan : ${plan.prompt}`);

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

  // PROMPT LAST FRAME (en dessous) - UNIQUEMENT en mode first-last
  const row2Y = startY + LAYOUT.TEXT_NODE_HEIGHT + ROW_GAP;

  if (!isFirstOnly) {
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
  }

  // ========== COLONNES 3+ : N COUPLES DE FRAMES (FIRST + LAST) ==========
  const col3StartX = col2X + LAYOUT.TEXT_NODE_WIDTH + COL_GAP;
  
  const couples: { coupleIndex: number; imageDepartNodeId: string; imageFinNodeId: string }[] = [];
  const planCouples: PlanCoupleInfo[] = [];

  for (let coupleIdx = 0; coupleIdx < couplesPerPlan; coupleIdx++) {
    const coupleX = col3StartX + coupleIdx * (LAYOUT.IMAGE_NODE_WIDTH + COUPLE_GAP);
    const imageDepartNodeId = nodeId(`img-plan-depart-${coupleIdx}`);
    const imageFinNodeId = nodeId(`img-plan-fin-${coupleIdx}`);
    
    // Variante du prompt pour différentes mises en scène (sauf premier couple = prompt original)
    const couplePromptSuffix = coupleIdx > 0 
      ? ` [Variante ${coupleIdx + 1}: mise en scène alternative]` 
      : '';
    const couplePromptDepart = promptDepart + couplePromptSuffix;
    const couplePromptFin = promptFin + couplePromptSuffix;
    
    couples.push({ coupleIndex: coupleIdx, imageDepartNodeId, imageFinNodeId });

    // Label COUPLE si plusieurs couples
    if (couplesPerPlan > 1) {
      structure.labelNodes.push({
        id: nodeId(`label-couple-${coupleIdx}`),
        type: 'label',
        position: { x: coupleX, y: startY + LABEL_OFFSET_Y - 60 },
        data: {
          text: `COUPLE ${coupleIdx + 1}`,
          fontSize: 48,
          color: coupleIdx === 0 ? '#60a5fa' : '#a78bfa', // Premier en bleu, autres en violet
        },
      });
    }

    // FIRST FRAME IMAGE
    structure.labelNodes.push({
      id: nodeId(`label-first-frame-${coupleIdx}`),
      type: 'label',
      position: { x: coupleX, y: startY + LABEL_OFFSET_Y },
      data: {
        text: couplesPerPlan > 1 ? 'FIRST' : 'FIRST FRAME',
        fontSize: couplesPerPlan > 1 ? 72 : LAYOUT.GIANT_LABEL_FONT_SIZE,
        color: '#60a5fa',
      },
    });
    
    structure.imageNodes.push({
      id: imageDepartNodeId,
      type: 'image',
      position: { x: coupleX, y: startY },
      data: {
        label: `Plan ${scene.sceneNumber}.${plan.planNumber} - Départ${couplesPerPlan > 1 ? ` (C${coupleIdx + 1})` : ''}`,
        instructions: couplePromptDepart,
        aspectRatio: planImageRatio,
        isPlanImage: true,
        planId: plan.id,
        frameType: 'depart',
        coupleIndex: coupleIdx,
        generationType: 'edit',
        characterRefs: plan.characterRefs,
        decorRef: plan.decorRef || plan.locationRef,
      },
      width: LAYOUT.IMAGE_NODE_WIDTH,
      height: LAYOUT.IMAGE_NODE_HEIGHT_21_9,
    });

    // LAST FRAME IMAGE (en dessous) - UNIQUEMENT en mode first-last
    if (!isFirstOnly) {
      structure.labelNodes.push({
        id: nodeId(`label-last-frame-${coupleIdx}`),
        type: 'label',
        position: { x: coupleX, y: row2Y + LABEL_OFFSET_Y },
        data: {
          text: couplesPerPlan > 1 ? 'LAST' : 'LAST FRAME',
          fontSize: couplesPerPlan > 1 ? 72 : LAYOUT.GIANT_LABEL_FONT_SIZE,
          color: '#60a5fa',
        },
      });
      
      structure.imageNodes.push({
        id: imageFinNodeId,
        type: 'image',
        position: { x: coupleX, y: row2Y },
        data: {
          label: `Plan ${scene.sceneNumber}.${plan.planNumber} - Fin${couplesPerPlan > 1 ? ` (C${coupleIdx + 1})` : ''}`,
          instructions: couplePromptFin,
          aspectRatio: planImageRatio,
          isPlanImage: true,
          planId: plan.id,
          frameType: 'fin',
          coupleIndex: coupleIdx,
          generationType: 'edit',
          characterRefs: plan.characterRefs,
          decorRef: plan.decorRef || plan.locationRef,
        },
        width: LAYOUT.IMAGE_NODE_WIDTH,
        height: LAYOUT.IMAGE_NODE_HEIGHT_21_9,
      });
    }

    // ========== EDGES : Prompts → Images de ce couple ==========
    structure.edges.push({
      id: `edge-${textFirstFrameNodeId}-${imageDepartNodeId}-${nanoid(4)}`,
      source: textFirstFrameNodeId,
      target: imageDepartNodeId,
      type: 'default',
    });

    // Edge vers LAST uniquement en mode first-last
    if (!isFirstOnly) {
      structure.edges.push({
        id: `edge-${textLastFrameNodeId}-${imageFinNodeId}-${nanoid(4)}`,
        source: textLastFrameNodeId,
        target: imageFinNodeId,
        type: 'default',
      });
    }

    // ========== EDGES : Collections → Images de ce couple ==========
    for (const charRef of plan.characterRefs) {
      const collectionId = structure.characterCollectionIds[charRef];
      if (collectionId) {
        structure.edges.push({
          id: `edge-${collectionId}-${imageDepartNodeId}-${nanoid(4)}`,
          source: collectionId,
          target: imageDepartNodeId,
          type: 'default',
        });
        // Edge vers LAST uniquement en mode first-last
        if (!isFirstOnly) {
          structure.edges.push({
            id: `edge-${collectionId}-${imageFinNodeId}-${nanoid(4)}`,
            source: collectionId,
            target: imageFinNodeId,
            type: 'default',
          });
        }
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
        // Edge vers LAST uniquement en mode first-last
        if (!isFirstOnly) {
          structure.edges.push({
            id: `edge-${collectionId}-${imageFinNodeId}-${nanoid(4)}`,
            source: collectionId,
            target: imageFinNodeId,
            type: 'default',
          });
        }
      }
    }

    // Tracking pour ce couple
    planCouples.push({
      coupleIndex: coupleIdx,
      imageDepartNodeId,
      imageFinNodeId: isFirstOnly ? '' : imageFinNodeId, // Vide en mode first-only
      promptDepart: couplePromptDepart,
      promptFin: isFirstOnly ? '' : couplePromptFin,
      aspectRatio: planImageRatio,
      videoNodeIds: [], // Sera rempli par createPlanVideosStructure
    });
  }

  const decorRef = plan.decorRef || plan.locationRef;

  // ========== TRACKING ==========
  structure.planImageMap[plan.id] = {
    planId: plan.id,
    couples: planCouples,
    characterRefs: plan.characterRefs,
    decorRef: decorRef || undefined,
    // Rétrocompatibilité : premier couple
    imageDepartNodeId: couples[0].imageDepartNodeId,
    imageFinNodeId: couples[0].imageFinNodeId,
    promptDepart,
    promptFin,
    aspectRatio: planImageRatio,
  };

  // Calcul dimensions (avec N couples)
  const totalWidth = col3StartX - startX + couplesPerPlan * (LAYOUT.IMAGE_NODE_WIDTH + COUPLE_GAP) - COUPLE_GAP;
  const totalHeight = row2Y - startY + LAYOUT.IMAGE_NODE_HEIGHT_21_9;
  
  return { 
    width: totalWidth, 
    height: totalHeight,
    textActionNodeId,
    couples,
    // Rétrocompatibilité
    imageDepartNodeId: couples[0].imageDepartNodeId,
    imageFinNodeId: couples[0].imageFinNodeId,
  };
}

// ========== CRÉATION VIDÉOS POUR UN PLAN ==========
// Crée les nœuds vidéo (dans la section SCÈNES)
// NOUVEAU: Crée M vidéos par couple × N couples = N×M vidéos par plan
function createPlanVideosStructure(
  plan: GeneratedPlan,
  scene: GeneratedScene,
  startX: number,
  startY: number,
  frameNodeIds: { 
    textActionNodeId: string; 
    couples: { coupleIndex: number; imageDepartNodeId: string; imageFinNodeId: string }[];
    // Rétrocompatibilité
    imageDepartNodeId?: string; 
    imageFinNodeId?: string;
  },
  structure: CanvasStructure
): { width: number; height: number } {
  const couplesPerPlan = structure.couplesPerPlan || 1;  // N
  const videosPerCouple = structure.videosPerCouple || 4;  // M
  const videoNodeIds: string[] = [];
  const { duration } = structure.videoSettings;
  
  const videoGap = LAYOUT.VIDEO_GAP;
  const coupleRowGap = 100; // Gap entre rangées de vidéos de couples différents
  
  // Pour chaque couple, créer M vidéos
  const couples = frameNodeIds.couples || [{ 
    coupleIndex: 0, 
    imageDepartNodeId: frameNodeIds.imageDepartNodeId!, 
    imageFinNodeId: frameNodeIds.imageFinNodeId! 
  }];

  let currentY = startY;
  let maxRowWidth = 0;

  for (let coupleIdx = 0; coupleIdx < couples.length; coupleIdx++) {
    const couple = couples[coupleIdx];
    const coupleVideoIds: string[] = [];
    
    // Créer M vidéos pour ce couple
    for (let videoIdx = 0; videoIdx < videosPerCouple; videoIdx++) {
      const globalVideoIndex = coupleIdx * videosPerCouple + videoIdx;
      const videoId = nodeId(`video-plan-c${coupleIdx}-v${videoIdx}`);
      videoNodeIds.push(videoId);
      coupleVideoIds.push(videoId);
      
      // Label pour le couple si N > 1
      const coupleLabel = couplesPerPlan > 1 ? `C${coupleIdx + 1}-` : '';
      
      structure.videoNodes.push({
        id: videoId,
        type: 'video',
        position: { 
          x: startX + (videoIdx * (LAYOUT.VIDEO_NODE_WIDTH + videoGap)), 
          y: currentY,
        },
        data: {
          label: `Plan ${scene.sceneNumber}.${plan.planNumber} - ${coupleLabel}V${videoIdx + 1}`,
          instructions: plan.prompt,
          coupleIndex: coupleIdx,
          videoIndex: videoIdx,
          copyIndex: globalVideoIndex + 1,  // Rétrocompatibilité
          totalCopies: couplesPerPlan * videosPerCouple,
          duration,
          model: 'kling-v2.6-pro-first-last',
          usesFirstLastFrame: true,
        },
        width: LAYOUT.VIDEO_NODE_WIDTH,
        height: LAYOUT.VIDEO_NODE_HEIGHT,
      });

      // Edges : Images du couple + Prompt Action → Vidéo
      structure.edges.push({
        id: `edge-${couple.imageDepartNodeId}-${videoId}-${nanoid(4)}`,
        source: couple.imageDepartNodeId,
        target: videoId,
        type: 'default',
      });

      structure.edges.push({
        id: `edge-${couple.imageFinNodeId}-${videoId}-${nanoid(4)}`,
        source: couple.imageFinNodeId,
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

    // Mettre à jour les vidéoNodeIds dans le planImageMap pour ce couple
    const planImageInfo = structure.planImageMap[plan.id];
    if (planImageInfo && planImageInfo.couples[coupleIdx]) {
      planImageInfo.couples[coupleIdx].videoNodeIds = coupleVideoIds;
    }

    // Calculer largeur de cette rangée
    const rowWidth = videosPerCouple * (LAYOUT.VIDEO_NODE_WIDTH + videoGap) - videoGap;
    maxRowWidth = Math.max(maxRowWidth, rowWidth);
    
    // Avancer à la rangée suivante si plusieurs couples
    if (coupleIdx < couples.length - 1) {
      currentY += LAYOUT.VIDEO_NODE_HEIGHT + coupleRowGap;
    }
  }

  structure.planVideoMap[plan.id] = videoNodeIds;

  const totalWidth = maxRowWidth;
  const totalHeight = couplesPerPlan * LAYOUT.VIDEO_NODE_HEIGHT + (couplesPerPlan - 1) * coupleRowGap;
  
  return { width: totalWidth, height: totalHeight };
}

// ========== CRÉATION SCÈNE (VIDÉOS UNIQUEMENT) ==========
// Cette fonction crée le rectangle de scène avec UNIQUEMENT les nœuds vidéo
// Les frames sont créés séparément dans la section FIRST AND LAST FRAMES
// NOUVEAU: Supporte N couples × M vidéos par plan
function createSceneStructure(
  scene: GeneratedScene,
  startX: number,
  startY: number,
  frameNodeIdsMap: Map<string, { 
    textActionNodeId: string; 
    couples: { coupleIndex: number; imageDepartNodeId: string; imageFinNodeId: string }[];
    imageDepartNodeId: string; 
    imageFinNodeId: string;
  }>,
  structure: CanvasStructure
): { width: number; height: number } {
  const shapeNodeId = nodeId('shape-scene');
  const labelNodeId = nodeId('label-scene');

  // Calculer les dimensions de la scène (UNIQUEMENT vidéos)
  // NOUVEAU: N couples × M vidéos par plan
  const couplesPerPlan = structure.couplesPerPlan || 1;
  const videosPerCouple = structure.videosPerCouple || 4;
  const videoRowWidth = videosPerCouple * (LAYOUT.VIDEO_NODE_WIDTH + LAYOUT.VIDEO_GAP) - LAYOUT.VIDEO_GAP;
  
  const plansCount = scene.plans.length;
  // Hauteur: N couples de vidéos par plan (avec gap entre couples)
  const coupleRowGap = 100;
  const videoBlockHeight = couplesPerPlan * LAYOUT.VIDEO_NODE_HEIGHT + (couplesPerPlan - 1) * coupleRowGap;
  const contentHeight = plansCount * (videoBlockHeight + LAYOUT.NODE_GAP_Y);
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
  // NOUVEAU: chaque plan a N couples × M vidéos
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
    // Avancer de la hauteur du bloc vidéo (N couples × hauteur vidéo + gaps)
    planY += videoBlockHeight + LAYOUT.NODE_GAP_Y;
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
  couplesPerPlan?: number;    // N = Nombre de couples (first/last) par plan (défaut: 1)
  videosPerCouple?: number;   // M = Nombre de vidéos par couple (défaut: 4)
  videoCopies?: number;       // DEPRECATED: pour rétrocompatibilité
  videoDuration?: number;
  videoAspectRatio?: string;
  testMode?: boolean;
  frameMode?: FrameMode;      // 'first-last' (2 images) ou 'first-only' (1 image)
}

export function generateCanvasFromProject(
  project: GeneratedProjectStructure,
  testMode: boolean = false,
  videoCopies: number = 4,  // DEPRECATED: utiliser config.couplesPerPlan et config.videosPerCouple
  config?: GenerationConfig
): GeneratedCanvasData {
  // Paramètres vidéo - NOUVEAU: N couples × M vidéos par couple
  const videoDuration = config?.videoDuration || 10;
  const videoAspectRatio = config?.videoAspectRatio || '16:9';
  
  // Rétrocompatibilité: si couplesPerPlan/videosPerCouple ne sont pas définis, utiliser videoCopies
  const couplesPerPlan = config?.couplesPerPlan || 1;  // N = nombre de couples par plan
  const videosPerCouple = config?.videosPerCouple || videoCopies || 4;  // M = vidéos par couple
  
  // Mode frame: first-last (2 images) ou first-only (1 image)
  const frameMode: FrameMode = config?.frameMode || 'first-last';
  console.log(`[CanvasGenerator] Mode frame: ${frameMode}`);
  
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
    couplesPerPlan,
    videosPerCouple,
    videoCopies: couplesPerPlan * videosPerCouple,  // Total vidéos par plan (rétrocompat)
    videoSettings: {
      duration: videoDuration,
      aspectRatio: videoAspectRatio,
    },
    frameMode,
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
  // NOUVEAU: inclut N couples par plan
  const frameNodeIdsMap = new Map<string, { 
    textActionNodeId: string;
    couples: { coupleIndex: number; imageDepartNodeId: string; imageFinNodeId: string }[];
    // Rétrocompatibilité
    imageDepartNodeId: string; 
    imageFinNodeId: string; 
  }>();

  // Label géant de section - adapté au mode frame
  const frameSectionLabel = frameMode === 'first-only' 
    ? '🎬 FIRST FRAMES' 
    : '🎬 FIRST AND LAST FRAMES';
  structure.labelNodes.push({
    id: nodeId('label-section-frames'),
    type: 'label',
    position: { x: section2StartX, y: section2StartY },
    data: {
      text: frameSectionLabel,
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

    // Frames de chaque plan (N couples par plan)
    for (const plan of scene.plans) {
      const result = createPlanFramesStructure(
        plan,
        scene,
        section2StartX,
        section2ContentY,
        structure
      );
      
      // Stocker tous les couples pour ce plan
      frameNodeIdsMap.set(plan.id, {
        textActionNodeId: result.textActionNodeId,
        couples: result.couples,
        // Rétrocompatibilité : premier couple
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
    
    // Config vidéo - NOUVEAU: N couples × M vidéos
    couplesPerPlan: structure.couplesPerPlan || 1,
    videosPerCouple: structure.videosPerCouple || 4,
    videoCopies: structure.videoCopies || 4,  // Total (N×M) pour rétrocompat
    videoSettings: structure.videoSettings,
    
    // NOUVEAU - Étape 4 : Images de plan (départ/fin) à générer
    // Ces images sont générées par EDIT à partir des collections
    // Elles doivent être générées APRÈS que les collections soient remplies
    // MISE À JOUR: Supporte N couples par plan
    planImages: Object.entries(structure.planImageMap).flatMap(([planId, info]) => {
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

      // Retourner une entrée pour chaque couple
      return (info.couples || [{ 
        coupleIndex: 0,
        imageDepartNodeId: info.imageDepartNodeId,
        imageFinNodeId: info.imageFinNodeId,
        promptDepart: info.promptDepart,
        promptFin: info.promptFin,
        aspectRatio: info.aspectRatio,
        videoNodeIds: [],
      }]).map(couple => ({
        planId,
        coupleIndex: couple.coupleIndex,
        imageDepartNodeId: couple.imageDepartNodeId,
        imageFinNodeId: couple.imageFinNodeId,
        promptDepart: couple.promptDepart,
        promptFin: couple.promptFin,
        aspectRatio: couple.aspectRatio || info.aspectRatio, // 21:9
        characterCollectionIds,
        decorCollectionId,
        videoNodeIds: couple.videoNodeIds,
      }));
    }),
    
    // Étape 5 : Vidéos à générer (NOUVEAU WORKFLOW)
    // Les vidéos attendent que leurs images de plan (départ/fin) soient prêtes
    // Elles utilisent first frame (départ) + last frame (fin) + prompt action
    // MISE À JOUR: Organisées par couple pour N×M génération
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

      // Info sur les couples pour ce plan
      const couples = planImageInfo?.couples?.map(couple => ({
        coupleIndex: couple.coupleIndex,
        imageDepartNodeId: couple.imageDepartNodeId,
        imageFinNodeId: couple.imageFinNodeId,
        videoNodeIds: couple.videoNodeIds,
      })) || [];

      return {
        planId,
        videoNodeIds: videoNodeIds, // TABLEAU pour toutes les vidéos (N×M)
        couples, // Info détaillée par couple
        prompt: planInfo?.prompt || '',
        // Rétrocompatibilité : premier couple
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
