# 🖥️ Media Conductor — Plan de Distribution Desktop

> **Objectif** : Transformer Media Conductor en application desktop installable avec système de releases et codes de test.

---

## 📋 Vue d'ensemble

| Phase | Description | Durée estimée | Dépendances |
|-------|-------------|---------------|-------------|
| **Phase 1** | Configuration Electron + Packaging | 2 semaines | - |
| **Phase 2** | Pipeline de Releases | 1 semaine | Phase 1 |
| **Phase 3** | Système de Licences/Codes Test | 2 semaines | Phase 1 |
| **Phase 4** | Tests & Polish | 1 semaine | Phases 1-3 |

**Durée totale estimée : 6 semaines**

---

## 🔷 Phase 1 : Application Desktop (Electron)

### 1.1 Configuration initiale (3-4 jours)

#### Tâches

- [ ] **1.1.1** Installer les dépendances Electron
  ```bash
  pnpm add -D electron electron-builder concurrently wait-on
  pnpm add electron-serve electron-store
  ```

- [ ] **1.1.2** Créer la structure de fichiers Electron
  ```
  electron/
  ├── main.ts           # Process principal
  ├── preload.ts        # Bridge sécurisé renderer ↔ main
  ├── ipc/
  │   ├── handlers.ts   # Gestionnaires IPC
  │   ├── filesystem.ts # Opérations fichiers
  │   └── davinci.ts    # Bridge DaVinci Resolve
  └── utils/
      └── paths.ts      # Gestion des chemins (app, userData, etc.)
  ```

- [ ] **1.1.3** Configurer `electron-builder.yml`
  ```yaml
  appId: com.mediaconductor.app
  productName: Media Conductor
  
  directories:
    output: dist-electron
    buildResources: resources
  
  files:
    - .next/**/*
    - electron/**/*
    - package.json
  
  mac:
    category: public.app-category.video
    target:
      - dmg
      - zip
    icon: resources/icon.icns
    hardenedRuntime: true
    
  win:
    target:
      - nsis
      - portable
    icon: resources/icon.ico
    
  linux:
    target:
      - AppImage
      - deb
    category: Video
    icon: resources/icons
  ```

- [ ] **1.1.4** Créer les scripts npm
  ```json
  {
    "scripts": {
      "electron:dev": "concurrently \"pnpm dev:local\" \"wait-on http://localhost:3000 && electron .\"",
      "electron:build": "pnpm build:local && electron-builder",
      "electron:build:mac": "pnpm build:local && electron-builder --mac",
      "electron:build:win": "pnpm build:local && electron-builder --win",
      "electron:build:linux": "pnpm build:local && electron-builder --linux"
    }
  }
  ```

### 1.2 Process Principal Electron (3-4 jours)

#### Tâche 1.2.1 — Fichier `electron/main.ts`

```typescript
import { app, BrowserWindow, ipcMain } from 'electron';
import serve from 'electron-serve';
import path from 'path';

const isProd = process.env.NODE_ENV === 'production';
const loadURL = isProd ? serve({ directory: '.next' }) : null;

let mainWindow: BrowserWindow | null = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    titleBarStyle: 'hiddenInset', // macOS
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isProd) {
    await loadURL(mainWindow);
  } else {
    await mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
```

#### Tâche 1.2.2 — Fichier `electron/preload.ts`

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Filesystem
  readFile: (path: string) => ipcRenderer.invoke('fs:read', path),
  writeFile: (path: string, data: string) => ipcRenderer.invoke('fs:write', path, data),
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  
  // DaVinci Resolve Bridge
  davinciConnect: () => ipcRenderer.invoke('davinci:connect'),
  davinciImport: (files: string[]) => ipcRenderer.invoke('davinci:import', files),
  davinciCreateBin: (name: string) => ipcRenderer.invoke('davinci:createBin', name),
  
  // App info
  getVersion: () => ipcRenderer.invoke('app:version'),
  getPlatform: () => process.platform,
  
  // License
  validateLicense: (code: string) => ipcRenderer.invoke('license:validate', code),
  getLicenseStatus: () => ipcRenderer.invoke('license:status'),
});
```

### 1.3 Intégration Next.js ↔ Electron (2-3 jours)

- [ ] **1.3.1** Créer un hook React pour détecter l'environnement
  ```typescript
  // hooks/use-electron.ts
  export function useElectron() {
    const isElectron = typeof window !== 'undefined' && 
                       window.electronAPI !== undefined;
    
    return {
      isElectron,
      api: isElectron ? window.electronAPI : null,
    };
  }
  ```

- [ ] **1.3.2** Adapter les opérations filesystem existantes
  - Modifier `lib/local-storage.ts` pour utiliser l'API Electron si disponible
  - Fallback vers les API web si exécuté dans navigateur

- [ ] **1.3.3** Migrer le bridge DaVinci Resolve
  - Intégrer le script Python dans les ressources de l'app
  - Créer un handler IPC pour spawner le process Python

### 1.4 Ressources & Assets (1-2 jours)

- [ ] **1.4.1** Créer les icônes d'application
  ```
  resources/
  ├── icon.icns          # macOS (1024x1024)
  ├── icon.ico           # Windows (256x256)
  ├── icons/
  │   ├── 16x16.png
  │   ├── 32x32.png
  │   ├── 128x128.png
  │   ├── 256x256.png
  │   └── 512x512.png
  └── background.png     # DMG background (macOS)
  ```

- [ ] **1.4.2** Créer le fichier `electron/types.d.ts`
  ```typescript
  interface ElectronAPI {
    readFile: (path: string) => Promise<string>;
    writeFile: (path: string, data: string) => Promise<void>;
    selectFolder: () => Promise<string | null>;
    davinciConnect: () => Promise<boolean>;
    davinciImport: (files: string[]) => Promise<void>;
    davinciCreateBin: (name: string) => Promise<void>;
    getVersion: () => Promise<string>;
    getPlatform: () => string;
    validateLicense: (code: string) => Promise<LicenseValidation>;
    getLicenseStatus: () => Promise<LicenseStatus>;
  }
  
  declare global {
    interface Window {
      electronAPI?: ElectronAPI;
    }
  }
  ```

---

## 🔷 Phase 2 : Pipeline de Releases

### 2.1 Configuration GitHub Actions (2-3 jours)

#### Tâche 2.1.1 — Workflow de build `.github/workflows/release.yml`

```yaml
name: Release Desktop App

on:
  push:
    tags:
      - 'v*'

env:
  GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

jobs:
  release:
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]
    
    runs-on: ${{ matrix.os }}
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          
      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 10
          
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
        
      - name: Build & Package (macOS)
        if: matrix.os == 'macos-latest'
        run: pnpm electron:build:mac
        env:
          CSC_LINK: ${{ secrets.MAC_CERTIFICATE }}
          CSC_KEY_PASSWORD: ${{ secrets.MAC_CERTIFICATE_PASSWORD }}
          
      - name: Build & Package (Windows)
        if: matrix.os == 'windows-latest'
        run: pnpm electron:build:win
        
      - name: Build & Package (Linux)
        if: matrix.os == 'ubuntu-latest'
        run: pnpm electron:build:linux
        
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: release-${{ matrix.os }}
          path: |
            dist-electron/*.dmg
            dist-electron/*.zip
            dist-electron/*.exe
            dist-electron/*.AppImage
            dist-electron/*.deb
            
  publish:
    needs: release
    runs-on: ubuntu-latest
    
    steps:
      - name: Download all artifacts
        uses: actions/download-artifact@v4
        
      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            release-macos-latest/*
            release-windows-latest/*
            release-ubuntu-latest/*
          draft: true
          generate_release_notes: true
```

### 2.2 Versioning & Changelog (1-2 jours)

- [ ] **2.2.1** Configurer le versioning sémantique
  ```bash
  # Script de release
  # scripts/release.sh
  VERSION=$1
  git tag -a "v$VERSION" -m "Release v$VERSION"
  git push origin "v$VERSION"
  ```

- [ ] **2.2.2** Template de release notes
  ```markdown
  ## 🎉 Media Conductor v{VERSION}
  
  ### ✨ Nouveautés
  - 
  
  ### 🐛 Corrections
  - 
  
  ### 📦 Téléchargements
  | Plateforme | Fichier |
  |------------|---------|
  | macOS | Media-Conductor-{VERSION}.dmg |
  | Windows | Media-Conductor-{VERSION}-Setup.exe |
  | Linux | Media-Conductor-{VERSION}.AppImage |
  
  ### ⚠️ Notes
  - Cette version ne supporte pas la mise à jour automatique
  - Téléchargez manuellement les nouvelles versions
  ```

- [ ] **2.2.3** Créer `CHANGELOG.md` à la racine

---

## 🔷 Phase 3 : Système de Codes de Test

### 3.1 Architecture du Système (Design)

```
┌─────────────────────────────────────────────────────────────────┐
│                        SERVEUR (Supabase)                       │
├─────────────────────────────────────────────────────────────────┤
│  Table: test_codes                                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ id          │ code        │ expires_at │ max_uses │ ... │   │
│  │ uuid        │ TEST-XXXX   │ timestamp  │ 50       │     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Table: code_activations                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ id │ code_id │ machine_id │ activated_at │ uses_count │  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ API (Edge Functions)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      APPLICATION DESKTOP                         │
├─────────────────────────────────────────────────────────────────┤
│  electron-store (local)                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ license: { code, activatedAt, expiresAt, cachedUntil }  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Vérification :                                                 │
│  1. Check cache local (validité < 24h)                          │
│  2. Si expiré → vérification serveur                            │
│  3. Si offline → utiliser cache (grace period 7 jours)          │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Base de données (1-2 jours)

#### Tâche 3.2.1 — Migration Drizzle

```typescript
// drizzle/schema/test-codes.ts
import { pgTable, uuid, varchar, timestamp, integer, boolean } from 'drizzle-orm/pg-core';

export const testCodes = pgTable('test_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 19 }).notNull().unique(), // TEST-XXXX-XXXX-XXXX
  
  // Limitations
  expiresAt: timestamp('expires_at').notNull(),
  maxGenerations: integer('max_generations').default(100),
  maxActivations: integer('max_activations').default(1), // 1 machine
  
  // Features
  featuresEnabled: varchar('features_enabled', { length: 255 }).array(),
  
  // Metadata
  label: varchar('label', { length: 100 }), // "Demo Client X"
  createdAt: timestamp('created_at').defaultNow(),
  createdBy: uuid('created_by'), // Admin user
  isActive: boolean('is_active').default(true),
});

export const codeActivations = pgTable('code_activations', {
  id: uuid('id').primaryKey().defaultRandom(),
  codeId: uuid('code_id').references(() => testCodes.id).notNull(),
  
  // Machine identification
  machineId: varchar('machine_id', { length: 64 }).notNull(), // Hash unique
  machineName: varchar('machine_name', { length: 100 }),
  platform: varchar('platform', { length: 20 }), // darwin, win32, linux
  
  // Usage tracking
  activatedAt: timestamp('activated_at').defaultNow(),
  lastSeenAt: timestamp('last_seen_at'),
  generationsUsed: integer('generations_used').default(0),
  
  // Status
  isRevoked: boolean('is_revoked').default(false),
});
```

### 3.3 API de Validation (2-3 jours)

#### Tâche 3.3.1 — Endpoint de validation

```typescript
// app/api/license/validate/route.ts
import { db } from '@/lib/db';
import { testCodes, codeActivations } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(req: Request) {
  const { code, machineId, machineName, platform } = await req.json();
  
  // 1. Trouver le code
  const testCode = await db.query.testCodes.findFirst({
    where: and(
      eq(testCodes.code, code.toUpperCase()),
      eq(testCodes.isActive, true)
    ),
  });
  
  if (!testCode) {
    return Response.json({ valid: false, error: 'CODE_NOT_FOUND' }, { status: 404 });
  }
  
  // 2. Vérifier expiration
  if (new Date() > testCode.expiresAt) {
    return Response.json({ valid: false, error: 'CODE_EXPIRED' }, { status: 410 });
  }
  
  // 3. Vérifier/créer activation
  let activation = await db.query.codeActivations.findFirst({
    where: and(
      eq(codeActivations.codeId, testCode.id),
      eq(codeActivations.machineId, machineId)
    ),
  });
  
  if (!activation) {
    // Vérifier limite d'activations
    const activationCount = await db
      .select({ count: count() })
      .from(codeActivations)
      .where(eq(codeActivations.codeId, testCode.id));
    
    if (activationCount[0].count >= testCode.maxActivations) {
      return Response.json({ valid: false, error: 'MAX_ACTIVATIONS_REACHED' }, { status: 403 });
    }
    
    // Créer nouvelle activation
    [activation] = await db.insert(codeActivations).values({
      codeId: testCode.id,
      machineId,
      machineName,
      platform,
    }).returning();
  }
  
  // 4. Mettre à jour lastSeenAt
  await db.update(codeActivations)
    .set({ lastSeenAt: new Date() })
    .where(eq(codeActivations.id, activation.id));
  
  // 5. Retourner status
  return Response.json({
    valid: true,
    license: {
      code: testCode.code,
      expiresAt: testCode.expiresAt.toISOString(),
      generationsRemaining: testCode.maxGenerations - activation.generationsUsed,
      features: testCode.featuresEnabled,
    },
  });
}
```

#### Tâche 3.3.2 — Endpoint d'incrémentation d'usage

```typescript
// app/api/license/use/route.ts
export async function POST(req: Request) {
  const { machineId, generationType } = await req.json();
  
  const activation = await db.query.codeActivations.findFirst({
    where: eq(codeActivations.machineId, machineId),
    with: { testCode: true },
  });
  
  if (!activation || activation.isRevoked) {
    return Response.json({ error: 'INVALID_ACTIVATION' }, { status: 403 });
  }
  
  if (activation.generationsUsed >= activation.testCode.maxGenerations) {
    return Response.json({ error: 'LIMIT_REACHED' }, { status: 429 });
  }
  
  await db.update(codeActivations)
    .set({ generationsUsed: activation.generationsUsed + 1 })
    .where(eq(codeActivations.id, activation.id));
  
  return Response.json({
    generationsUsed: activation.generationsUsed + 1,
    generationsRemaining: activation.testCode.maxGenerations - activation.generationsUsed - 1,
  });
}
```

### 3.4 Client-side (Electron) (2-3 jours)

#### Tâche 3.4.1 — Service de licence

```typescript
// electron/license/license-service.ts
import Store from 'electron-store';
import { machineIdSync } from 'node-machine-id';
import os from 'os';

interface LicenseCache {
  code: string;
  expiresAt: string;
  generationsRemaining: number;
  features: string[];
  cachedAt: string;
  validUntil: string; // Cache validity
}

const store = new Store<{ license: LicenseCache | null }>();
const API_URL = process.env.LICENSE_API_URL || 'https://api.mediaconductor.app';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24h
const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours offline

export class LicenseService {
  private machineId: string;
  
  constructor() {
    this.machineId = machineIdSync();
  }
  
  async validate(code: string): Promise<LicenseValidation> {
    try {
      const response = await fetch(`${API_URL}/api/license/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          machineId: this.machineId,
          machineName: os.hostname(),
          platform: process.platform,
        }),
      });
      
      const data = await response.json();
      
      if (data.valid) {
        // Mettre en cache
        store.set('license', {
          ...data.license,
          cachedAt: new Date().toISOString(),
          validUntil: new Date(Date.now() + CACHE_DURATION_MS).toISOString(),
        });
      }
      
      return data;
    } catch (error) {
      // Offline: vérifier cache
      return this.checkCachedLicense();
    }
  }
  
  async getStatus(): Promise<LicenseStatus> {
    const cached = store.get('license');
    
    if (!cached) {
      return { status: 'NO_LICENSE', needsActivation: true };
    }
    
    // Vérifier si le cache est encore valide
    const cacheValid = new Date(cached.validUntil) > new Date();
    
    if (cacheValid) {
      return {
        status: 'VALID',
        ...cached,
        needsActivation: false,
      };
    }
    
    // Cache expiré: tenter revalidation
    try {
      return await this.validate(cached.code);
    } catch {
      // Vérifier grace period
      const gracePeriodEnd = new Date(
        new Date(cached.cachedAt).getTime() + GRACE_PERIOD_MS
      );
      
      if (new Date() < gracePeriodEnd) {
        return {
          status: 'OFFLINE_GRACE',
          ...cached,
          needsActivation: false,
          offlineUntil: gracePeriodEnd.toISOString(),
        };
      }
      
      return { status: 'EXPIRED', needsActivation: true };
    }
  }
  
  async trackUsage(generationType: string): Promise<void> {
    const cached = store.get('license');
    if (!cached) return;
    
    try {
      const response = await fetch(`${API_URL}/api/license/use`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machineId: this.machineId,
          generationType,
        }),
      });
      
      const data = await response.json();
      
      // Mettre à jour le cache local
      store.set('license', {
        ...cached,
        generationsRemaining: data.generationsRemaining,
      });
    } catch {
      // Offline: décrémenter localement
      store.set('license', {
        ...cached,
        generationsRemaining: cached.generationsRemaining - 1,
      });
    }
  }
  
  clearLicense(): void {
    store.delete('license');
  }
}
```

### 3.5 Interface d'Activation (1-2 jours)

#### Tâche 3.5.1 — Composant d'activation

```tsx
// components/license/activation-modal.tsx
'use client';

import { useState } from 'react';
import { useElectron } from '@/hooks/use-electron';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function ActivationModal({ open, onSuccess }: { 
  open: boolean; 
  onSuccess: () => void;
}) {
  const { api } = useElectron();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const formatCode = (value: string) => {
    // Format: TEST-XXXX-XXXX-XXXX
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const parts = cleaned.match(/.{1,4}/g) || [];
    return parts.slice(0, 4).join('-');
  };

  const handleSubmit = async () => {
    if (!api) return;
    
    setLoading(true);
    setError(null);
    
    const result = await api.validateLicense(code);
    
    if (result.valid) {
      onSuccess();
    } else {
      const errorMessages: Record<string, string> = {
        CODE_NOT_FOUND: 'Code invalide ou inexistant',
        CODE_EXPIRED: 'Ce code a expiré',
        MAX_ACTIVATIONS_REACHED: 'Ce code a atteint sa limite d\'activations',
      };
      setError(errorMessages[result.error] || 'Erreur de validation');
    }
    
    setLoading(false);
  };

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Activer Media Conductor</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Entrez votre code de test pour activer l'application.
          </p>
          
          <Input
            value={code}
            onChange={(e) => setCode(formatCode(e.target.value))}
            placeholder="TEST-XXXX-XXXX-XXXX"
            className="font-mono text-center text-lg tracking-wider"
            maxLength={19}
          />
          
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          
          <Button 
            onClick={handleSubmit} 
            disabled={code.length !== 19 || loading}
            className="w-full"
          >
            {loading ? 'Validation...' : 'Activer'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### 3.6 Administration des Codes (1-2 jours)

#### Tâche 3.6.1 — Interface admin pour générer des codes

```typescript
// lib/license/generate-code.ts
export function generateTestCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sans I, O, 0, 1
  const generate = (length: number) => 
    Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  
  return `TEST-${generate(4)}-${generate(4)}-${generate(4)}`;
}
```

- [ ] **3.6.2** Page admin `/admin/codes` pour :
  - Générer de nouveaux codes
  - Voir les codes actifs
  - Révoquer des codes
  - Voir les statistiques d'utilisation

---

## 🔷 Phase 4 : Tests & Finalisation

### 4.1 Tests Manuels (2-3 jours)

| Scénario | Plateforme | Status |
|----------|------------|--------|
| Installation propre | macOS | ⬜ |
| Installation propre | Windows | ⬜ |
| Installation propre | Linux (Ubuntu) | ⬜ |
| Activation code valide | Toutes | ⬜ |
| Activation code expiré | Toutes | ⬜ |
| Activation code déjà utilisé | Toutes | ⬜ |
| Fonctionnement offline (< 7j) | Toutes | ⬜ |
| Fonctionnement offline (> 7j) | Toutes | ⬜ |
| Bridge DaVinci Resolve | macOS/Windows | ⬜ |
| Génération IA avec compteur | Toutes | ⬜ |
| Limite de générations atteinte | Toutes | ⬜ |

### 4.2 Documentation (1-2 jours)

- [ ] **4.2.1** Guide d'installation utilisateur
- [ ] **4.2.2** FAQ problèmes courants
- [ ] **4.2.3** Documentation API licence (interne)

### 4.3 Préparation Release (1 jour)

- [ ] **4.3.1** Créer les assets marketing (screenshots, vidéo démo)
- [ ] **4.3.2** Préparer les release notes v1.0.0
- [ ] **4.3.3** Tester le workflow GitHub Actions complet

---

## 📊 Diagramme de Gantt Simplifié

```
Semaine    1         2         3         4         5         6
         |---------|---------|---------|---------|---------|---------|
Phase 1  [===================]
Phase 2            [=========]
Phase 3                      [===================]
Phase 4                                          [=========]
```

---

## ⚠️ Risques & Mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Signature code macOS | Élevé | Prévoir Apple Developer Account (99$/an) |
| Packaging Python bridge | Moyen | Utiliser PyInstaller pour créer un binaire standalone |
| Taille du bundle | Moyen | Optimiser avec `electron-builder` asar |
| Compatibilité Node.js | Faible | Fixer les versions dans le packaging |

---

## 📝 Décisions à Prendre

1. **Signature de code**
   - [ ] Acheter Apple Developer Account ? (nécessaire pour distribuer sur macOS sans warning)
   - [ ] Acheter certificat Windows ? (optionnel, SmartScreen warning sinon)

2. **Durée des codes de test**
   - [ ] Durée par défaut : 14 jours ? 30 jours ?
   - [ ] Nombre de générations par défaut : 50 ? 100 ? Illimité ?

3. **Features à limiter**
   - [ ] Toutes les features disponibles en test ?
   - [ ] Certains modèles IA restreints ?

---

## 🚀 Prochaines Étapes

1. Valider ce plan avec l'équipe
2. Créer les tickets/issues correspondants
3. Commencer Phase 1.1 (Configuration Electron)

---

*Document créé le 4 décembre 2025*
*Dernière mise à jour : 4 décembre 2025*
