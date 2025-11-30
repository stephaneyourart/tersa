/**
 * API pour la Media Library
 * Scanne tous les médias stockés et retourne leurs métadonnées
 */

import { NextRequest, NextResponse } from 'next/server';
import { readdir, stat, open } from 'fs/promises';
import { join, extname, basename } from 'path';
import { existsSync } from 'fs';
import { loadMediaMetadata, saveMediaMetadata, type MediaMetadata } from '@/lib/media-metadata';
import { getLocalProjects } from '@/lib/local-projects-store';
import { nanoid } from 'nanoid';

// Lire les dimensions d'une image depuis les headers du fichier
async function getImageDimensions(filePath: string): Promise<{ width: number; height: number } | null> {
  try {
    const ext = extname(filePath).toLowerCase();
    const file = await open(filePath, 'r');
    const buffer = Buffer.alloc(32);
    await file.read(buffer, 0, 32, 0);
    await file.close();

    // PNG: bytes 16-23 contiennent width (4 bytes) et height (4 bytes) en big-endian
    if (ext === '.png') {
      if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        return { width, height };
      }
    }

    // JPEG: parcourir les segments pour trouver SOF0/SOF2
    if (ext === '.jpg' || ext === '.jpeg') {
      if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
        const fullFile = await open(filePath, 'r');
        const fullBuffer = Buffer.alloc(65536); // Lire les premiers 64KB
        await fullFile.read(fullBuffer, 0, 65536, 0);
        await fullFile.close();

        let offset = 2;
        while (offset < fullBuffer.length - 10) {
          if (fullBuffer[offset] !== 0xFF) {
            offset++;
            continue;
          }
          const marker = fullBuffer[offset + 1];
          // SOF0 (0xC0), SOF1 (0xC1), SOF2 (0xC2)
          if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
            const height = fullBuffer.readUInt16BE(offset + 5);
            const width = fullBuffer.readUInt16BE(offset + 7);
            return { width, height };
          }
          // Skip to next segment
          const segmentLength = fullBuffer.readUInt16BE(offset + 2);
          offset += 2 + segmentLength;
        }
      }
    }

    // GIF: bytes 6-9 contiennent width (2 bytes) et height (2 bytes) en little-endian
    if (ext === '.gif') {
      if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
        const width = buffer.readUInt16LE(6);
        const height = buffer.readUInt16LE(8);
        return { width, height };
      }
    }

    // WebP: RIFF header puis VP8/VP8L chunk
    if (ext === '.webp') {
      if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
        const fullFile = await open(filePath, 'r');
        const fullBuffer = Buffer.alloc(30);
        await fullFile.read(fullBuffer, 0, 30, 0);
        await fullFile.close();

        // VP8L (lossless)
        if (fullBuffer[12] === 0x56 && fullBuffer[13] === 0x50 && fullBuffer[14] === 0x38 && fullBuffer[15] === 0x4C) {
          const bits = fullBuffer.readUInt32LE(21);
          const width = (bits & 0x3FFF) + 1;
          const height = ((bits >> 14) & 0x3FFF) + 1;
          return { width, height };
        }
        // VP8 (lossy)
        if (fullBuffer[12] === 0x56 && fullBuffer[13] === 0x50 && fullBuffer[14] === 0x38 && fullBuffer[15] === 0x20) {
          // Find frame header (starts with 0x9D 0x01 0x2A)
          if (fullBuffer[23] === 0x9D && fullBuffer[24] === 0x01 && fullBuffer[25] === 0x2A) {
            const width = fullBuffer.readUInt16LE(26) & 0x3FFF;
            const height = fullBuffer.readUInt16LE(28) & 0x3FFF;
            return { width, height };
          }
        }
      }
    }

    return null;
  } catch (error) {
    console.error(`[MediaLibrary] Error reading image dimensions: ${filePath}`, error);
    return null;
  }
}

// Types de médias par extension
const MEDIA_EXTENSIONS: Record<string, 'image' | 'video' | 'audio' | 'document'> = {
  // Images
  '.jpg': 'image',
  '.jpeg': 'image',
  '.png': 'image',
  '.gif': 'image',
  '.webp': 'image',
  '.svg': 'image',
  '.bmp': 'image',
  // Videos
  '.mp4': 'video',
  '.webm': 'video',
  '.mov': 'video',
  '.avi': 'video',
  '.mkv': 'video',
  // Audio
  '.mp3': 'audio',
  '.wav': 'audio',
  '.ogg': 'audio',
  '.m4a': 'audio',
  '.flac': 'audio',
  // Documents
  '.pdf': 'document',
  '.txt': 'document',
  '.json': 'document',
  '.md': 'document',
};

// Obtenir le chemin de stockage
function getStoragePath(): string {
  const storagePath = process.env.LOCAL_STORAGE_PATH;
  if (!storagePath) {
    throw new Error('LOCAL_STORAGE_PATH not defined');
  }
  return storagePath;
}

// Scanner un dossier pour les médias
async function scanFolder(
  folderPath: string,
  assetType: 'images' | 'videos' | 'audio' | 'documents'
): Promise<Array<{
  id: string;
  filename: string;
  type: 'image' | 'video' | 'audio' | 'document';
  url: string;
  path: string;
  fileSize: number;
  createdAt: string;
  metadata: MediaMetadata | null;
  dimensions: { width: number; height: number } | null;
}>> {
  if (!existsSync(folderPath)) {
    return [];
  }

  const files = await readdir(folderPath);
  const results = [];

  for (const file of files) {
    // Ignorer les fichiers .meta.json
    if (file.endsWith('.meta.json')) continue;

    const ext = extname(file).toLowerCase();
    const mediaType = MEDIA_EXTENSIONS[ext];

    if (!mediaType) continue;

    const filePath = join(folderPath, file);
    const stats = await stat(filePath);

    // Charger les métadonnées existantes
    const metadata = loadMediaMetadata(filePath);

    // Extraire les dimensions pour les images
    let dimensions: { width: number; height: number } | null = null;
    if (mediaType === 'image') {
      dimensions = await getImageDimensions(filePath);
    }

    results.push({
      id: metadata?.id || nanoid(),
      filename: file,
      type: mediaType,
      url: `/api/storage/${assetType}/${file}`,
      path: filePath,
      fileSize: stats.size,
      createdAt: metadata?.createdAt || stats.birthtime.toISOString(),
      metadata,
      dimensions,
    });
  }

  return results;
}

// Type pour les nodes dans les projets
interface ProjectNode {
  data?: Record<string, unknown>;
}

// Interface pour les informations extraites des projets
interface MediaProjectInfo {
  usedInProjects: string[];
  width?: number;
  height?: number;
  duration?: number;
  modelId?: string;
  prompt?: string;
  aspectRatio?: string;
  seed?: number | string;
  isGenerated?: boolean;
  dvrTransferred?: boolean;
  dvrProject?: string;
  smartTitle?: string;
  description?: string;
}

// Trouver les projets qui utilisent chaque média et extraire les infos
function findMediaInProjects(mediaUrl: string): MediaProjectInfo {
  const projects = getLocalProjects();
  const info: MediaProjectInfo = { usedInProjects: [] };

  for (const project of projects) {
    const nodes = (project.data?.nodes || []) as ProjectNode[];
    
    for (const node of nodes) {
      const data = node.data;
      if (!data) continue;

      // Vérifier content.url
      const content = data.content as { url?: string; width?: number; height?: number; duration?: number } | undefined;
      const generated = data.generated as { url?: string; width?: number; height?: number; duration?: number } | undefined;
      
      const isMatch = content?.url === mediaUrl || generated?.url === mediaUrl;
      
      if (isMatch) {
        info.usedInProjects.push(project.id);
        
        // Extraire les dimensions si disponibles
        if (!info.width) {
          info.width = (data.width as number) || content?.width || generated?.width;
        }
        if (!info.height) {
          info.height = (data.height as number) || content?.height || generated?.height;
        }
        if (!info.duration) {
          info.duration = (data.duration as number) || content?.duration || generated?.duration;
        }
        
        // Extraire les infos de génération
        if (!info.modelId && data.modelId) {
          info.modelId = String(data.modelId);
        }
        if (!info.prompt && data.instructions) {
          info.prompt = String(data.instructions);
        }
        if (!info.aspectRatio && data.aspectRatio) {
          info.aspectRatio = String(data.aspectRatio);
        }
        if (!info.seed && data.seed) {
          info.seed = data.seed as number | string;
        }
        if (info.isGenerated === undefined && data.isGenerated !== undefined) {
          info.isGenerated = Boolean(data.isGenerated);
        }
        
        // DVR info
        if (!info.dvrTransferred && data.dvrTransferred) {
          info.dvrTransferred = Boolean(data.dvrTransferred);
          info.dvrProject = data.dvrProject as string;
        }
        
        // Titre et description
        if (!info.smartTitle && data.smartTitle) {
          info.smartTitle = String(data.smartTitle);
        }
        const dvrMeta = data.dvrMetadata as Record<string, unknown> | undefined;
        if (dvrMeta) {
          if (!info.smartTitle && dvrMeta.title) {
            info.smartTitle = String(dvrMeta.title);
          }
          if (!info.description && dvrMeta.description) {
            info.description = String(dvrMeta.description);
          }
        }
        
        break; // Un seul match par projet suffit
      }
    }
  }

  return info;
}

export async function GET() {
  try {
    const storagePath = getStoragePath();
    
    // Scanner tous les dossiers de médias
    const [images, videos, audio, documents] = await Promise.all([
      scanFolder(join(storagePath, 'images'), 'images'),
      scanFolder(join(storagePath, 'videos'), 'videos'),
      scanFolder(join(storagePath, 'audio'), 'audio'),
      scanFolder(join(storagePath, 'documents'), 'documents'),
    ]);

    // Combiner et enrichir les résultats
    const allMedias = [...images, ...videos, ...audio, ...documents];
    
    const enrichedMedias = allMedias.map((media) => {
      // Chercher les infos dans les projets
      const projectInfo = findMediaInProjects(media.url);
      
      // Calculer le format depuis l'extension si pas dans les métadonnées
      const ext = extname(media.filename).toLowerCase().replace('.', '').toUpperCase();
      
      return {
        id: media.id,
        filename: media.filename,
        type: media.type,
        url: media.url,
        path: media.path,
        fileSize: media.fileSize,
        createdAt: media.createdAt,
        
        // Métadonnées fusionnées (fichier > meta.json > projet > défaut)
        name: media.metadata?.smartTitle || projectInfo.smartTitle || basename(media.filename, extname(media.filename)),
        description: media.metadata?.description || projectInfo.description,
        scene: media.metadata?.scene,
        decor: media.metadata?.decor,
        // Dimensions: priorité au fichier, puis metadata, puis projet
        width: media.dimensions?.width || media.metadata?.width || projectInfo.width,
        height: media.dimensions?.height || media.metadata?.height || projectInfo.height,
        duration: media.metadata?.duration || projectInfo.duration,
        format: media.metadata?.format || ext,
        isGenerated: media.metadata?.isGenerated ?? projectInfo.isGenerated ?? false,
        modelId: media.metadata?.modelId || projectInfo.modelId,
        prompt: media.metadata?.prompt || projectInfo.prompt,
        aspectRatio: media.metadata?.aspectRatio || projectInfo.aspectRatio,
        seed: media.metadata?.seed || projectInfo.seed,
        dvrTransferred: media.metadata?.dvrTransferred ?? projectInfo.dvrTransferred ?? false,
        dvrProject: media.metadata?.dvrProject || projectInfo.dvrProject,
        updatedAt: media.metadata?.updatedAt,
        
        // Projets qui utilisent ce média
        usedInProjects: projectInfo.usedInProjects,
      };
    });

    return NextResponse.json({
      success: true,
      count: enrichedMedias.length,
      medias: enrichedMedias,
    });
  } catch (error) {
    console.error('[MediaLibrary] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH - Mettre à jour les métadonnées d'un média
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, path, updates } = body;

    if (!path && !id) {
      return NextResponse.json(
        { success: false, error: 'path or id is required' },
        { status: 400 }
      );
    }

    // Si on a un ID mais pas de path, on doit trouver le path
    let mediaPath = path;
    if (!mediaPath && id) {
      const storagePath = getStoragePath();
      const folders = ['images', 'videos', 'audio', 'documents'];
      
      for (const folder of folders) {
        const folderPath = join(storagePath, folder);
        if (!existsSync(folderPath)) continue;
        
        const files = await readdir(folderPath);
        for (const file of files) {
          if (file.endsWith('.meta.json')) continue;
          
          const filePath = join(folderPath, file);
          const metadata = loadMediaMetadata(filePath);
          
          if (metadata?.id === id) {
            mediaPath = filePath;
            break;
          }
        }
        
        if (mediaPath) break;
      }
    }

    if (!mediaPath) {
      return NextResponse.json(
        { success: false, error: 'Media not found' },
        { status: 404 }
      );
    }

    // Mettre à jour les métadonnées
    const currentMetadata = loadMediaMetadata(mediaPath) || {};
    const updatedMetadata: MediaMetadata = {
      ...currentMetadata,
      id: id || currentMetadata.id || nanoid(),
    };

    // Appliquer les mises à jour
    if (updates.name !== undefined) updatedMetadata.smartTitle = updates.name;
    if (updates.description !== undefined) updatedMetadata.description = updates.description;
    if (updates.scene !== undefined) updatedMetadata.scene = updates.scene;
    if (updates.decor !== undefined) updatedMetadata.decor = updates.decor;

    saveMediaMetadata(mediaPath, updatedMetadata);

    return NextResponse.json({
      success: true,
      metadata: updatedMetadata,
    });
  } catch (error) {
    console.error('[MediaLibrary] PATCH Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

