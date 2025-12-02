export type HelpArticle = {
  id: string;
  title: string;
  category: string;
  tags: string[];
  content: string; // Markdown supported
};

export const HELP_CONTENT: HelpArticle[] = [
  // ==================== 🚀 DÉMARRER ====================
  {
    id: "create-project",
    title: "Comment créer un projet ?",
    category: "🚀 Démarrer",
    tags: ["nouveau", "projet", "création", "vide"],
    content: `
# Créer un nouveau projet

1. Cliquez sur le sélecteur de projet en **haut à gauche** (là où le nom du projet actuel est affiché).
2. Sélectionnez **"Nouveau Projet"** dans le menu déroulant.
3. Donnez un nom à votre projet.
4. Validez.

Un nouveau canvas vide s'ouvre immédiatement.
    `
  },
  {
    id: "auto-save",
    title: "Dois-je sauvegarder manuellement ?",
    category: "🚀 Démarrer",
    tags: ["sauvegarde", "save", "automatique"],
    content: `
# Sauvegarde Automatique

Non, vous n'avez rien à faire. Media Conductor sauvegarde **chaque action** en temps réel.

- Un indicateur "Sauvegardé" apparaît en haut à droite.
- Si vous quittez brutalement, vous retrouverez votre projet exactement dans le même état.
    `
  },

  // ==================== 🎨 CANVAS & NŒUDS ====================
  {
    id: "add-node",
    title: "Comment ajouter un nœud ?",
    category: "🎨 Canvas",
    tags: ["ajouter", "nœud", "node", "créer"],
    content: `
# 3 Méthodes pour ajouter un nœud

1. **Double-clic** sur le fond du canvas : Ouvre la recherche rapide.
2. **Clic Droit** sur le fond : Ouvre le menu contextuel complet.
3. **Barre d'outils** (bas de l'écran) : Glissez-déposez ou cliquez sur les icônes.
    `
  },
  {
    id: "view-project-assets",
    title: "Où voir tous les éléments de mon projet ?",
    category: "🎨 Canvas",
    tags: ["assets", "médias", "fichiers", "liste"],
    content: `
# Voir tous les éléments

1. Ouvrez le panneau latéral **gauche**.
2. Cliquez sur l'onglet **"Médias"** (icône dossier).
3. Vous verrez la liste de tous les fichiers importés et générés dans ce projet.

💡 **Astuce** : Utilisez le raccourci \`Cmd + Shift + M\` pour ouvrir/fermer ce panneau rapidement.
    `
  },
  {
    id: "connect-nodes",
    title: "Comment fonctionnent les liens (connexions) ?",
    category: "🎨 Canvas",
    tags: ["lien", "connecter", "câble", "flux"],
    content: `
# Connecter des nœuds

Les connexions définissent le flux de données.

1. **Tirez un câble** depuis une poignée de sortie (cercle à droite d'un nœud).
2. **Relâchez** sur une poignée d'entrée compatible (cercle à gauche).

### Code Couleur
- 🟢 **Vert** : Image
- 🔵 **Bleu** : Vidéo
- 🟡 **Jaune** : Texte
- 🟣 **Violet** : Audio

⚠️ Vous ne pouvez pas connecter des types incompatibles (ex: Texte vers Entrée Image).
    `
  },
  {
    id: "group-nodes",
    title: "Comment grouper des éléments ?",
    category: "🎨 Canvas",
    tags: ["groupe", "organiser", "cadre"],
    content: `
# Créer un Groupe

1. Sélectionnez plusieurs nœuds (rectangle de sélection ou Shift+Clic).
2. Faites un **Clic Droit** sur la sélection.
3. Choisissez **"Créer un groupe"**.

Un cadre coloré apparaît. Vous pouvez :
- Renommer le groupe (double-clic sur le titre).
- Changer sa couleur.
- Déplacer tout le groupe d'un coup.
    `
  },

  // ==================== 🤖 GÉNÉRATION & MODÈLES ====================
  {
    id: "change-model",
    title: "Comment changer de modèle de génération ?",
    category: "🤖 Génération",
    tags: ["modèle", "ia", "changer", "flux", "luma"],
    content: `
# Changer le Modèle IA

1. Sélectionnez le nœud de génération (ex: "Text to Image").
2. Dans le panneau de droite (Propriétés), localisez le menu déroulant tout en haut.
3. Cliquez pour voir la liste des modèles disponibles (Flux Schnell, Dev, Pro, etc.).

**Lequel choisir ?**
- **Schnell** : Pour itérer rapidement (3s).
- **Dev** : Le meilleur rapport qualité/vitesse (standard).
- **Pro** : Pour le rendu final haute définition.
    `
  },
  {
    id: "batch-generation",
    title: "Comment lancer un Batch (plusieurs images) ?",
    category: "🤖 Génération",
    tags: ["batch", "masse", "parallèle", "dupliquer"],
    content: `
# Mode Batch Manuel

1. Configurez un nœud de génération comme vous le souhaitez.
2. Dupliquez-le (\`Cmd+D\`) autant de fois que nécessaire.
3. (Optionnel) Modifiez le prompt ou la seed de chaque copie.
4. Sélectionnez TOUS les nœuds.
5. Cliquez sur le bouton **"Générer"** qui apparaît dans la toolbar flottante.

Tous les nœuds se lanceront en parallèle ! 🚀
    `
  },
  {
    id: "video-generation",
    title: "Comment générer une vidéo ?",
    category: "🤖 Génération",
    tags: ["video", "animation", "luma", "runway"],
    content: `
# Génération Vidéo

1. Ajoutez un nœud **"Image to Video"** (si vous partez d'une image) ou **"Text to Video"**.
2. Connectez votre source (Image ou Texte).
3. Sélectionnez le modèle (Luma Ray, Runway Gen-3...).
4. Cliquez sur **Générer**.

⏳ **Note** : La vidéo est beaucoup plus longue à générer (1-3 minutes).
    `
  },

  // ==================== 📦 COLLECTIONS (AVANCÉ) ====================
  {
    id: "collections-usage",
    title: "Comment utiliser les Collections ?",
    category: "📦 Collections",
    tags: ["collection", "preset", "bibliothèque", "template"],
    content: `
# Les Collections

Les Collections sont des "super-groupes" sauvegardables.

### Créer une Collection
1. Sélectionnez un ensemble de nœuds.
2. Clic droit -> **"Créer une Collection"**.
3. Elle est sauvegardée dans votre bibliothèque.

### Utiliser une Collection
1. Ouvrez la bibliothèque (Barre d'outils -> Icône Bibliothèque).
2. Cliquez sur une collection pour l'importer dans votre canvas.

### Presets de Collection
Dans un nœud Collection, vous pouvez définir des **Presets** :
- Ce sont des configurations de "Quels items sont actifs/inactifs".
- Utile pour switcher rapidement entre plusieurs versions d'un même set d'assets.
    `
  },

  // ==================== 🎬 DAVINCI RESOLVE (PRO) ====================
  {
    id: "davinci-setup",
    title: "Comment configurer le pont DaVinci Resolve ?",
    category: "🎬 DaVinci",
    tags: ["davinci", "resolve", "bridge", "python"],
    content: `
# Intégration DaVinci Resolve

Media Conductor peut envoyer des médias directement dans votre projet Resolve ouvert.

### Pré-requis
1. DaVinci Resolve Studio doit être installé et **ouvert**.
2. Le scripting externe doit être activé dans Resolve (Preferences -> System -> General -> External Scripting -> Local).

### Utilisation
1. Dans Media Conductor, sélectionnez une image ou vidéo.
2. Clic droit -> **"Envoyer vers DaVinci"**.
3. Le média apparaîtra dans le Media Pool de votre projet actif.

💡 **Note Technique** : Media Conductor utilise un script Python bridge local. Si cela ne fonctionne pas, vérifiez que votre installation Python est accessible.
    `
  },

  // ==================== ⌨️ RACCOURCIS & ASTUCES ====================
  {
    id: "shortcuts-list",
    title: "Liste des Raccourcis Clavier",
    category: "⌨️ Raccourcis",
    tags: ["clavier", "hotkeys", "vitesse"],
    content: `
# Raccourcis Essentiels

| Action | Mac | Windows |
|--------|-----|---------|
| **Tout sélectionner** | Cmd + A | Ctrl + A |
| **Dupliquer** | Cmd + D | Ctrl + D |
| **Copier** | Cmd + C | Ctrl + C |
| **Coller** | Cmd + V | Ctrl + V |
| **Supprimer** | Backspace | Suppr |
| **Zoom 100%** | Double-clic fond | Double-clic fond |
| **Focus sur sélection** | F | F |
| **Toggle Media Library** | Cmd + Shift + M | Ctrl + Shift + M |
| **Aide** | ? | ? |
    `
  },
  {
    id: "missing-nodes",
    title: "Je ne trouve pas mes nœuds (Écran noir)",
    category: "🆘 Dépannage",
    tags: ["perdu", "vide", "noir", "zoom"],
    content: `
# Retrouver ses nœuds

Si vous êtes perdu dans le canvas infini :

1. Appuyez sur la touche **F** (Focus). Cela vous ramènera immédiatement sur vos nœuds.
2. Sinon, **double-cliquez** sur le fond pour réinitialiser la vue au centre (0,0).
    `
  }
];
