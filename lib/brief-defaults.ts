/**
 * Configurations par défaut pour la génération de briefs
 * Tous les prompts et paramètres sont configurables et sauvables
 */

import type { 
  CharacterPromptConfig, 
  DecorPromptConfig, 
  QualityModelConfig,
  QualityLevel 
} from '@/types/brief';

// ========== SYSTEM PROMPT PERSONNAGES ==========
// Ce prompt guide l'IA pour créer un prompt PRIMAIRE de personnage
export const DEFAULT_CHARACTER_SYSTEM_PROMPT = `Tu dois créer un prompt d'image extrêmement détaillé et clinique pour un personnage.

## RÈGLES STRICTES
1. Le prompt DOIT commencer par : "Crée une image du personnage décrit ci-dessous. Le personnage doit être de face, debout, vu des pieds à la tête sur fond parfaitement gris neutre."
2. La description doit être EXTRÊMEMENT VISUELLE et DÉTAILLÉE
3. NE PAS utiliser de métaphores ou de descriptions abstraites
4. NE PAS décrire ce qu'on ne pourrait pas voir dans l'image
5. NE PAS inclure de prénom ni de nom dans la description (même si le label du nœud en a un)
6. PAS d'ambiguïté de type "peut-être avec..." ou "environ"
7. Tout doit être PRÉCIS et CONCRET

## ÉLÉMENTS À DÉCRIRE (dans cet ordre)
1. Genre, âge approximatif, taille, corpulence, posture
2. Visage : forme, peau, rides, marques, expression
3. Cheveux : couleur, longueur, coiffure, état
4. Barbe/moustache si homme : longueur, entretien, couleur
5. Yeux : couleur, forme, cernes, regard
6. Mains : état, veines, ongles
7. Vêtements : de haut en bas, couleur, matière, état, ajustement
8. Chaussures : type, couleur, état
9. Accessoires : montre, bijoux, sac, badge, etc.

## EXEMPLE DE DESCRIPTION (à titre de référence technique uniquement)
Homme de cinquante ans environ, taille moyenne (1,75 m–1,80 m), légèrement voûté, comme quelqu'un qui a passé trop d'heures assis. Carrure de cadre qui ne fait plus vraiment d'activité physique : épaules encore présentes, mais un peu tombantes, ventre discret mais installé. Visage allongé, pommettes un peu marquées, mâchoire qui a perdu de sa netteté. Barbe de trois à cinq jours, irrégulière, avec des poils gris qui se mêlent au brun : le cou n'est pas bien net, quelques zones plus clairsemées. Cheveux courts, en recul sur les tempes, mélange de gris et de sa couleur d'origine. Légèrement gras, avec une raie approximative. Cernes visibles sous les yeux, coloration tirant sur le bleu ou le violacé, petites poches. Regard fatigué, paupières un peu lourdes, coin des yeux ridé. Peau du visage légèrement marquée : rides au front, plis au coin de la bouche. Lèvres un peu sèches, commissures légèrement tombantes. Mains de cadre : pas abîmées, mais veinées, avec quelques taches de vieillesse qui commencent, ongles coupés mais pas particulièrement soignés. Costume deux pièces bleu marine, visiblement déjà beaucoup porté. La veste tombe correctement, mais le tissu est un peu lustré aux coudes. Léger faux pli sur une manche, revers un peu fatigués. Chemise blanche, pas parfaitement repassée : léger froissé au niveau du ventre et des coudes. Le col est un peu ramolli, dernier bouton ouvert, sans cravate. Ceinture en cuir noir avec boucle métallique simple ; le cuir commence à se marquer. Pantalon de costume assorti, légèrement froissé aux genoux et chevilles. Chaussures de ville en cuir noir, richelieu, un peu usées. Pointe ternie, plis marqués sur le cou-de-pied. Chaussettes noires, légèrement détendues à la cheville. Montre classique en acier, rayée par endroits. Badge d'entreprise au bout d'un cordon qui dépasse de la poche de veste.`;

// ========== PROMPTS VARIANTES PERSONNAGES ==========
export const DEFAULT_CHARACTER_VARIANT_PROMPTS = {
  face: "Génère une image précise du visage de face de ce personnage, sans rien changer ou ajouter à l'image de référence.",
  profile: "Génère une image précise du visage de profil de ce personnage, sans rien changer ou ajouter à l'image de référence.",
  back: "Génère une image précise de ce personnage vu de dos, sans rien changer ou ajouter à l'image de référence.",
};

// ========== SYSTEM PROMPT DÉCORS ==========
// Ce prompt guide l'IA pour créer un prompt PRIMAIRE de décor
export const DEFAULT_DECOR_SYSTEM_PROMPT = `Tu dois créer un prompt d'image extrêmement détaillé pour un décor.

## RÈGLES STRICTES
1. Le prompt DOIT commencer par : "Crée une image du décor décrit ci-dessous."
2. La description doit être EXTRÊMEMENT VISUELLE et DÉTAILLÉE
3. NE PAS utiliser de métaphores ou de descriptions abstraites
4. NE PAS décrire ce qu'on ne pourrait pas voir dans l'image
5. PAS d'ambiguïté - tout doit être PRÉCIS et CONCRET
6. Décrire l'ambiance lumineuse, l'heure du jour, les textures

## ÉLÉMENTS À DÉCRIRE
1. Architecture : dimensions, style, époque
2. Mobilier : type, placement, état, matériaux
3. Éclairage : sources de lumière, ambiance, ombres
4. Textures : sols, murs, surfaces
5. Objets : décorations, accessoires, détails
6. Ambiance : température de couleur, atmosphère
7. Perspective : point de vue, profondeur de champ`;

// ========== PROMPTS VARIANTES DÉCORS ==========
export const DEFAULT_DECOR_VARIANT_PROMPTS = {
  angle2: "Propose un angle très différent et révélateur de ce décor, sans varier la hauteur et l'inclinaison de la caméra.",
  plongee: "Vue en plongée top down de ce décor, avec une assez courte focale pour avoir une vue d'ensemble de ce décor.",
  contrePlongee: "Vue en forte contre plongée, caméra basse et inclinée vers le haut, avec une assez courte focale.",
};

// ========== CONFIGURATION MODÈLES PAR QUALITÉ ==========
// Qualité Élevée : nano-banana-pro ULTRA en 4K
export const DEFAULT_QUALITY_MODEL_CONFIG: QualityModelConfig = {
  textToImage: {
    normal: 'google/nano-banana/text-to-image',
    elevee: 'google/nano-banana-pro/text-to-image-ultra',
  },
  edit: {
    normal: 'google/nano-banana/edit',
    elevee: 'google/nano-banana-pro/edit-ultra',
  },
  eleveeParams: {
    resolution: '4K',
  },
};

// ========== RATIOS PAR TYPE D'IMAGE ==========
export const IMAGE_RATIOS = {
  character: {
    primary: '9:16',    // Image primaire personnage (pied à la tête)
    face: '1:1',        // Visage de face
    profile: '1:1',     // Visage de profil
    back: '9:16',       // Vue de dos
  },
  decor: {
    primary: '16:9',    // Image primaire décor
    angle2: '16:9',     // Nouvel angle
    plongee: '16:9',    // Plongée
    contrePlongee: '16:9', // Contre-plongée
  },
  plan: {
    depart: '21:9',     // Image de départ du plan (cinémascope)
    fin: '21:9',        // Image de fin du plan (cinémascope)
  },
};

// ========== CONFIGURATION COMPLÈTE PAR DÉFAUT ==========
export const DEFAULT_CHARACTER_CONFIG: CharacterPromptConfig = {
  systemPrompt: DEFAULT_CHARACTER_SYSTEM_PROMPT,
  variantPrompts: DEFAULT_CHARACTER_VARIANT_PROMPTS,
};

export const DEFAULT_DECOR_CONFIG: DecorPromptConfig = {
  systemPrompt: DEFAULT_DECOR_SYSTEM_PROMPT,
  variantPrompts: DEFAULT_DECOR_VARIANT_PROMPTS,
};

// ========== HELPERS ==========

/**
 * Retourne le modèle text-to-image selon la qualité
 */
export function getTextToImageModel(quality: QualityLevel, config: QualityModelConfig = DEFAULT_QUALITY_MODEL_CONFIG): string {
  return quality === 'elevee' ? config.textToImage.elevee : config.textToImage.normal;
}

/**
 * Retourne le modèle edit selon la qualité
 */
export function getEditModel(quality: QualityLevel, config: QualityModelConfig = DEFAULT_QUALITY_MODEL_CONFIG): string {
  return quality === 'elevee' ? config.edit.elevee : config.edit.normal;
}

/**
 * Retourne les paramètres additionnels pour qualité élevée
 */
export function getQualityParams(quality: QualityLevel, config: QualityModelConfig = DEFAULT_QUALITY_MODEL_CONFIG): Record<string, string> {
  if (quality === 'elevee') {
    return { resolution: config.eleveeParams.resolution };
  }
  return {};
}

/**
 * Construit le prompt pour l'image primaire d'un personnage
 */
export function buildCharacterPrimaryPrompt(description: string, systemPrompt: string = DEFAULT_CHARACTER_SYSTEM_PROMPT): string {
  // Le préfixe est intégré dans le system prompt
  // L'IA génère le prompt basé sur la description
  return `Crée une image du personnage décrit ci-dessous. Le personnage doit être de face, debout, vu des pieds à la tête sur fond parfaitement gris neutre.\n\n${description}`;
}

/**
 * Construit le prompt pour l'image primaire d'un décor
 */
export function buildDecorPrimaryPrompt(description: string, systemPrompt: string = DEFAULT_DECOR_SYSTEM_PROMPT): string {
  return `Crée une image du décor décrit ci-dessous.\n\n${description}`;
}

