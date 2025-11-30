/**
 * API Route: /api/file-exists
 * Vérifie si un fichier local existe sur le disque
 */

import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { join } from 'path';

export async function POST(request: NextRequest) {
  try {
    if (process.env.LOCAL_MODE !== 'true') {
      return NextResponse.json({ exists: true }); // En mode cloud, on considère que ça existe
    }

    const storagePath = process.env.LOCAL_STORAGE_PATH;
    if (!storagePath) {
      return NextResponse.json({ exists: true });
    }

    const body = await request.json();
    let { filePath } = body;

    if (!filePath) {
      return NextResponse.json({ exists: false });
    }

    // Convertir une URL relative en chemin absolu
    if (filePath.startsWith('/api/storage/')) {
      const relativePath = filePath.replace('/api/storage/', '');
      filePath = join(storagePath, relativePath);
    }

    const exists = existsSync(filePath);

    return NextResponse.json({
      exists,
      filePath,
    });

  } catch (error) {
    console.error('Erreur vérification fichier:', error);
    return NextResponse.json({ exists: false });
  }
}

