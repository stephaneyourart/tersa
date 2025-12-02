/**
 * API Route: /api/storage/rename
 * Renomme un fichier média en gardant son suffixe unique
 */

import { NextRequest, NextResponse } from 'next/server';
import { renameFile } from '@/lib/storage-local';
import { existsSync } from 'fs';
import { join, basename, dirname } from 'path';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filePath, newName } = body;

    if (!filePath) {
      return NextResponse.json(
        { error: 'filePath is required' },
        { status: 400 }
      );
    }

    if (!newName || typeof newName !== 'string' || newName.trim().length === 0) {
      return NextResponse.json(
        { error: 'newName is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Résoudre le chemin absolu si c'est une URL relative /api/storage/...
    let absolutePath = filePath;
    if (filePath.startsWith('/api/storage/')) {
      const storagePath = process.env.LOCAL_STORAGE_PATH || './storage';
      const relativePath = filePath.replace('/api/storage/', '');
      absolutePath = join(process.cwd(), storagePath, relativePath);
    }

    // Vérifier que le fichier existe
    if (!existsSync(absolutePath)) {
      return NextResponse.json(
        { error: `File not found: ${absolutePath}` },
        { status: 404 }
      );
    }

    // Sanitize le nouveau nom (enlever caractères spéciaux dangereux)
    const sanitizedName = newName
      .trim()
      .replace(/[<>:"/\\|?*]/g, '-') // Caractères interdits dans les noms de fichiers
      .replace(/\s+/g, '-') // Espaces -> tirets
      .replace(/-+/g, '-'); // Plusieurs tirets -> un seul

    // Renommer le fichier
    const { newPath, newFilename } = await renameFile(absolutePath, sanitizedName);

    // Construire la nouvelle URL relative
    const storagePath = process.env.LOCAL_STORAGE_PATH || './storage';
    const storageAbsPath = join(process.cwd(), storagePath);
    const relativeNewPath = newPath.replace(storageAbsPath, '').replace(/^\//, '');
    const newUrl = `/api/storage/${relativeNewPath}`;

    return NextResponse.json({
      success: true,
      oldPath: absolutePath,
      newPath,
      newFilename,
      newUrl,
      newName: sanitizedName,
    });

  } catch (error) {
    console.error('[Storage Rename API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    );
  }
}






