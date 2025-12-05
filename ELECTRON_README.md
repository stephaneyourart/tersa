# 🖥️ Media Conductor — Version Desktop (Electron)

> Cette branche contient la configuration pour builder Media Conductor en application desktop.

## 📋 Status

**Branche**: `feature/desktop-app`  
**Status**: 🚧 En développement

## 🚀 Démarrage Rapide

### Prérequis

```bash
# S'assurer d'être sur la bonne branche
git checkout feature/desktop-app

# Installer les dépendances (inclut Electron)
pnpm install
```

### Développement

```bash
# Terminal 1: Lancer Next.js
pnpm dev:local

# Terminal 2: Lancer Electron (une fois Next.js démarré)
pnpm electron:dev
```

### Build

```bash
# Build pour la plateforme courante
pnpm electron:build

# Build spécifique
pnpm electron:build:mac
pnpm electron:build:win
pnpm electron:build:linux
```

## 📁 Structure des fichiers Electron

```
electron/
├── main.ts           # Process principal Electron
├── preload.ts        # Bridge sécurisé (contextBridge)
├── types.d.ts        # Types TypeScript pour l'API
├── ipc/              # Handlers IPC (à implémenter)
│   ├── filesystem.ts
│   ├── davinci.ts
│   └── license.ts
└── utils/
    └── paths.ts

resources/            # Assets pour le packaging
├── icon.icns         # Icône macOS
├── icon.ico          # Icône Windows
└── icons/            # Icônes Linux (différentes tailles)

electron-builder.yml  # Configuration du builder
```

## 🔌 API Electron côté React

```typescript
import { useElectron } from '@/hooks/use-electron';

function MyComponent() {
  const { isElectron, api } = useElectron();

  if (!isElectron) {
    // Version web - comportement standard
    return <WebVersion />;
  }

  // Version desktop - accès aux APIs natives
  const handleSelectFolder = async () => {
    const folder = await api.selectFolder();
    console.log('Dossier sélectionné:', folder);
  };

  return <DesktopVersion onSelectFolder={handleSelectFolder} />;
}
```

## ✅ Checklist d'implémentation

### Phase 1 - Configuration de base
- [x] Structure dossiers Electron
- [x] main.ts (process principal)
- [x] preload.ts (bridge API)
- [x] electron-builder.yml
- [x] Hook useElectron
- [ ] Ajouter dépendances Electron au package.json
- [ ] Scripts npm (electron:dev, electron:build)
- [ ] Test dev mode

### Phase 2 - Releases
- [ ] GitHub Actions workflow
- [ ] Test build macOS
- [ ] Test build Windows
- [ ] Test build Linux

### Phase 3 - Licences
- [ ] Schema base de données
- [ ] API validation
- [ ] Service client Electron
- [ ] UI d'activation

## 🔄 Synchronisation avec main

```bash
# Récupérer les dernières modifications de main
git fetch origin main
git rebase origin/main

# En cas de conflits, les résoudre puis:
git rebase --continue
```

## ⚠️ Notes importantes

1. **Cette branche ne doit PAS être mergée sur main** tant que le développement n'est pas terminé
2. Les fichiers `electron/` et `electron-builder.yml` n'existent que sur cette branche
3. L'app web continue de fonctionner normalement sur `main`
