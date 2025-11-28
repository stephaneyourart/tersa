import { spawn } from 'child_process';
import { NextRequest, NextResponse } from 'next/server';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { readdir } from 'fs/promises';

/**
 * API pour révéler un fichier dans le Finder (macOS)
 * POST /api/reveal
 * Body: { url: string } - L'URL du fichier
 * 
 * Formats supportés:
 * - /api/storage/{folder}/{filename}
 * - /storage/{folder}/{filename}  (URL directe)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;
    
    console.log('[Reveal] URL reçue:', url);
    
    if (!url) {
      return NextResponse.json(
        { error: 'URL du fichier requise' },
        { status: 400 }
      );
    }

    // Obtenir le chemin de stockage
    const storagePath = process.env.LOCAL_STORAGE_PATH;
    if (!storagePath) {
      console.log('[Reveal] LOCAL_STORAGE_PATH non défini');
      return NextResponse.json(
        { error: 'LOCAL_STORAGE_PATH non configuré' },
        { status: 500 }
      );
    }

    let filePath: string | null = null;

    // Format 1: /api/storage/{folder}/{filename}
    const apiMatch = url.match(/\/api\/storage\/([^/]+)\/(.+)$/);
    if (apiMatch) {
      const [, folder, filename] = apiMatch;
      filePath = join(storagePath, folder, decodeURIComponent(filename));
      console.log('[Reveal] Format API détecté - Folder:', folder, 'Filename:', filename);
    }
    
    // Format 2: Chemin relatif simple comme images/file.png
    if (!filePath) {
      const simpleMatch = url.match(/^\/?(?:storage\/)?([^/]+)\/(.+)$/);
      if (simpleMatch) {
        const [, folder, filename] = simpleMatch;
        filePath = join(storagePath, folder, decodeURIComponent(filename));
        console.log('[Reveal] Format simple détecté - Folder:', folder, 'Filename:', filename);
      }
    }
    
    // Format 3: Juste le nom du fichier - chercher dans les dossiers
    if (!filePath && !url.includes('/')) {
      const folders = ['images', 'videos', 'audio', 'documents'];
      for (const folder of folders) {
        const testPath = join(storagePath, folder, decodeURIComponent(url));
        if (existsSync(testPath)) {
          filePath = testPath;
          console.log('[Reveal] Fichier trouvé dans:', folder);
          break;
        }
      }
    }

    if (!filePath) {
      console.log('[Reveal] Format URL non reconnu:', url);
      // Tenter une recherche par nom de fichier
      const filename = url.split('/').pop();
      if (filename) {
        const folders = ['images', 'videos', 'audio', 'documents'];
        for (const folder of folders) {
          const folderPath = join(storagePath, folder);
          if (existsSync(folderPath)) {
            try {
              const files = await readdir(folderPath);
              if (files.includes(filename) || files.includes(decodeURIComponent(filename))) {
                filePath = join(folderPath, decodeURIComponent(filename));
                console.log('[Reveal] Fichier trouvé par recherche dans:', folder);
                break;
              }
            } catch (e) {
              // Ignorer les erreurs de lecture
            }
          }
        }
      }
    }

    if (!filePath) {
      return NextResponse.json(
        { error: 'Format d\'URL invalide ou fichier non trouvé', url },
        { status: 400 }
      );
    }

    console.log('[Reveal] Chemin complet:', filePath);

    // Vérifier que le fichier existe
    if (!existsSync(filePath)) {
      // Essayer d'ouvrir le dossier parent
      const parentDir = dirname(filePath);
      if (existsSync(parentDir)) {
        console.log('[Reveal] Fichier non trouvé, ouverture du dossier parent:', parentDir);
        filePath = parentDir;
      } else {
        console.log('[Reveal] Fichier non trouvé:', filePath);
        return NextResponse.json(
          { error: 'Fichier non trouvé', path: filePath },
          { status: 404 }
        );
      }
    }

    // Détecter l'OS et exécuter la commande appropriée
    const platform = process.platform;
    console.log('[Reveal] Platform:', platform);
    
    return new Promise((resolve) => {
      let child;
      
      if (platform === 'darwin') {
        // macOS - Reveal in Finder
        child = spawn('open', ['-R', filePath!], { detached: true, stdio: 'ignore' });
      } else if (platform === 'win32') {
        // Windows - Explorer
        child = spawn('explorer', ['/select,', filePath!], { detached: true, stdio: 'ignore' });
      } else if (platform === 'linux') {
        // Linux - ouvrir le dossier parent
        const parentDir = dirname(filePath!);
        child = spawn('xdg-open', [parentDir], { detached: true, stdio: 'ignore' });
      } else {
        resolve(NextResponse.json(
          { error: 'Système d\'exploitation non supporté' },
          { status: 500 }
        ));
        return;
      }

      child.unref();
      
      setTimeout(() => {
        console.log('[Reveal] Commande exécutée avec succès');
        resolve(NextResponse.json({ success: true, path: filePath }));
      }, 100);
      
      child.on('error', (error) => {
        console.error('[Reveal] Erreur spawn:', error);
        resolve(NextResponse.json(
          { error: 'Erreur lors de l\'ouverture', details: error.message },
          { status: 500 }
        ));
      });
    });
  } catch (error) {
    console.error('[Reveal] Erreur:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'ouverture du fichier', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

