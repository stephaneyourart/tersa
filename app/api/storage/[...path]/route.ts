/**
 * API Route: /api/storage/[...path]
 * Sert les fichiers stockés localement
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, extname } from 'path';

// MIME types
const mimeTypes: Record<string, string> = {
  // Images
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  // Videos
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  // Audio
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.flac': 'audio/flac',
  // Documents
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.json': 'application/json',
};

function getMimeType(filename: string): string {
  const ext = extname(filename).toLowerCase();
  return mimeTypes[ext] || 'application/octet-stream';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await params;
    const pathSegments = resolvedParams.path;
    
    if (!pathSegments || pathSegments.length === 0) {
      return NextResponse.json(
        { error: 'Chemin non spécifié' },
        { status: 400 }
      );
    }

    const storagePath = process.env.LOCAL_STORAGE_PATH;
    if (!storagePath) {
      return NextResponse.json(
        { error: 'LOCAL_STORAGE_PATH non configuré' },
        { status: 500 }
      );
    }

    // Construire le chemin complet
    const filePath = join(storagePath, ...pathSegments);

    // Vérifier que le chemin est dans le dossier de stockage (sécurité)
    if (!filePath.startsWith(storagePath)) {
      return NextResponse.json(
        { error: 'Accès non autorisé' },
        { status: 403 }
      );
    }

    // Vérifier l'existence du fichier
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Fichier non trouvé' },
        { status: 404 }
      );
    }

    // Lire le fichier
    const fileBuffer = await readFile(filePath);
    const fileStats = await stat(filePath);
    const mimeType = getMimeType(pathSegments[pathSegments.length - 1]);

    // Headers de réponse
    const headers = new Headers();
    headers.set('Content-Type', mimeType);
    headers.set('Content-Length', String(fileStats.size));
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('Last-Modified', fileStats.mtime.toUTCString());

    // Support des requêtes Range pour les vidéos
    const rangeHeader = request.headers.get('range');
    if (rangeHeader && mimeType.startsWith('video/')) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileStats.size - 1;
      const chunkSize = end - start + 1;

      headers.set('Content-Range', `bytes ${start}-${end}/${fileStats.size}`);
      headers.set('Accept-Ranges', 'bytes');
      headers.set('Content-Length', String(chunkSize));

      const chunk = fileBuffer.subarray(start, end + 1);
      return new NextResponse(chunk, {
        status: 206,
        headers,
      });
    }

    return new NextResponse(fileBuffer, {
      status: 200,
      headers,
    });

  } catch (error) {
    console.error('Erreur storage GET:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}

