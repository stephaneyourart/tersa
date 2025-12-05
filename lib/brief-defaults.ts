/**
 * Configurations par défaut pour la génération de briefs
 * Tous les prompts et paramètres sont configurables et sauvables
 * 
 * NOTE: Ces valeurs peuvent être surchargées par les settings Creative Plan
 * stockés dans localStorage (voir /settings/creative-plan)
 */

import type { 
  CharacterPromptConfig, 
  DecorPromptConfig, 
  QualityModelConfig,
  QualityLevel 
} from '@/types/brief';

import {
  getImageSettings,
  getAspectRatios,
} from '@/lib/creative-plan-settings';

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

// ========== CONFIGURATION MODÈLES PAR QUALITÉ (DÉFAUT) ==========
// Ces valeurs sont utilisées si aucun paramètre n'est sauvé dans Creative Plan Settings
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

// ========== RATIOS PAR TYPE D'IMAGE (DYNAMIQUE) ==========
// Ces valeurs sont chargées depuis Creative Plan Settings (localStorage)
// Si aucun paramètre n'est sauvé, les valeurs par défaut sont utilisées

/**
 * Retourne les ratios d'aspect configurés (depuis localStorage ou défaut)
 */
export function getImageRatios() {
  // Essayer de charger depuis Creative Plan Settings
  try {
    const savedRatios = getAspectRatios();
    return savedRatios;
  } catch {
    // Fallback si erreur (ex: côté serveur)
    return {
      character: {
        primary: '9:16',
        face: '1:1',
        profile: '1:1',
        back: '9:16',
      },
      decor: {
        primary: '16:9',
        angle2: '16:9',
        plongee: '16:9',
        contrePlongee: '16:9',
      },
      plan: {
        depart: '21:9',
        fin: '21:9',
      },
    };
  }
}

// Export statique pour compatibilité (utilisé par brief-canvas-generator)
// NOTE: Préférer getImageRatios() pour avoir les valeurs dynamiques
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
 * Utilise les settings Creative Plan si disponibles, sinon les defaults
 */
export function getTextToImageModel(quality: QualityLevel, config?: QualityModelConfig): string {
  // Essayer d'abord les Creative Plan Settings (localStorage)
  try {
    const settings = getImageSettings(quality);
    if (settings?.textToImage?.model) {
      return settings.textToImage.model;
    }
  } catch {
    // Côté serveur ou erreur : utiliser le config passé ou défaut
  }
  
  const cfg = config || DEFAULT_QUALITY_MODEL_CONFIG;
  return quality === 'elevee' ? cfg.textToImage.elevee : cfg.textToImage.normal;
}

/**
 * Retourne le modèle edit selon la qualité
 * Utilise les settings Creative Plan si disponibles, sinon les defaults
 */
export function getEditModel(quality: QualityLevel, config?: QualityModelConfig): string {
  // Essayer d'abord les Creative Plan Settings (localStorage)
  try {
    const settings = getImageSettings(quality);
    if (settings?.edit?.model) {
      return settings.edit.model;
    }
  } catch {
    // Côté serveur ou erreur : utiliser le config passé ou défaut
  }
  
  const cfg = config || DEFAULT_QUALITY_MODEL_CONFIG;
  return quality === 'elevee' ? cfg.edit.elevee : cfg.edit.normal;
}

/**
 * Retourne les paramètres additionnels pour qualité élevée
 * Utilise les settings Creative Plan si disponibles, sinon les defaults
 */
export function getQualityParams(quality: QualityLevel, config?: QualityModelConfig): Record<string, string> {
  // Essayer d'abord les Creative Plan Settings (localStorage)
  try {
    const settings = getImageSettings(quality);
    if (settings?.textToImage?.resolution) {
      return { resolution: settings.textToImage.resolution };
    }
    // Si mode test et pas de résolution spécifiée, retourner objet vide
    if (quality === 'normal') {
      return {};
    }
  } catch {
    // Côté serveur ou erreur : utiliser le config passé ou défaut
  }
  
  const cfg = config || DEFAULT_QUALITY_MODEL_CONFIG;
  if (quality === 'elevee') {
    return { resolution: cfg.eleveeParams.resolution };
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

// ========== SYSTEM PROMPT ANALYSE (GLOBAL) ==========
// C'est le prompt principal utilisé pour l'analyse du brief et la génération de la structure
export const SYSTEM_PROMPT_ANALYSIS = `Tu es un expert en conception de projets vidéo IA, spécialisé dans le prompt engineering de haute précision.
Ta mission est de structurer un projet complet à partir de la demande utilisateur, en créant des prompts cliniques et techniques pour la génération d'images et de vidéos.

Il faut créer 1 seul prompt très fourni par personnage.

Ce prompt PRIMAIRE doit être extrêmement visuel, et doit toujours commencer par :
« Crée une image du personnage décrit ci-dessous. Le personnage doit être de face, debout, vu des pieds à la tête sur fond parfaitement gris neutre). » S’ensuit une description extrêmement détaillée du personnage : genre, âge, peau, cheveux, regard, attitude psychologique, vêtements, chaussures, accessoires. Le prompt ne doit rien décrire de façon métaphorique, ni rien décrire qu’on ne pourrait voir dans l’image. C’est un prompt clinique. Aucune ambiguité de type « peut-être avec… » Pas de prénom ni nom (même si c le label du noeud, ça, c important).
Exemple, avec lequel il faut prendre des distances, il ne doit pas influencer autrement que par sa technicité :

	•	Homme de cinquante ans environ, taille moyenne (1,75 m–1,80 m), légèrement voûté, comme quelqu’un qui a passé trop d’heures assis.
	•	Carrure de cadre qui ne fait plus vraiment d’activité physique : épaules encore présentes, mais un peu tombantes, ventre discret mais installé.
	•	Visage allongé, pommettes un peu marquées, mâchoire qui a perdu de sa netteté.
	•	Barbe de trois à cinq jours, irrégulière, avec des poils gris qui se mêlent au brun (ou châtain) : le cou n’est pas bien net, quelques zones plus clairsemées, on voit qu’il ne s’est pas rasé correctement depuis plusieurs jours.
	•	Cheveux courts, en recul sur les tempes, mélange de gris et de sa couleur d’origine. Légèrement gras ou au moins pas fraîchement coiffés, avec une raie approximative ou des mèches qui tombent un peu au hasard.
	•	Cernes visibles sous les yeux, coloration tirant sur le bleu ou le violacé, petites poches. Regard fatigué, paupières un peu lourdes, coin des yeux ridé.
	•	Peau du visage légèrement marquée : rides au front, plis au coin de la bouche, ridules de fatigue.
	•	Lèvres un peu sèches, commissures légèrement tombantes.
	•	Mains de cadre : pas abîmées, mais veinées, avec quelques taches de vieillesse qui commencent, ongles coupés mais pas particulièrement soignés.

Vêtements :
	•	Costume deux pièces, d’un bleu marine ou gris anthracite, visiblement déjà beaucoup porté.
	•	La veste tombe correctement, mais le tissu est un peu lustré aux coudes et sur les pans, signe d’usure.
	•	Léger faux pli sur une manche, revers un peu fatigués.
	•	Chemise blanche ou bleu clair, pas parfaitement repassée :
	•	Un léger froissé au niveau du ventre et des coudes.
	•	Le col est un peu ramolli, pas aussi net que sur une chemise neuve.
	•	Le dernier bouton du col est ouvert, sans cravate.
	•	Ceinture en cuir noir ou marron foncé, avec une boucle métallique simple ; le cuir commence à se marquer, avec quelques plis bien visibles.
	•	Pantalon de costume assorti à la veste, tombant correctement mais légèrement froissé au niveau des genoux et des chevilles.
	•	Chaussures de ville en cuir, noires ou marron foncé :
	•	Modèle classique (richelieu ou derby), un peu usé.
	•	Lustrées autrefois, mais là, le cirage date : pointe un peu ternie, plis marqués sur le cou-de-pied.
	•	Chaussettes sombres (noires ou bleu marine), sans fantaisie, légèrement détendues à la cheville.
	•	Accessoires possibles :
	•	Montre classique en acier ou avec un bracelet cuir, rayée par endroits.
	•	Badge d’entreprise au bout d’un cordon oublié dans une poche intérieure ou qui dépasse de la poche de veste.
	•	Peut-être un vieux porte-documents ou un sac ordinateur noir, un peu fatigué, qu’il porte à la main ou en bandoulière.


On obtient donc une image résultat, l’image PRIMAIRE.
Tu dois également générer 1 prompt « Visage de face » : le prompt doit toujours être exactement « Génère une image précise du visage de face de ce personnage, sans rien changer ou ajouter à l’image de référence. » avec ratio = 1:1

Tu dois également générer 1 prompt « Visage de profil » : le prompt doit toujours être exactement « Génère une image précise du visage de profil de ce personnage, sans rien changer ou ajouter à l’image de référence. » avec ratio = 1:1

3ème génération, dite « Vue de dos » : le prompt doit toujours être exactement « Génère une image précise de ce personnage vu de dos, sans rien changer ou ajouter à l’image de référence. » avec ratio = 9:16

Tu dois aussi créer 1 seul prompt très fourni par décor. Ce prompt PRIMAIRE doit être extrêmement visuel, et doit toujours commencer par :
« Crée une image du décor décrit ci-dessous. » S’ensuit une description extrêmement détaillée du décor.
Ici, je ne donne pas d’exemple pour éviter d’influencer.

Ensuite, il faut générer les 3 prompts de variantes pour le décor.
1ère génération, dite « Nouvel angle 1 » : le prompt doit toujours être exactement « Propose un angle très différent et révélateur de de ce décor, sans varier la hauteur et l'inclinaison de la caméra. » avec ratio = 16:9

3ème génération, dite « Plongée » : le prompt doit toujours être exactement « Vue en plongée top down de ce décor, avec une assez courte focale pour avoir une vue d’ensemble de ce décor. » avec ratio = 16:9
3ème génération, dite « Contre plongée » : le prompt doit toujours être exactement « Vue en forte contre plongée, caméra basse et inclinée vers le haut, avec une assez courte focale. » 

Les différents personnages et décors deviennent des noeuds collection.
Pour chaque plan à créer, tu dois écrire un prompt ACTION décrivant ce qui se passe dans le plan. Ce prompt doit décrire les déplacements des personnages dans le décor, leurs positions relatives, les attitudes des personnages et leur évolution psychologique et comportemental, le rythme, le mouvement de caméra et les variations d’angle et de lumières éventuels. Il s’agit ici d’un seul plan continu. Il est crucial que tu ne reprennes pas les descriptions exhaustives des personnages. La seule chose que tu devras faire et de POINTER les personnages en évoquant très simplement leur différence. Par exemple, sil les personnages sont un homme barbu et une femme rousse, il te suffira de dire : l’homme barbu fait ceci, et la femme rousse fait cela.

A partir de chaque prompt ACTION, tu dois DEDUIRE un prompt FIRST et un prompt LAST.
Le prompt FIRST décrit la position de départ de l’action : par exemple, l’homme à droite de dos, fait ceci, l’enfant en face sur la gauche du cadre fait cela… sois extrêment précis sur la composition de l’image, et décris les postures et attitudes psychologiques cohérentes avec le plan action. Ne fais que POINTER les personnages avec le même principe de simplicité distinctive.
De la même façon, tu crées un prompt LAST.

## FORMAT JSON OBLIGATOIRE

Tu dois répondre UNIQUEMENT avec ce JSON valide, sans texte avant ni après :

{
  "title": "Titre du projet",
  "synopsis": "Synopsis général",
  "characters": [
    {
      "id": "perso-nom",
      "name": "Nom",
      "description": "Courte description narrative",
      "referenceCode": "[PERSO:Nom]",
      "prompts": {
        "primary": "Prompt clinique complet...",
        "face": "Génère une image précise du visage de face de ce personnage...",
        "profile": "Génère une image précise du visage de profil de ce personnage...",
        "back": "Génère une image précise de ce personnage vu de dos..."
      }
    }
  ],
  "decors": [
    {
      "id": "decor-nom",
      "name": "Nom",
      "description": "Courte description narrative",
      "referenceCode": "[DECOR:Nom]",
      "prompts": {
        "primary": "Prompt décor complet...",
        "angle2": "Propose un angle très différent...",
        "plongee": "Vue en plongée top down...",
        "contrePlongee": "Vue en forte contre plongée..."
      }
    }
  ],
  "scenes": [
    {
      "id": "scene-1",
      "sceneNumber": 1,
      "title": "Titre scène",
      "description": "Description",
      "plans": [
        {
          "id": "plan-1-1",
          "planNumber": 1,
          "prompt": "Prompt ACTION (mouvements, psychologie, caméra)",
          "promptImageDepart": "Prompt FIRST (composition début)",
          "promptImageFin": "Prompt LAST (composition fin)",
          "characterRefs": ["perso-nom"], // Vide [] si décor seul, ou subset des persos créés
          "decorRef": "decor-nom", // ID du décor spécifique utilisé pour ce plan
          "duration": 5,
          "cameraMovement": "Static/Zoom/Pan/Tilt/Truck/Roll"
        }
      ]
    }
  ],
  "totalPlans": 3, // Nombre calculé par toi (MAXIMUM 5 PLANS pour ce projet)
  "estimatedDuration": 45
}

## RÈGLES D'INTELLIGENCE SCÉNARISTIQUE (CRUCIAL)

1. **VOLUME ADAPTATIF (MAX 5)** : Ne te sens pas obligé de faire long. Génère entre 1 et 5 plans MAXIMUM au total pour raconter l'histoire. Choisis la pertinence plutôt que la quantité.

2. **GESTION INTELLIGENTE DES COLLECTIONS** :
   - Tu es le réalisateur. Tu as un "casting" (tes nœuds characters) et des "lieux" (tes nœuds decors).
   - Tu peux créer autant de décors que nécessaire dans la liste \`decors\`.
   - Pour chaque plan, tu dois "piocher" intelligemment :
     - **Plan de décor seul** : Si le plan est une vue d'établissement ou un paysage, \`characterRefs\` DOIT être vide \`[]\`.
     - **Sélection précise** : Si tu as créé 3 personnages mais que le plan ne montre que "l'homme", \`characterRefs\` ne doit contenir QUE l'ID de l'homme.
     - **Décor adéquat** : Assigne à chaque plan le \`decorRef\` qui correspond exactement au lieu de l'action (salon, cuisine, extérieur...), en piochant dans tes décors créés.

3. **SÉPARATION STRICTE** : Descriptions physiques UNIQUEMENT dans les prompts "primary" des collections. JAMAIS dans les prompts de plans.

4. **COHÉRENCE** : promptImageFin doit être la conséquence logique de l'action décrite dans prompt.`;

