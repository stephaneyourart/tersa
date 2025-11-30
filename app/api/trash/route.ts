import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * API pour gérer une corbeille temporaire
 * Les fichiers sont déplacés vers storage/.trash/ au lieu d'être supprimés
 * Permet de restaurer avec CMD+Z
 */

const STORAGE_PATH = process.env.LOCAL_STORAGE_PATH || './storage';
const TRASH_PATH = path.join(STORAGE_PATH, '.trash');

// S'assurer que le dossier corbeille existe
async function ensureTrashDir() {
  try {
    await fs.mkdir(TRASH_PATH, { recursive: true });
  } catch (e) {
    // Ignore si existe déjà
  }
}

// POST /api/trash - Déplacer vers la corbeille
export async function POST(request: NextRequest) {
  try {
    const { action, filePath, trashId } = await request.json();

    await ensureTrashDir();

    if (action === 'move-to-trash') {
      // Déplacer le fichier vers la corbeille
      if (!filePath) {
        return NextResponse.json({ error: 'filePath requis' }, { status: 400 });
      }

      // Résoudre le chemin absolu
      let absolutePath = filePath;
      if (filePath.startsWith('/api/storage/')) {
        const relativePath = filePath.replace('/api/storage/', '');
        absolutePath = path.join(STORAGE_PATH, relativePath);
      }

      // Vérifier que le fichier existe
      try {
        await fs.access(absolutePath);
      } catch {
        return NextResponse.json({ error: 'Fichier non trouvé' }, { status: 404 });
      }

      // Générer un ID unique pour la corbeille
      const newTrashId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const originalName = path.basename(absolutePath);
      const trashFileName = `${newTrashId}_${originalName}`;
      const trashPath = path.join(TRASH_PATH, trashFileName);

      // Déplacer le fichier
      await fs.rename(absolutePath, trashPath);

      // Déplacer aussi le fichier .meta.json si existe
      const metaPath = absolutePath + '.meta.json';
      try {
        await fs.access(metaPath);
        await fs.rename(metaPath, path.join(TRASH_PATH, trashFileName + '.meta.json'));
      } catch {
        // Pas de fichier meta, ignorer
      }

      return NextResponse.json({
        success: true,
        trashId: newTrashId,
        trashFileName,
        originalPath: filePath,
      });

    } else if (action === 'restore') {
      // Restaurer depuis la corbeille
      if (!trashId) {
        return NextResponse.json({ error: 'trashId requis' }, { status: 400 });
      }

      // Chercher le fichier dans la corbeille
      const trashFiles = await fs.readdir(TRASH_PATH);
      const trashFile = trashFiles.find(f => f.startsWith(trashId + '_') && !f.endsWith('.meta.json'));

      if (!trashFile) {
        return NextResponse.json({ error: 'Fichier non trouvé dans la corbeille' }, { status: 404 });
      }

      const trashPath = path.join(TRASH_PATH, trashFile);
      
      // Récupérer le nom original
      const originalName = trashFile.replace(`${trashId}_`, '');
      
      // Déterminer le dossier de destination basé sur l'extension
      const ext = path.extname(originalName).toLowerCase();
      let destDir = 'images';
      if (['.mp4', '.mov', '.webm'].includes(ext)) {
        destDir = 'videos';
      } else if (['.mp3', '.wav', '.ogg'].includes(ext)) {
        destDir = 'audio';
      }

      const destPath = path.join(STORAGE_PATH, destDir, originalName);

      // S'assurer que le dossier destination existe
      await fs.mkdir(path.dirname(destPath), { recursive: true });

      // Restaurer le fichier
      await fs.rename(trashPath, destPath);

      // Restaurer le fichier .meta.json si existe
      const trashMetaPath = trashPath + '.meta.json';
      try {
        await fs.access(trashMetaPath);
        await fs.rename(trashMetaPath, destPath + '.meta.json');
      } catch {
        // Pas de fichier meta
      }

      // Construire l'URL locale
      const localUrl = `/api/storage/${destDir}/${originalName}`;

      return NextResponse.json({
        success: true,
        restoredPath: destPath,
        localUrl,
      });

    } else if (action === 'empty') {
      // Vider la corbeille (fichiers > 5 minutes)
      const trashFiles = await fs.readdir(TRASH_PATH);
      const now = Date.now();
      let deletedCount = 0;

      for (const file of trashFiles) {
        const timestamp = parseInt(file.split('-')[0], 10);
        if (!isNaN(timestamp) && now - timestamp > 5 * 60 * 1000) {
          try {
            await fs.unlink(path.join(TRASH_PATH, file));
            deletedCount++;
          } catch {
            // Ignorer les erreurs
          }
        }
      }

      return NextResponse.json({ success: true, deletedCount });
    }

    return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
  } catch (error) {
    console.error('Erreur trash:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

