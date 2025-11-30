/**
 * API Route: /api/resolve-path
 * Résout une URL relative en chemin absolu
 */

import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';

export async function POST(request: NextRequest) {
  try {
    if (process.env.LOCAL_MODE !== 'true') {
      return NextResponse.json(
        { error: 'Cette API n\'est disponible qu\'en mode local' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: 'url est requis' }, { status: 400 });
    }

    const storagePath = process.env.LOCAL_STORAGE_PATH;
    if (!storagePath) {
      return NextResponse.json({ error: 'LOCAL_STORAGE_PATH non configuré' }, { status: 500 });
    }

    let absolutePath = url;
    
    // Convertir /api/storage/... en chemin absolu
    if (url.startsWith('/api/storage/')) {
      const relativePath = url.replace('/api/storage/', '');
      absolutePath = join(storagePath, relativePath);
    }

    return NextResponse.json({
      success: true,
      absolutePath,
      originalUrl: url,
    });

  } catch (error) {
    console.error('Erreur résolution chemin:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}

