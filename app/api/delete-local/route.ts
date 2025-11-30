/**
 * API Route: /api/delete-local
 * Supprime un fichier local du stockage
 * Accepte soit un chemin absolu, soit une URL relative (/api/storage/...)
 */

import { NextRequest, NextResponse } from 'next/server';
import { deleteFile } from '@/lib/storage-local';
import { existsSync } from 'fs';
import { join } from 'path';

export async function POST(request: NextRequest) {
  try {
    // Vérifier le mode local
    if (process.env.LOCAL_MODE !== 'true') {
      return NextResponse.json(
        { error: 'Cette API n\'est disponible qu\'en mode local' },
        { status: 403 }
      );
    }

    const body = await request.json();
    let { filePath } = body;

    if (!filePath) {
      return NextResponse.json(
        { error: 'filePath est requis' },
        { status: 400 }
      );
    }

    // Sécurité: vérifier que le chemin est dans le dossier de stockage autorisé
    const storagePath = process.env.LOCAL_STORAGE_PATH;
    if (!storagePath) {
      return NextResponse.json(
        { error: 'LOCAL_STORAGE_PATH non configuré' },
        { status: 500 }
      );
    }

    // Si c'est une URL relative (/api/storage/...), la convertir en chemin absolu
    if (filePath.startsWith('/api/storage/')) {
      const relativePath = filePath.replace('/api/storage/', '');
      filePath = join(storagePath, relativePath);
      console.log(`[DELETE LOCAL] URL convertie en chemin: ${filePath}`);
    }

    // Normaliser les chemins pour comparaison
    const normalizedStoragePath = storagePath.replace(/\\/g, '/');
    const normalizedFilePath = filePath.replace(/\\/g, '/');

    // Vérifier que le fichier est dans le dossier de stockage
    if (!normalizedFilePath.startsWith(normalizedStoragePath)) {
      return NextResponse.json(
        { error: 'Chemin non autorisé' },
        { status: 403 }
      );
    }

    // Vérifier que le fichier existe
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Fichier non trouvé', success: false },
        { status: 404 }
      );
    }

    // Supprimer le fichier
    await deleteFile(filePath);

    console.log(`[DELETE LOCAL] Fichier supprimé: ${filePath}`);

    return NextResponse.json({
      success: true,
      message: 'Fichier supprimé',
      deletedPath: filePath,
    });

  } catch (error) {
    console.error('Erreur suppression fichier:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}

