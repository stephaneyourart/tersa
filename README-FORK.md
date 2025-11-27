# TersaFork - Canvas IA Local

Fork de [Tersa](https://www.tersa.ai/) optimisé pour une utilisation **100% locale** avec des fonctionnalités avancées de génération multimédia.

![TersaFork](./app/opengraph-image.png)

## ✨ Nouvelles fonctionnalités

### 🖼️ Canvas Nodal React Flow
- Reliez texte, images, vidéos et sons visuellement
- Drag & drop intuitif
- Prévisualisation en temps réel dans les nœuds

### 🤖 Nouveaux modèles IA via Fal/WaveSpeed
| Type | Modèles |
|------|---------|
| **Vidéo** | Kling 2.5 Turbo/Pro, Pixverse v3.5, Seedream, Mochi, Hunyuan |
| **Image** | Nano Banana Pro, Seedream, Flux (tous), Ideogram v2, Recraft v3 |
| **Audio** | Support à venir |

### 🚀 Batch Processing (N runs parallèles)
- Lancez plusieurs générations en parallèle pour un nœud
- Contrôle de concurrence configurable (1-20 runs simultanés)
- Galerie intégrée pour visualiser tous les résultats
- Historique des jobs avec progression en temps réel

### 💾 Stockage 100% Local
- Plus besoin de Supabase - tout est stocké localement
- PostgreSQL local (ou SQLite optionnel)
- Assets stockés dans un dossier configurable
- API de stockage intégrée pour servir les fichiers

### 📦 Groupement de nœuds
- Créez des templates de chaînes de nœuds
- Dupliquez et réutilisez des sous-graphes
- Import/Export de configurations

## 🛠️ Installation

### Prérequis
- Node.js 20+
- pnpm
- PostgreSQL local (ou Docker)

### Démarrage rapide

```bash
# 1. Cloner le repo
git clone https://github.com/VOTRE_USER/tersafork.git
cd tersafork

# 2. Installer les dépendances
pnpm install

# 3. Initialiser le mode local
pnpm init:local

# 4. Créer la base de données
createdb tersafork

# 5. Lancer les migrations
pnpm migrate:local

# 6. Démarrer en mode local
pnpm dev:local
```

Ouvrez [http://localhost:3000](http://localhost:3000) 🎉

## ⚙️ Configuration

Éditez `.env.local` :

```env
# Mode local activé
LOCAL_MODE=true
LOCAL_USER_ID=local-user-001

# Base de données PostgreSQL locale
POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/tersafork

# Stockage local
LOCAL_STORAGE_PATH=/chemin/vers/votre/dossier/storage

# Batch Processing
BATCH_MAX_CONCURRENCY=10
BATCH_REQUEST_TIMEOUT=300000

# APIs IA
FAL_API_KEY=your_fal_key         # Kling, Pixverse, Flux via Fal
WAVESPEED_API_KEY=your_ws_key    # Seedream, Kling Turbo
OPENAI_API_KEY=sk-your_key       # DALL-E, GPT
```

## 📁 Structure du projet

```
tersafork/
├── app/                    # Routes Next.js App Router
│   └── api/
│       ├── batch/          # API Batch Processing
│       └── storage/        # API Stockage local
├── components/
│   └── nodes/              # Composants des nœuds
│       ├── batch-panel.tsx # Panneau batch
│       └── batch-gallery.tsx # Galerie résultats
├── lib/
│   ├── batch/              # Système de batch
│   ├── models/
│   │   ├── video/
│   │   │   ├── fal.ts      # Provider Fal
│   │   │   └── wavespeed.ts # Provider WaveSpeed
│   │   └── image/
│   │       └── fal.ts      # Images via Fal
│   ├── auth-local.ts       # Auth locale
│   ├── storage-local.ts    # Stockage local
│   └── env-local.ts        # Env simplifié
├── hooks/
│   └── use-batch.ts        # Hook React batch
├── storage/                # Assets générés (gitignored)
└── schema.ts               # Schéma BDD étendu
```

## 🎮 Utilisation du Batch Processing

### Dans un nœud

```tsx
import { BatchPanel } from '@/components/nodes/batch-panel';
import { BatchGallery } from '@/components/nodes/batch-gallery';
import { useBatch } from '@/hooks/use-batch';

function MyVideoNode({ nodeId }) {
  const { 
    startBatch, 
    cancelBatch, 
    successfulResults, 
    progress,
    isRunning 
  } = useBatch({
    nodeId,
    type: 'video',
    onComplete: (results) => console.log('Terminé!', results),
  });

  return (
    <div>
      {/* ... votre UI ... */}
      
      <BatchPanel
        nodeId={nodeId}
        type="video"
        getSettings={() => ({
          prompt: "Un chat qui danse",
          model: "kling-v2.5-pro-fal",
          provider: "fal",
        })}
        onResultsReceived={(results) => {
          // Traiter les résultats
        }}
      />
      
      <BatchGallery results={successfulResults} type="video" />
    </div>
  );
}
```

### Via l'API directement

```bash
# Démarrer un batch
curl -X POST http://localhost:3000/api/batch \
  -H "Content-Type: application/json" \
  -d '{
    "nodeId": "node-1",
    "type": "video",
    "settings": {
      "prompt": "A dancing cat",
      "model": "kling-v2.5-pro-fal",
      "provider": "fal",
      "count": 4,
      "maxConcurrency": 2
    }
  }'

# Vérifier le statut
curl http://localhost:3000/api/batch?jobId=xxx

# Annuler un job
curl -X DELETE http://localhost:3000/api/batch?jobId=xxx
```

## 🎯 Modèles disponibles

### Vidéo
| ID | Nom | Provider |
|----|-----|----------|
| `kling-v2.5-turbo-wavespeed` | Kling 2.5 Turbo | WaveSpeed |
| `kling-v2.5-standard-fal` | Kling 2.5 Standard | Fal |
| `kling-v2.5-pro-fal` | Kling 2.5 Pro | Fal |
| `pixverse-v3.5-t2v` | Pixverse 3.5 T2V | Fal |
| `pixverse-v3.5-i2v` | Pixverse 3.5 I2V | Fal |
| `seedream-v1` | Seedream | WaveSpeed |
| `mochi-v1` | Mochi | Fal |
| `hunyuan-video` | Hunyuan | Fal |

### Image (via Fal)
| ID | Nom |
|----|-----|
| `nano-banana-pro` | Nano Banana Pro (ultra rapide) |
| `seedream` | Seedream |
| `flux-pro` | Flux Pro |
| `flux-schnell` | Flux Schnell |
| `ideogram-v2` | Ideogram v2 |
| `recraft-v3` | Recraft v3 |

## 🔧 Scripts npm

| Commande | Description |
|----------|-------------|
| `pnpm dev:local` | Démarrer en mode local |
| `pnpm init:local` | Initialiser le projet local |
| `pnpm migrate:local` | Lancer les migrations BDD |
| `pnpm build:local` | Build en mode local |

## 📝 Licence

MIT - Basé sur [Tersa](https://github.com/haydenbleasel/tersa) par Hayden Bleasel.

## 🙏 Crédits

- [Tersa](https://www.tersa.ai/) - Le projet original
- [React Flow](https://reactflow.dev/) - Bibliothèque canvas
- [Fal.ai](https://fal.ai/) - API de génération IA
- [WaveSpeed](https://wavespeed.ai/) - API de génération IA

