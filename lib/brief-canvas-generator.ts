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

// ========== CONSTANTES DE LAYOUT AMÉLIORÉES ==========
const LAYOUT = {
  // Marges générales - TRÈS ESPACÉ
  MARGIN: 300,
  SECTION_GAP: 600,          // Espace entre sections (triplé)
  
  // Zone personnages/lieux (colonne gauche)
  LEFT_COLUMN_WIDTH: 2800,   // Plus large
  // IMPORTANT: Les images 9:16 font ~570px de haut pour 320px de large
  // Donc on a besoin de ~800px minimum par ligne de personnage
  CHARACTER_ROW_HEIGHT: 1800, // AUGMENTÉ: 800px pour images 9:16 + espace
  LOCATION_ROW_HEIGHT: 800,   // Décors en 16:9 sont moins hauts
  
  // Tailles des nœuds - FIXE pour éviter clignotement
  TEXT_NODE_WIDTH: 350,      // Compact
  TEXT_NODE_HEIGHT: 200,     // Réduit (prompts collapsed par défaut)
  IMAGE_NODE_WIDTH: 320,     // Largeur fixe
  IMAGE_NODE_HEIGHT_1_1: 320,   // Hauteur 1:1
  IMAGE_NODE_HEIGHT_9_16: 570,  // Hauteur 9:16 (320 * 16/9)
  IMAGE_NODE_HEIGHT_16_9: 180,  // Hauteur 16:9 (320 * 9/16)
  COLLECTION_NODE_WIDTH: 450,
  COLLECTION_NODE_HEIGHT: 350,
  VIDEO_NODE_WIDTH: 500,
  VIDEO_NODE_HEIGHT: 400,
  
  // Espacement entre nœuds - TRÈS ESPACÉ
  NODE_GAP_X: 250,           // Augmenté pour éviter chevauchement horizontal
  NODE_GAP_Y: 250,           // Augmenté pour éviter chevauchement vertical
  
  // Zone scènes (colonne droite) - Plus loin
  SCENES_START_X: 3200,      // Encore plus décalé à droite
  SCENE_GAP: 900,            // Beaucoup plus d'espace entre scènes
  SCENE_PADDING: 200,
  PLAN_WIDTH: 1400,          // Plans plus larges
  PLAN_HEIGHT: 700,          // Plans plus hauts
  PLANS_PER_ROW: 1,          // 1 plan par ligne pour plus de clarté
  
  // Titre de scène
  SCENE_TITLE_FONT_SIZE: 120,
  SCENE_TITLE_HEIGHT: 180,
  
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
  
  const imageConfigs = [
    { 
      key: 'primary', 
      id: imageNodeIds.primary, 
      label: 'Primaire (Réf)', 
      prompt: enrichPrimaryPrompt(primaryPrompt), 
      x: 0, 
      aspectRatio: IMAGE_RATIOS.decor.primary, 
      isReference: true,
      generationType: 'text-to-image'
    },
    { 
      key: 'angle2', 
      id: imageNodeIds.angle2, 
      label: 'Nouvel angle', 
      prompt: angle2Prompt, 
      x: 1, 
      aspectRatio: IMAGE_RATIOS.decor.angle2, 
      isReference: false,
      generationType: 'edit'
    },
    { 
      key: 'plongee', 
      id: imageNodeIds.plongee, 
      label: 'Plongée', 
      prompt: plongeePrompt, 
      x: 2, 
      aspectRatio: IMAGE_RATIOS.decor.plongee, 
      isReference: false,
      generationType: 'edit'
    },
    { 
      key: 'contrePlongee', 
      id: imageNodeIds.contrePlongee, 
      label: 'Contre-plongée', 
      prompt: contrePlongeePrompt, 
      x: 3, 
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
    
    // Décors = 16:9, donc hauteur réduite
    structure.imageNodes.push({
      id: config.id,
      type: 'image',
      position: {
        x: imageStartX + config.x * (LAYOUT.IMAGE_NODE_WIDTH + LAYOUT.NODE_GAP_X),
        y: startY,
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

  // 3. Nœud COLLECTION
  const numImages = imageConfigs.length;
  const collectionX = imageStartX + numImages * (LAYOUT.IMAGE_NODE_WIDTH + LAYOUT.NODE_GAP_X) + LAYOUT.NODE_GAP_X;
  
  structure.collectionNodes.push({
    id: collectionNodeId,
    type: 'collection',
    position: { x: collectionX, y: startY },
    data: {
      label: `Décor ${decor.name}`,
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

// ========== CRÉATION PLAN ==========
// NOUVEAU WORKFLOW : Pour chaque plan, on crée :
// - 1 nœud TEXT (prompt action)
// - 1 nœud IMAGE départ (21:9) - généré par edit depuis collections
// - 1 nœud IMAGE fin (21:9) - généré par edit depuis collections
// - N nœuds VIDEO (copies) - générés avec first frame + last frame + prompt action
function createPlanStructure(
  plan: GeneratedPlan,
  scene: GeneratedScene,
  startX: number,
  startY: number,
  structure: CanvasStructure
): { width: number; height: number } {
  const textNodeId = nodeId('text-plan');
  const imageDepartNodeId = nodeId('img-plan-depart');
  const imageFinNodeId = nodeId('img-plan-fin');
  const videoCopies = structure.videoCopies || 4;
  const videoNodeIds: string[] = [];
  const { duration } = structure.videoSettings;
  // NOTE: On n'utilise PAS aspectRatio car KLING v2.6 ne le supporte pas avec last_image

  // Ratio pour les images de plan (21:9 cinémascope)
  const planImageRatio = IMAGE_RATIOS.plan?.depart || '21:9';
  // Hauteur approximative pour image 21:9 (basé sur largeur 320)
  const IMAGE_NODE_HEIGHT_21_9 = 137; // 320 * 9/21 ≈ 137

  // Texte du plan (prompt action)
  const textContent = `## Plan ${scene.sceneNumber}.${plan.planNumber}\n\n**Action:** ${plan.prompt}${plan.cameraMovement ? `\n\n📷 *${plan.cameraMovement}*` : ''}`;

  // 1. Nœud TEXT (prompt action du plan)
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

  // 2. Nœud IMAGE DÉPART (21:9)
  const imageStartX = startX + LAYOUT.TEXT_NODE_WIDTH + LAYOUT.NODE_GAP_X;
  const promptDepart = plan.promptImageDepart || `Début du plan : ${plan.prompt}`;
  
  structure.imageNodes.push({
    id: imageDepartNodeId,
    type: 'image',
    position: { 
      x: imageStartX, 
      y: startY 
    },
    data: {
      label: `Plan ${scene.sceneNumber}.${plan.planNumber} - Départ`,
      instructions: promptDepart,
      aspectRatio: planImageRatio,
      isPlanImage: true,
      planId: plan.id,
      frameType: 'depart',
      generationType: 'edit', // Généré par edit depuis les collections
      characterRefs: plan.characterRefs,
      decorRef: plan.decorRef || plan.locationRef,
    },
    width: LAYOUT.IMAGE_NODE_WIDTH,
    height: IMAGE_NODE_HEIGHT_21_9,
  });

  // 3. Nœud IMAGE FIN (21:9)
  const promptFin = plan.promptImageFin || `Fin du plan : ${plan.prompt}`;
  
  structure.imageNodes.push({
    id: imageFinNodeId,
    type: 'image',
    position: { 
      x: imageStartX, 
      y: startY + IMAGE_NODE_HEIGHT_21_9 + LAYOUT.NODE_GAP_Y / 2 
    },
    data: {
      label: `Plan ${scene.sceneNumber}.${plan.planNumber} - Fin`,
      instructions: promptFin,
      aspectRatio: planImageRatio,
      isPlanImage: true,
      planId: plan.id,
      frameType: 'fin',
      generationType: 'edit', // Généré par edit depuis les collections
      characterRefs: plan.characterRefs,
      decorRef: plan.decorRef || plan.locationRef,
    },
    width: LAYOUT.IMAGE_NODE_WIDTH,
    height: IMAGE_NODE_HEIGHT_21_9,
  });

  // 4. Edges : Collections → Images de plan
  // Collections personnages → images départ/fin
  for (const charRef of plan.characterRefs) {
    const collectionId = structure.characterCollectionIds[charRef];
    if (collectionId) {
      // Collection → image départ
      structure.edges.push({
        id: `edge-${collectionId}-${imageDepartNodeId}-${nanoid(4)}`,
        source: collectionId,
        target: imageDepartNodeId,
        type: 'default',
      });
      // Collection → image fin
      structure.edges.push({
        id: `edge-${collectionId}-${imageFinNodeId}-${nanoid(4)}`,
        source: collectionId,
        target: imageFinNodeId,
        type: 'default',
      });
    }
  }

  // Collection décor → images départ/fin
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

  // 5. Créer N nœuds VIDEO (copies)
  const videoStartX = imageStartX + LAYOUT.IMAGE_NODE_WIDTH + LAYOUT.NODE_GAP_X;
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
        // PAS de aspectRatio - KLING v2.6 ne le supporte pas avec last_image
        // Le modèle déduira le ratio des images d'entrée (21:9 → crop 16:9)
        model: 'kling-v2.6-pro-i2v', // Forcer KLING v2.6
        usesFirstLastFrame: true, // Flag pour indiquer le nouveau workflow
      },
      width: LAYOUT.VIDEO_NODE_WIDTH,
      height: LAYOUT.VIDEO_NODE_HEIGHT,
    });

    // 6. Edges : Images plan → Vidéo + Text → Vidéo
    // Image départ → vidéo (first frame)
    structure.edges.push({
      id: `edge-${imageDepartNodeId}-${videoNodeId}-${nanoid(4)}`,
      source: imageDepartNodeId,
      target: videoNodeId,
      type: 'default',
    });

    // Image fin → vidéo (last frame)
    structure.edges.push({
      id: `edge-${imageFinNodeId}-${videoNodeId}-${nanoid(4)}`,
      source: imageFinNodeId,
      target: videoNodeId,
      type: 'default',
    });

    // Text (prompt action) → vidéo
    structure.edges.push({
      id: `edge-${textNodeId}-${videoNodeId}-${nanoid(4)}`,
      source: textNodeId,
      target: videoNodeId,
      type: 'default',
    });
  }

  // 7. Tracking
  structure.planVideoMap[plan.id] = videoNodeIds;
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

  // Largeur totale : text + images + N vidéos
  const totalWidth = LAYOUT.TEXT_NODE_WIDTH + LAYOUT.NODE_GAP_X + LAYOUT.IMAGE_NODE_WIDTH + LAYOUT.NODE_GAP_X + (videoCopies * videoGap);
  // Hauteur : images empilées (2 x 21:9) ou vidéo (plus haute)
  const totalHeight = Math.max(LAYOUT.PLAN_HEIGHT, IMAGE_NODE_HEIGHT_21_9 * 2 + LAYOUT.NODE_GAP_Y / 2);
  return { width: totalWidth, height: totalHeight };
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
  // IMPORTANT: La largeur dépend du nombre de copies vidéo + images de plan
  const videoCopies = structure.videoCopies || 4;
  const videoGap = LAYOUT.VIDEO_NODE_WIDTH + LAYOUT.NODE_GAP_X;
  // Nouvelle formule avec images départ/fin : text + images + N vidéos
  const planWidth = LAYOUT.TEXT_NODE_WIDTH + LAYOUT.NODE_GAP_X + LAYOUT.IMAGE_NODE_WIDTH + LAYOUT.NODE_GAP_X + (videoCopies * videoGap);
  
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
    planImageMap: {},  // Nouveau : images de départ/fin par plan
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

  // ========== SECTION DÉCORS (anciennement LIEUX) ==========
  // Supporter les deux formats : project.decors (nouveau) ou project.locations (ancien)
  const decors = project.decors || project.locations || [];
  if (decors.length > 0) {
    currentY += LAYOUT.SECTION_GAP;

    // Titre section
    structure.labelNodes.push({
      id: nodeId('label-section-decors'),
      type: 'label',
      position: { x: LAYOUT.MARGIN, y: currentY },
      data: {
        text: '🎬 DÉCORS',
        fontSize: 72,
        color: '#22c55e',
      },
    });
    currentY += 100;

    for (const decor of decors) {
      createDecorStructure(decor, LAYOUT.MARGIN, currentY, structure, testMode);
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
