/**
 * API Route: /api/open-in-finder
 * Ouvre le Finder macOS avec le fichier sélectionné
 */

import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

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

    const storagePath = process.env.LOCAL_STORAGE_PATH;
    
    // Si c'est une URL relative (/api/storage/...), la convertir en chemin absolu
    if (filePath.startsWith('/api/storage/') && storagePath) {
      const relativePath = filePath.replace('/api/storage/', '');
      filePath = join(storagePath, relativePath);
    }

    // Vérifier que le fichier existe
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Fichier non trouvé' },
        { status: 404 }
      );
    }

    // Ouvrir le Finder avec le fichier sélectionné (macOS)
    // -R = reveal (sélectionne le fichier dans le Finder)
    await execAsync(`open -R "${filePath}"`);

    console.log(`[FINDER] Ouvert: ${filePath}`);

    return NextResponse.json({
      success: true,
      message: 'Finder ouvert',
      filePath,
    });

  } catch (error) {
    console.error('Erreur ouverture Finder:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}

