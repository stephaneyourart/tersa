/**
 * API Route: /api/davinci-resolve
 * Gère les interactions avec DaVinci Resolve
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getDVRStatus,
  importToDVR,
  listDVRFolders,
  createDVRFolder,
  focusAndSearchDVR,
  isDVREnabled,
  getDefaultDVRFolder,
} from '@/lib/davinci-resolve';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';

    // Vérifier si l'intégration est activée
    if (!isDVREnabled()) {
      return NextResponse.json(
        { 
          error: 'DaVinci Resolve integration is not enabled',
          hint: 'Set DAVINCI_RESOLVE_ENABLED=true in your environment'
        },
        { status: 400 }
      );
    }

    switch (action) {
      case 'status': {
        const status = await getDVRStatus();
        return NextResponse.json(status);
      }

      case 'folders': {
        const folders = await listDVRFolders();
        return NextResponse.json(folders);
      }

      case 'config': {
        return NextResponse.json({
          enabled: isDVREnabled(),
          defaultFolder: getDefaultDVRFolder(),
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[DVR API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Vérifier si l'intégration est activée
    if (!isDVREnabled()) {
      return NextResponse.json(
        { 
          error: 'DaVinci Resolve integration is not enabled',
          hint: 'Set DAVINCI_RESOLVE_ENABLED=true in your environment'
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { action, filePath, targetFolder, folderName, parentPath, metadata } = body;

    switch (action) {
      case 'import': {
        if (!filePath) {
          return NextResponse.json(
            { error: 'filePath is required' },
            { status: 400 }
          );
        }

        // Utiliser le dossier par défaut si non spécifié
        const folder = targetFolder || getDefaultDVRFolder();
        
        // Passer les métadonnées si fournies
        const result = await importToDVR(filePath, folder, metadata);
        
        return NextResponse.json(result);
      }

      case 'create-folder': {
        if (!folderName) {
          return NextResponse.json(
            { error: 'folderName is required' },
            { status: 400 }
          );
        }

        const result = await createDVRFolder(folderName, parentPath);
        return NextResponse.json(result);
      }

      case 'focus-search': {
        const { clipName, searchShortcut } = body;
        if (!clipName) {
          return NextResponse.json(
            { error: 'clipName is required' },
            { status: 400 }
          );
        }

        const folder = targetFolder || getDefaultDVRFolder();
        const result = await focusAndSearchDVR(clipName, folder, searchShortcut);
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[DVR API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    );
  }
}

