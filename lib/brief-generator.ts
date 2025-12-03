/**
 * Générateur de projets à partir de briefs
 * Orchestre l'analyse IA et la création des nœuds
 */

import type { 
  Brief, 
  ProjectGenerationConfig, 
  GeneratedScenario,
  Character,
  Location,
  ScenarioPlan
} from '@/types/brief';

interface GenerateProjectOptions {
  brief: Brief;
  config: ProjectGenerationConfig;
  projectName: string;
}

interface ProjectStructure {
  projectId: string;
  scenario: GeneratedScenario;
  nodes: any[]; // ReactFlow nodes
  edges: any[]; // ReactFlow edges
}

/**
 * Point d'entrée principal pour générer un projet depuis un brief
 */
export async function generateProjectFromBrief(
  options: GenerateProjectOptions
): Promise<ProjectStructure> {
  const { brief, config, projectName } = options;

  console.log('[BriefGenerator] Démarrage génération projet:', projectName);

  // 1. Analyser le brief avec l'IA
  const scenario = await analyzeBreifWithAI(brief, config);
  console.log('[BriefGenerator] Scénario généré:', {
    scenes: scenario.scenes.length,
    plans: scenario.totalPlans,
    characters: scenario.characters.length,
    locations: scenario.locations.length,
  });

  // 2. Créer le projet
  const projectId = await createProject(projectName, config);
  console.log('[BriefGenerator] Projet créé:', projectId);

  // 3. Générer les nœuds et edges
  const { nodes, edges } = await generateNodesAndEdges(scenario, projectId, config);
  console.log('[BriefGenerator] Nœuds générés:', nodes.length);

  // 4. Si génération automatique, lancer les générations
  if (config.generateMediaDirectly) {
    console.log('[BriefGenerator] Lancement génération automatique des médias...');
    await generateMediaAutomatically(scenario, nodes, config);
  }

  return {
    projectId,
    scenario,
    nodes,
    edges,
  };
}

/**
 * Analyse le brief avec l'IA pour générer un scénario structuré
 */
async function analyzeBreifWithAI(
  brief: Brief,
  config: ProjectGenerationConfig
): Promise<GeneratedScenario> {
  // Construire le contexte du brief
  const briefContext = buildBriefContext(brief);

  // Appeler l'IA
  const response = await fetch('/api/ai/analyze-brief', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      briefContext,
      systemPrompt: config.systemPrompt,
      model: config.aiModel,
      reasoningLevel: config.reasoningLevel,
      customInstructions: config.customInstructions,
    }),
  });

  if (!response.ok) {
    throw new Error(`Erreur IA: ${response.statusText}`);
  }

  const scenario: GeneratedScenario = await response.json();
  
  // Valider le scénario
  validateScenario(scenario);
  
  return scenario;
}

/**
 * Construit le contexte du brief pour l'IA
 */
function buildBriefContext(brief: Brief): string {
  let context = `# BRIEF: ${brief.name}\n\n`;
  
  if (brief.description) {
    context += `## Description\n${brief.description}\n\n`;
  }

  context += `## Documents fournis\n\n`;
  
  for (const doc of brief.documents || []) {
    context += `### ${doc.name} (${doc.type})\n`;
    if (doc.content) {
      context += `${doc.content}\n\n`;
    } else {
      context += `[Fichier ${doc.type}: ${doc.url}]\n\n`;
    }
  }

  return context;
}

/**
 * Valide la structure du scénario généré
 */
function validateScenario(scenario: GeneratedScenario): void {
  if (!scenario.title || !scenario.scenes || scenario.scenes.length === 0) {
    throw new Error('Scénario invalide: titre ou scènes manquants');
  }

  if (!scenario.characters || !scenario.locations) {
    throw new Error('Scénario invalide: personnages ou lieux manquants');
  }

  // Vérifier que chaque plan a les champs requis
  for (const scene of scenario.scenes) {
    for (const plan of scene.plans) {
      if (!plan.prompt || plan.prompt.trim().length === 0) {
        throw new Error(`Plan ${plan.planNumber} de la scène ${scene.sceneNumber}: prompt manquant`);
      }
    }
  }
}

/**
 * Crée le projet dans la base de données
 */
async function createProject(name: string, config: ProjectGenerationConfig): Promise<string> {
  const response = await fetch('/api/project/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      transcriptionModel: 'whisper-1',
      visionModel: config.aiModel,
    }),
  });

  if (!response.ok) {
    throw new Error('Erreur lors de la création du projet');
  }

  const { projectId } = await response.json();
  return projectId;
}

/**
 * Génère les nœuds et edges ReactFlow à partir du scénario
 */
async function generateNodesAndEdges(
  scenario: GeneratedScenario,
  projectId: string,
  config: ProjectGenerationConfig
): Promise<{ nodes: any[]; edges: any[] }> {
  const nodes: any[] = [];
  const edges: any[] = [];
  
  let yOffset = 0;
  const VERTICAL_SPACING = 200;
  const HORIZONTAL_SPACING = 300;

  // 1. Créer les nœuds collections pour les personnages
  let xOffset = 0;
  for (const character of scenario.characters) {
    const collectionNode = createCollectionNode({
      id: `char-${character.name}`,
      name: `Personnage - ${character.name}`,
      position: { x: xOffset, y: yOffset },
      description: character.description,
      referenceCode: character.referenceCode,
    });
    nodes.push(collectionNode);

    // Créer les nœuds de génération d'image pour chaque angle
    const angles = [
      { key: 'face', label: 'Face', prompt: character.prompts.face },
      { key: 'profile', label: 'Profil', prompt: character.prompts.profile },
      { key: 'fullBody', label: 'Corps entier', prompt: character.prompts.fullBody },
      { key: 'back', label: 'Dos', prompt: character.prompts.back },
    ];

    let angleY = yOffset + VERTICAL_SPACING;
    for (const angle of angles) {
      const imageNode = createImageNode({
        id: `char-${character.name}-${angle.key}`,
        prompt: angle.prompt,
        position: { x: xOffset, y: angleY },
        model: config.settings?.imageModel || 'nanobanana-pro',
      });
      nodes.push(imageNode);

      // Edge: image → collection
      edges.push({
        id: `edge-${imageNode.id}-to-${collectionNode.id}`,
        source: imageNode.id,
        target: collectionNode.id,
      });

      angleY += VERTICAL_SPACING;
    }

    xOffset += HORIZONTAL_SPACING;
  }

  // 2. Créer les nœuds collections pour les lieux
  yOffset = angleY + VERTICAL_SPACING;
  xOffset = 0;
  
  for (const location of scenario.locations) {
    const collectionNode = createCollectionNode({
      id: `loc-${location.name}`,
      name: `Lieu - ${location.name}`,
      position: { x: xOffset, y: yOffset },
      description: location.description,
      referenceCode: location.referenceCode,
    });
    nodes.push(collectionNode);

    // Nœud de génération d'image multi-angles
    const imageNode = createImageNode({
      id: `loc-${location.name}-img`,
      prompt: location.prompt,
      position: { x: xOffset, y: yOffset + VERTICAL_SPACING },
      model: config.settings?.imageModel || 'nanobanana-pro',
    });
    nodes.push(imageNode);

    // Edge: image → collection
    edges.push({
      id: `edge-${imageNode.id}-to-${collectionNode.id}`,
      source: imageNode.id,
      target: collectionNode.id,
    });

    xOffset += HORIZONTAL_SPACING;
  }

  // 3. Créer les nœuds pour les plans (vidéos)
  yOffset += VERTICAL_SPACING * 3;
  xOffset = 0;

  for (const scene of scenario.scenes) {
    for (const plan of scene.plans) {
      if (plan.type !== 'shot') continue; // On ne génère que les plans de type "shot"

      const videoNode = createVideoNode({
        id: `plan-${scene.sceneNumber}-${plan.planNumber}`,
        prompt: plan.prompt,
        position: { x: xOffset, y: yOffset },
        model: config.settings?.videoModel || 'kling-o1',
        characters: plan.characters,
        locations: plan.locations,
        duration: plan.duration,
      });
      nodes.push(videoNode);

      // Edges: collections → video
      for (const charRef of plan.characters) {
        const charId = `char-${charRef.replace('[PERSO:', '').replace(']', '')}`;
        if (nodes.find(n => n.id === charId)) {
          edges.push({
            id: `edge-${charId}-to-${videoNode.id}`,
            source: charId,
            target: videoNode.id,
          });
        }
      }

      for (const locRef of plan.locations) {
        const locId = `loc-${locRef.replace('[LIEU:', '').replace(']', '')}`;
        if (nodes.find(n => n.id === locId)) {
          edges.push({
            id: `edge-${locId}-to-${videoNode.id}`,
            source: locId,
            target: videoNode.id,
          });
        }
      }

      xOffset += HORIZONTAL_SPACING;
      if (xOffset > HORIZONTAL_SPACING * 4) {
        xOffset = 0;
        yOffset += VERTICAL_SPACING;
      }
    }
  }

  return { nodes, edges };
}

/**
 * Crée un nœud collection
 */
function createCollectionNode(options: {
  id: string;
  name: string;
  position: { x: number; y: number };
  description: string;
  referenceCode: string;
}): any {
  return {
    id: options.id,
    type: 'collection',
    position: options.position,
    data: {
      label: options.name,
      description: options.description,
      referenceCode: options.referenceCode,
      images: [],
    },
  };
}

/**
 * Crée un nœud de génération d'image
 */
function createImageNode(options: {
  id: string;
  prompt: string;
  position: { x: number; y: number };
  model: string;
}): any {
  return {
    id: options.id,
    type: 'image',
    position: options.position,
    data: {
      prompt: options.prompt,
      model: options.model,
      size: '1024x1024',
    },
  };
}

/**
 * Crée un nœud de génération vidéo
 */
function createVideoNode(options: {
  id: string;
  prompt: string;
  position: { x: number; y: number };
  model: string;
  characters: string[];
  locations: string[];
  duration?: number;
}): any {
  return {
    id: options.id,
    type: 'video',
    position: options.position,
    data: {
      prompt: options.prompt,
      model: options.model,
      duration: options.duration || 5,
      characters: options.characters,
      locations: options.locations,
    },
  };
}

/**
 * Lance la génération automatique de tous les médias
 */
async function generateMediaAutomatically(
  scenario: GeneratedScenario,
  nodes: any[],
  config: ProjectGenerationConfig
): Promise<void> {
  console.log('[BriefGenerator] Génération automatique démarrée');
  
  // Importer dynamiquement pour éviter les dépendances circulaires
  const { generateAllMedia } = await import('@/lib/auto-media-generator');
  
  const projectId = nodes[0]?.data?.projectId || 'unknown';
  
  await generateAllMedia({
    scenario,
    imageModel: config.settings?.imageModel || 'nanobanana-pro',
    videoModel: config.settings?.videoModel || 'kling-o1',
    videoCopies: config.settings?.videoCopies || 4,
    projectId,
    sendToDVR: true,
  });
  
  console.log('[BriefGenerator] Génération automatique terminée');
}

