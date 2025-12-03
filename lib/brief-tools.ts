/**
 * Définitions des tools pour la génération de projets via function calling
 * L'IA peut appeler ces fonctions pour orchestrer la génération
 */

export const BRIEF_GENERATION_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'generate_character_image',
      description: 'Génère une image pour un personnage à un angle spécifique. À appeler 4 fois par personnage pour obtenir tous les angles.',
      parameters: {
        type: 'object',
        properties: {
          characterName: {
            type: 'string',
            description: 'Nom du personnage (sera utilisé pour la collection)',
          },
          angle: {
            type: 'string',
            enum: ['face', 'profile', 'fullBody', 'back'],
            description: 'Angle de vue : face, profile (profil), fullBody (corps entier), back (dos)',
          },
          prompt: {
            type: 'string',
            description: 'Prompt détaillé pour générer cette image. Doit inclure description physique complète, vêtements, style, éclairage.',
          },
          referenceCode: {
            type: 'string',
            description: 'Code de référence unique du personnage (ex: [PERSO:Jean])',
          },
        },
        required: ['characterName', 'angle', 'prompt', 'referenceCode'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_location_image',
      description: 'Génère des images multi-angles pour un lieu.',
      parameters: {
        type: 'object',
        properties: {
          locationName: {
            type: 'string',
            description: 'Nom du lieu (sera utilisé pour la collection)',
          },
          prompt: {
            type: 'string',
            description: 'Prompt détaillé pour générer les images du lieu sous plusieurs angles. Doit inclure architecture, décoration, atmosphère, éclairage.',
          },
          referenceCode: {
            type: 'string',
            description: 'Code de référence unique du lieu (ex: [LIEU:Bureau])',
          },
        },
        required: ['locationName', 'prompt', 'referenceCode'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_collection',
      description: 'Crée un nœud collection qui regroupe les images générées pour un personnage ou un lieu. À appeler APRÈS avoir généré toutes les images.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Nom de la collection (ex: "Personnage - Jean", "Lieu - Bureau")',
          },
          type: {
            type: 'string',
            enum: ['character', 'location'],
            description: 'Type de collection : character (personnage) ou location (lieu)',
          },
          referenceCode: {
            type: 'string',
            description: 'Code de référence (ex: [PERSO:Jean], [LIEU:Bureau])',
          },
          imageIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'IDs des images générées à inclure dans cette collection',
          },
        },
        required: ['name', 'type', 'referenceCode', 'imageIds'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_video_plan',
      description: 'Génère une ou plusieurs vidéos pour un plan du scénario. Utilise les collections de personnages et lieux comme références visuelles.',
      parameters: {
        type: 'object',
        properties: {
          sceneNumber: {
            type: 'number',
            description: 'Numéro de la scène',
          },
          planNumber: {
            type: 'number',
            description: 'Numéro du plan dans la scène',
          },
          prompt: {
            type: 'string',
            description: 'Prompt EXHAUSTIF et AUTO-SUFFISANT du plan. Doit décrire COMPLÈTEMENT: QUI (personnages), OÙ (lieu), QUOI (action), COMMENT (cadrage, mouvement, lumière).',
          },
          characterReferences: {
            type: 'array',
            items: { type: 'string' },
            description: 'Codes de référence des personnages impliqués (ex: ["[PERSO:Jean]", "[PERSO:Marie]"])',
          },
          locationReferences: {
            type: 'array',
            items: { type: 'string' },
            description: 'Codes de référence des lieux impliqués (ex: ["[LIEU:Bureau]"])',
          },
          duration: {
            type: 'number',
            description: 'Durée de la vidéo en secondes (recommandé: 3-8 secondes)',
          },
          copies: {
            type: 'number',
            description: 'Nombre de variations à générer pour ce plan (recommandé: 4)',
          },
        },
        required: ['sceneNumber', 'planNumber', 'prompt', 'characterReferences', 'locationReferences', 'duration', 'copies'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_videos_to_davinci',
      description: 'Envoie les vidéos générées vers DaVinci Resolve. À appeler APRÈS avoir généré toutes les vidéos.',
      parameters: {
        type: 'object',
        properties: {
          videoIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'IDs des vidéos à envoyer vers DaVinci Resolve',
          },
          folderName: {
            type: 'string',
            description: 'Nom du dossier dans DaVinci Resolve où importer les vidéos',
          },
        },
        required: ['videoIds', 'folderName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_project_structure',
      description: 'Crée la structure initiale du projet avec le titre et le synopsis. À appeler EN PREMIER.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Titre du projet vidéo',
          },
          synopsis: {
            type: 'string',
            description: 'Résumé du scénario en 2-3 phrases',
          },
          totalScenes: {
            type: 'number',
            description: 'Nombre total de scènes',
          },
          totalPlans: {
            type: 'number',
            description: 'Nombre total de plans',
          },
          estimatedDuration: {
            type: 'number',
            description: 'Durée totale estimée en secondes',
          },
        },
        required: ['title', 'synopsis', 'totalScenes', 'totalPlans', 'estimatedDuration'],
      },
    },
  },
];

/**
 * Types pour les résultats des tools
 */
export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  id?: string; // ID de l'élément créé
}

