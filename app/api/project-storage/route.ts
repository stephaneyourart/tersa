/**
 * API Route: /api/project-storage
 * Calcule la taille du stockage d'un projet sur le disque
 */

import { NextRequest, NextResponse } from 'next/server';
import { statSync, existsSync } from 'fs';
import { join } from 'path';

interface StorageBreakdown {
  images: { count: number; size: number };
  videos: { count: number; size: number };
  audios: { count: number; size: number };
  total: number;
}

function getFileSize(filePath: string): number {
  try {
    if (existsSync(filePath)) {
      return statSync(filePath).size;
    }
  } catch {
    // Ignorer les erreurs
  }
  return 0;
}

function resolveFilePath(urlOrPath: string, storagePath: string): string | null {
  if (!urlOrPath) return null;
  
  // Si c'est une URL relative /api/storage/...
  if (urlOrPath.startsWith('/api/storage/')) {
    const relativePath = urlOrPath.replace('/api/storage/', '');
    return join(storagePath, relativePath);
  }
  
  // Si c'est déjà un chemin absolu
  if (urlOrPath.startsWith('/')) {
    return urlOrPath;
  }
  
  return null;
}

export async function POST(request: NextRequest) {
  try {
    if (process.env.LOCAL_MODE !== 'true') {
      return NextResponse.json({ error: 'Mode local requis' }, { status: 403 });
    }

    const storagePath = process.env.LOCAL_STORAGE_PATH;
    if (!storagePath) {
      return NextResponse.json({ error: 'LOCAL_STORAGE_PATH non configuré' }, { status: 500 });
    }

    const body = await request.json();
    const { nodes } = body;

    if (!nodes || !Array.isArray(nodes)) {
      return NextResponse.json({ error: 'nodes requis' }, { status: 400 });
    }

    const breakdown: StorageBreakdown = {
      images: { count: 0, size: 0 },
      videos: { count: 0, size: 0 },
      audios: { count: 0, size: 0 },
      total: 0,
    };

    for (const node of nodes) {
      const data = node.data || {};
      const type = node.type;
      
      // Récupérer le chemin du fichier
      const localPath = data.localPath as string | undefined;
      const contentUrl = (data.content?.url || data.generated?.url) as string | undefined;
      
      const filePath = localPath 
        ? resolveFilePath(localPath, storagePath)
        : contentUrl 
          ? resolveFilePath(contentUrl, storagePath)
          : null;
      
      if (!filePath) continue;
      
      const size = getFileSize(filePath);
      if (size === 0) continue;
      
      // Catégoriser par type
      if (type === 'image' || type === 'image-transform' || filePath.includes('/images/')) {
        breakdown.images.count++;
        breakdown.images.size += size;
      } else if (type === 'video' || type === 'video-transform' || filePath.includes('/videos/')) {
        breakdown.videos.count++;
        breakdown.videos.size += size;
      } else if (type === 'audio' || type === 'audio-transform' || filePath.includes('/audio/')) {
        breakdown.audios.count++;
        breakdown.audios.size += size;
      }
      
      breakdown.total += size;
    }

    return NextResponse.json({
      success: true,
      breakdown,
    });

  } catch (error) {
    console.error('Erreur calcul stockage:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}

