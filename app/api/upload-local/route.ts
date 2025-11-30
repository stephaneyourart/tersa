/**
 * API Route: /api/upload-local
 * Upload de fichiers en mode local (sans Supabase)
 * Supporte: base64Data OU sourceUrl
 */

import { NextRequest, NextResponse } from 'next/server';
import { saveBase64, saveFromUrl, saveFile, type StorageAssetType } from '@/lib/storage-local';

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
    const { filename, base64Data, sourceUrl, bucket } = body;

    if (!filename) {
      return NextResponse.json(
        { error: 'filename est requis' },
        { status: 400 }
      );
    }

    if (!base64Data && !sourceUrl) {
      return NextResponse.json(
        { error: 'base64Data ou sourceUrl est requis' },
        { status: 400 }
      );
    }

    let storedFile;

    if (sourceUrl) {
      // Télécharger depuis une URL externe
      console.log('[LOCAL MODE] Téléchargement depuis URL:', sourceUrl);
      storedFile = await saveFromUrl(sourceUrl, filename);
    } else {
      // Sauvegarder depuis base64
      console.log('[LOCAL MODE] Sauvegarde base64:', filename);
      storedFile = await saveBase64(base64Data, filename);
    }

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

