# Système de Briefs - Documentation

## Vue d'ensemble

Le système de briefs permet de générer automatiquement des projets vidéo complets à partir de documents (textes, PDFs, images, vidéos). L'IA analyse le brief, génère un scénario structuré, puis crée automatiquement tous les médias nécessaires et les envoie vers DaVinci Resolve.

## Architecture

### 1. Création du Brief
**Interface** : `/local/briefs`

L'utilisateur peut :
- Créer un brief avec un nom et une description
- Uploader des documents (textes, PDFs, images, vidéos, audio)
- Voir le compteur de tokens en temps réel
- Estimation du coût basée sur Gemini 3

**Limite** : 2M tokens maximum (limite Gemini)

### 2. Configuration de Génération
**Interface** : `/local/briefs/[id]/generate`

L'utilisateur configure :
- **Nom du projet** : par défaut `[nom du brief] v1`
- **Modèle IA** : Gemini 3 (défaut), Gemini 2 Flash, GPT-4o, Claude 3.5 Sonnet
- **Niveau de raisonnement** : Low, Medium, High
- **Génération automatique** : ☑️ Option pour générer tous les médias directement
  - Modèle d'images : NanoBanana Pro, Flux Pro, DALL-E 3
  - Modèle de vidéos : Kling O1 (défaut), Seedream, Kling Turbo
  - Nombre de copies par vidéo : 1, 2, 4 (défaut), 8
- **System Prompt** : Template par défaut éditable

### 3. Analyse IA
**API** : `/api/ai/analyze-brief`

L'IA analyse le brief et génère un scénario au format JSON avec :

#### Structure du Scénario

```json
{
  "title": "Titre du projet",
  "synopsis": "Résumé du scénario",
  "characters": [
    {
      "name": "Jean",
      "description": "Description complète du personnage",
      "referenceCode": "[PERSO:Jean]",
      "prompts": {
        "face": "Génère une image...",
        "profile": "Génère une image...",
        "fullBody": "Génère une image...",
        "back": "Génère une image..."
      }
    }
  ],
  "locations": [
    {
      "name": "Bureau",
      "description": "Description du lieu",
      "referenceCode": "[LIEU:Bureau]",
      "prompt": "Génère plusieurs angles du lieu..."
    }
  ],
  "scenes": [
    {
      "sceneNumber": 1,
      "title": "Titre de la scène",
      "description": "Description narrative",
      "plans": [
        {
          "planNumber": 1,
          "sceneNumber": 1,
          "prompt": "Prompt EXHAUSTIF et AUTO-SUFFISANT",
          "characters": ["[PERSO:Jean]"],
          "locations": ["[LIEU:Bureau]"],
          "duration": 5,
          "type": "shot"
        }
      ]
    }
  ],
  "totalPlans": 12,
  "estimatedDuration": 60
}
```

### 4. Génération du Projet
**Module** : `lib/brief-generator.ts`

Le générateur :
1. Analyse le brief avec l'IA
2. Crée le projet dans la base de données
3. Génère les nœuds ReactFlow :
   - **Nœuds collections** pour personnages et lieux
   - **Nœuds image** pour générer les visuels
   - **Nœuds vidéo** pour les plans
   - **Edges** reliant les collections aux plans

### 5. Génération Automatique des Médias
**Module** : `lib/auto-media-generator.ts`

Si l'option "Générer les médias directement" est activée :

#### Phase 1 : Images Personnages
- Génère 4 images par personnage (face, profil, corps entier, dos)
- Modèle : NanoBanana Pro (défaut) ou autre

#### Phase 2 : Images Lieux
- Génère plusieurs angles pour chaque lieu
- Modèle : NanoBanana Pro (défaut) ou autre

#### Phase 3 : Collections
- Crée les nœuds collections automatiquement
- Nomme : `Personnage - [Nom]` et `Lieu - [Nom]`
- Associe les images générées

#### Phase 4 : Vidéos
- Pour chaque plan du scénario :
  - Récupère les images des collections référencées
  - Utilise la première image en input
  - Génère N copies (4 par défaut)
  - Modèle : **Kling O1** via WaveSpeed (défaut)

#### Phase 5 : Envoi vers DaVinci Resolve
- Envoie toutes les vidéos vers DVR
- Dossier : `[Titre du projet] - Auto Generated`

## Codes de Référencement

Le système utilise des codes pour lier personnages et lieux aux plans :

- **Personnages** : `[PERSO:NomPersonnage]`
- **Lieux** : `[LIEU:NomLieu]`

Ces codes sont :
1. Générés par l'IA dans le scénario
2. Stockés dans les métadonnées des collections
3. Utilisés pour relier automatiquement les médias aux plans

## Intégration Kling O1

Le modèle **Kling O1** est intégré via WaveSpeed AI :

**Fichier** : `lib/models/video/wavespeed.ts`

```typescript
export const wavespeed = {
  klingO1: (): VideoModel => createWaveSpeedModel('kling-o1'),
  klingO1I2V: (): VideoModel => createWaveSpeedModel('kling-o1-i2v'),
  // ...
};
```

**Endpoints API** :
- Text-to-Video : `kwaivgi/kling-o1-video-edit/text-to-video`
- Image-to-Video : `kwaivgi/kling-o1-video-edit/image-to-video`

## System Prompt

Le system prompt par défaut guide l'IA pour :
1. Identifier les personnages et lieux
2. Générer des prompts AUTO-SUFFISANTS (règle critique)
3. Structurer le scénario en scènes et plans
4. Créer les codes de référencement
5. Respecter le format JSON attendu

**Règle critique** : Chaque prompt de plan doit être EXHAUSTIF. Le modèle de génération n'a PAS accès au contexte global. Il faut décrire QUI, OÙ, QUOI et COMMENT dans chaque prompt.

## Base de Données

### Tables

**`brief`**
- `id`, `name`, `description`, `userId`
- `totalTokens`, `estimatedCost`, `status`
- `createdAt`, `updatedAt`

**`brief_document`**
- `id`, `briefId`, `name`, `type`, `mimeType`
- `size`, `storagePath`, `url`, `content`, `tokens`
- `metadata`, `createdAt`

**`project_generation_config`**
- `id`, `briefId`, `projectId`
- `aiModel`, `reasoningLevel`, `generateMediaDirectly`
- `systemPrompt`, `customInstructions`, `settings`
- `createdAt`

## API Endpoints

### Briefs
- `GET /api/briefs` - Liste tous les briefs
- `POST /api/briefs` - Créer un brief
- `GET /api/briefs/[id]` - Récupérer un brief
- `PATCH /api/briefs/[id]` - Mettre à jour un brief
- `DELETE /api/briefs/[id]` - Supprimer un brief

### Génération
- `POST /api/briefs/generate` - Générer un projet depuis un brief
- `POST /api/ai/analyze-brief` - Analyser un brief avec l'IA

## Variables d'Environnement

```bash
# IA - Analyse de briefs
GOOGLE_AI_API_KEY=          # Pour Gemini
OPENAI_API_KEY=             # Pour GPT-4o
ANTHROPIC_API_KEY=          # Pour Claude

# Génération de médias
WAVESPEED_API_KEY=          # Pour Kling O1, Seedream, etc.
FAL_API_KEY=                # Pour NanoBanana Pro

# DaVinci Resolve
DAVINCI_RESOLVE_ENABLED=true
DAVINCI_DEFAULT_FOLDER="TersaFork"
```

## Flux Utilisateur Complet

1. **Créer un brief** (`/local/briefs/new`)
   - Uploader des documents
   - Vérifier le compteur de tokens

2. **Configurer la génération** (`/local/briefs/[id]/generate`)
   - Choisir le modèle IA
   - Activer la génération automatique
   - Configurer les modèles de médias

3. **Générer le projet**
   - L'IA analyse et génère le scénario
   - Le projet est créé avec tous les nœuds
   - Si activé : génération automatique des médias

4. **Résultat**
   - Projet complet dans `/local/projects/[projectId]`
   - Images et vidéos générées automatiquement
   - Vidéos envoyées vers DaVinci Resolve

## Best Practices

### Pour les Briefs
- Fournir des documents clairs et structurés
- Inclure des références visuelles si possible
- Rester sous la limite de 2M tokens

### Pour les Prompts
- L'IA génère des prompts AUTO-SUFFISANTS
- Chaque plan décrit complètement la scène
- Pas de référence au contexte global

### Pour la Génération
- Utiliser Gemini 3 pour l'équilibre coût/qualité
- Niveau Medium pour la plupart des cas
- Kling O1 recommandé pour les vidéos (qualité supérieure)
- 4 copies par vidéo pour avoir du choix

## Limitations

- **Tokens** : Maximum 2M tokens par brief (Gemini)
- **Temps** : Génération automatique peut prendre 30+ minutes
- **Coûts** : Dépend du nombre de plans et des modèles choisis
- **DVR** : Nécessite DaVinci Resolve installé et configuré

## Support

Pour toute question ou problème :
1. Vérifier les logs du serveur
2. Consulter les erreurs dans la console navigateur
3. Vérifier les clés API dans `.env.local`

