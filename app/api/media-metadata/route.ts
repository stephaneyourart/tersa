/**
 * API Route: /api/media-metadata
 * Lecture et écriture des métadonnées média (.meta.json)
 */

import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';
import { 
  loadMediaMetadata, 
  saveMediaMetadata, 
  MediaMetadata,
  buildMetadataFromNodeData
} from '@/lib/media-metadata';

function resolveFilePath(urlOrPath: string): string {
  const storagePath = process.env.LOCAL_STORAGE_PATH;
  
  if (urlOrPath.startsWith('/api/storage/') && storagePath) {
    const relativePath = urlOrPath.replace('/api/storage/', '');
    return join(storagePath, relativePath);
  }
  
  return urlOrPath;
}

export async function GET(request: NextRequest) {
  try {
    if (process.env.LOCAL_MODE !== 'true') {
      return NextResponse.json({ error: 'Mode local requis' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('filePath');

    if (!filePath) {
      return NextResponse.json({ error: 'filePath requis' }, { status: 400 });
    }

    const absolutePath = resolveFilePath(filePath);
    const metadata = loadMediaMetadata(absolutePath);

    return NextResponse.json({
      success: true,
      filePath: absolutePath,
      metadata,
    });

  } catch (error) {
    console.error('Erreur lecture métadonnées:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (process.env.LOCAL_MODE !== 'true') {
      return NextResponse.json({ error: 'Mode local requis' }, { status: 403 });
    }

    const body = await request.json();
    const { filePath, metadata, nodeData } = body;

    if (!filePath) {
      return NextResponse.json({ error: 'filePath requis' }, { status: 400 });
    }

    const absolutePath = resolveFilePath(filePath);
    
    // Si nodeData est fourni, construire les métadonnées à partir de celui-ci
    let metadataToSave: MediaMetadata = metadata || {};
    if (nodeData) {
      metadataToSave = {
        ...metadataToSave,
        ...buildMetadataFromNodeData(nodeData),
      };
    }

    saveMediaMetadata(absolutePath, metadataToSave);

    return NextResponse.json({
      success: true,
      filePath: absolutePath,
      metadata: metadataToSave,
    });

  } catch (error) {
    console.error('Erreur écriture métadonnées:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}

