/**
 * API Route: /api/global-storage
 * Calcule la taille totale du stockage (fichiers uniques, pas dupliqués)
 */

import { NextRequest, NextResponse } from 'next/server';
import { readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';

interface StorageBreakdown {
  images: { count: number; size: number };
  videos: { count: number; size: number };
  audios: { count: number; size: number };
  other: { count: number; size: number };
  total: number;
  fileCount: number;
}

function getDirectorySize(dirPath: string, category: string): { count: number; size: number } {
  let totalSize = 0;
  let fileCount = 0;
  
  try {
    if (!existsSync(dirPath)) {
      return { count: 0, size: 0 };
    }
    
    const files = readdirSync(dirPath);
    for (const file of files) {
      // Ignorer les fichiers .meta.json
      if (file.endsWith('.meta.json')) continue;
      
      const filePath = join(dirPath, file);
      try {
        const stat = statSync(filePath);
        if (stat.isFile()) {
          totalSize += stat.size;
          fileCount++;
        }
      } catch {
        // Ignorer les erreurs sur les fichiers individuels
      }
    }
  } catch {
    // Ignorer les erreurs sur le répertoire
  }
  
  return { count: fileCount, size: totalSize };
}

export async function GET() {
  try {
    if (process.env.LOCAL_MODE !== 'true') {
      return NextResponse.json({ error: 'Mode local requis' }, { status: 403 });
    }

    const storagePath = process.env.LOCAL_STORAGE_PATH;
    if (!storagePath) {
      return NextResponse.json({ error: 'LOCAL_STORAGE_PATH non configuré' }, { status: 500 });
    }

    const breakdown: StorageBreakdown = {
      images: getDirectorySize(join(storagePath, 'images'), 'images'),
      videos: getDirectorySize(join(storagePath, 'videos'), 'videos'),
      audios: getDirectorySize(join(storagePath, 'audio'), 'audio'),
      other: { count: 0, size: 0 },
      total: 0,
      fileCount: 0,
    };

    breakdown.total = breakdown.images.size + breakdown.videos.size + breakdown.audios.size;
    breakdown.fileCount = breakdown.images.count + breakdown.videos.count + breakdown.audios.count;

    return NextResponse.json({
      success: true,
      breakdown,
    });

  } catch (error) {
    console.error('Erreur calcul stockage global:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}

