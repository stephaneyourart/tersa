/**
 * API Route: /api/upload-local
 * Upload de fichiers en mode local (sans Supabase)
 */

import { NextRequest, NextResponse } from 'next/server';
import { saveBase64 } from '@/lib/storage-local';

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
    const { filename, base64Data, bucket } = body;

    if (!filename || !base64Data) {
      return NextResponse.json(
        { error: 'filename et base64Data sont requis' },
        { status: 400 }
      );
    }

    // Sauvegarder le fichier localement
    const storedFile = await saveBase64(base64Data, filename);

    return NextResponse.json({
      success: true,
      url: storedFile.url,
      path: storedFile.path,
      filename: storedFile.filename,
      bucket,
    });

  } catch (error) {
    console.error('Erreur upload local:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}

