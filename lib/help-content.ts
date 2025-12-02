export type HelpArticle = {
  id: string;
  title: string;
  category: string;
  tags: string[];
  content: string; // Markdown supported
};

export const HELP_CONTENT: HelpArticle[] = [
  // --- Section: Premiers Pas ---
  {
    id: "getting-started",
    title: "Premiers Pas",
    category: "Général",
    tags: ["intro", "débuter", "bienvenue", "interface"],
    content: `
# Bienvenue sur Tersa

Tersa est une plateforme de création visuelle assistée par IA. Elle combine la puissance des modèles génératifs avec une interface intuitive basée sur des nœuds.

## L'Interface Principale

L'interface se compose de trois zones principales :
1. **Le Canvas (Centre)** : C'est votre espace de travail infini où vous déposez et connectez vos nœuds.
2. **La Barre d'Outils (Bas)** : Accès rapide aux outils de sélection, de création de nœuds et aux paramètres.
3. **Les Panneaux Latéraux** : Pour gérer vos projets, vos médias et les paramètres détaillés des nœuds.

## Concept de Base

Tout fonctionne par **Flux (Flow)**. Vous créez une chaîne d'opérations :
- Une source (ex: un texte, une image).
- Un traitement (ex: un modèle IA, un filtre).
- Une sortie (ex: image générée, vidéo).

Connectez ces éléments entre eux pour créer votre pipeline de création.
    `
  },
  {
    id: "projects-management",
    title: "Gestion des Projets",
    category: "Général",
    tags: ["sauvegarde", "nouveau", "projet", "dossier"],
    content: `
# Gérer vos Projets

Tous vos travaux sont organisés en projets.

## Créer un nouveau projet
Cliquez sur le sélecteur de projet en haut à gauche et choisissez "Nouveau Projet".

## Sauvegarde
La sauvegarde est **automatique** pour les projets stockés localement. Vous verrez un indicateur "Sauvegardé" en haut de l'écran.

## Organisation
Vous pouvez renseigner des métadonnées pour vos projets afin de les retrouver plus facilement.
    `
  },

  // --- Section: Le Canvas ---
  {
    id: "canvas-navigation",
    title: "Naviguer dans le Canvas",
    category: "Interface",
    tags: ["zoom", "pan", "déplacement", "vue"],
    content: `
# Navigation

Se déplacer dans l'espace infini est simple :

- **Pan (Déplacement)** : Maintenez \`Espace\` + Clic Gauche et glissez, ou utilisez le Clic Molette.
- **Zoom** : Utilisez la molette de la souris ou les raccourcis \`Cmd/Ctrl +\` et \`Cmd/Ctrl -\`.
- **Centrer** : Double-cliquez sur le fond pour réinitialiser la vue, ou sélectionnez un nœud et appuyez sur \`F\` pour faire le focus dessus.
    `
  },
  {
    id: "nodes-interaction",
    title: "Utiliser les Nœuds",
    category: "Interface",
    tags: ["connecter", "créer", "lien", "supprimer"],
    content: `
# Les Nœuds (Nodes)

Les nœuds sont les briques de base de Tersa.

## Ajouter un Nœud
Faites un Clic Droit n'importe où sur le canvas pour ouvrir le menu contextuel et choisir un nœud à ajouter.

## Connecter des Nœuds
Tirez un câble depuis la poignée (le petit rond coloré) d'un nœud vers la poignée d'entrée d'un autre nœud.
- **Vert** : Image
- **Bleu** : Vidéo
- **Jaune** : Texte / Prompt

Si les couleurs correspondent, la connexion est valide.

## Supprimer
Sélectionnez un nœud ou un câble et appuyez sur \`Suppr\` ou \`Backspace\`.
    `
  },

  // --- Section: Génération ---
  {
    id: "image-generation",
    title: "Générer des Images",
    category: "Fonctionnalités",
    tags: ["flux", "schnell", "pro", "prompt"],
    content: `
# Génération d'Images

Tersa intègre les derniers modèles Flux (Schnell, Dev, Pro).

1. Ajoutez un nœud **"Text to Image"**.
2. Entrez votre description dans le champ "Prompt".
3. Connectez éventuellement une image de référence si vous utilisez un mode "Image to Image".
4. Cliquez sur le bouton "Play" ou "Générer" sur le nœud.

## Paramètres Avancés
Sélectionnez le nœud pour voir apparaître le panneau de droite. Vous pourrez y régler :
- La résolution (Largeur / Hauteur)
- Le nombre d'étapes (Steps)
- Le Guidance Scale
- La Seed (Graine aléatoire)
    `
  },
    {
    id: "video-generation",
    title: "Générer des Vidéos",
    category: "Fonctionnalités",
    tags: ["luma", "runway", "kling", "motion"],
    content: `
# Génération Vidéo

Vous pouvez animer des images existantes ou créer des vidéos à partir de texte.

1. Utilisez un nœud **"Image to Video"**.
2. Connectez une image en entrée.
3. Réglez les paramètres de mouvement dans le panneau latéral.
4. Lancez la génération.

Note : La génération vidéo peut prendre plus de temps que les images.
    `
  },
    {
    id: "upscaling",
    title: "Upscaling & Amélioration",
    category: "Fonctionnalités",
    tags: ["hd", "résolution", "agrandir", "détails"],
    content: `
# Upscaling

Pour améliorer la qualité d'une image générée :
1. Connectez la sortie de votre image à un nœud **"Upscale"**.
2. Choisissez le facteur d'agrandissement (x2, x4).
3. Le modèle va halluciner des détails pour rendre l'image nette à haute résolution.
    `
  },

  // --- Section: Workflow Avancé ---
  {
    id: "keyboard-shortcuts",
    title: "Raccourcis Clavier",
    category: "Avancé",
    tags: ["clavier", "raccourcis", "hotkeys", "vitesse"],
    content: `
# Raccourcis Essentiels

| Action | Raccourci (Mac) | Raccourci (Win/Linux) |
|--------|-----------------|-----------------------|
| Copier | Cmd + C | Ctrl + C |
| Coller | Cmd + V | Ctrl + V |
| Dupliquer | Cmd + D | Ctrl + D |
| Supprimer | Backspace | Suppr |
| Tout sélectionner | Cmd + A | Ctrl + A |
| Annuler | Cmd + Z | Ctrl + Z |
| Rétablir | Cmd + Shift + Z | Ctrl + Y |
| Recherche | Cmd + K | Ctrl + K |
| Aide | ? | ? |
    `
  }
];

