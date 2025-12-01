/**
 * API pour la Media Library
 * Scanne tous les médias stockés et retourne leurs métadonnées
 */

import { NextRequest, NextResponse } from 'next/server';
import { readdir, stat, open, readFile } from 'fs/promises';
import { join, extname, basename } from 'path';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { loadMediaMetadata, saveMediaMetadata, type MediaMetadata } from '@/lib/media-metadata';
import { nanoid } from 'nanoid';

// Lire les projets depuis le cache serveur (synchronisé depuis le client)
interface CachedProject {
  id: string;
  name: string;
  data?: {
    nodes?: unknown[];
    edges?: unknown[];
  };
}

async function getLocalProjectsFromCache(): Promise<CachedProject[]> {
  try {
    const storagePath = process.env.LOCAL_STORAGE_PATH;
    if (!storagePath) return [];
    
    const cachePath = join(storagePath, '.cache', 'projects.json');
    
    if (!existsSync(cachePath)) {
      console.log('[MediaLibrary] Pas de cache projets trouvé - synchronisez en ouvrant un projet');
      return [];
    }
    
    const content = await readFile(cachePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('[MediaLibrary] Erreur lecture cache projets:', error);
    return [];
  }
}

const execAsync = promisify(exec);

// Cache pour les métadonnées ffprobe
const ffprobeCache = new Map<string, { width?: number; height?: number; duration?: number; fps?: number }>();

// Extraire les métadonnées vidéo/audio avec ffprobe
async function getMediaMetadataWithFFprobe(filePath: string): Promise<{
  width?: number;
  height?: number;
  duration?: number;
  fps?: number;
} | null> {
  // Vérifier le cache
  if (ffprobeCache.has(filePath)) {
    return ffprobeCache.get(filePath) || null;
  }

  try {
    const { stdout } = await execAsync(
      `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`,
      { timeout: 5000 }
    );
    
    const data = JSON.parse(stdout);
    const result: { width?: number; height?: number; duration?: number; fps?: number } = {};
    
    // Durée depuis format
    if (data.format?.duration) {
      result.duration = parseFloat(data.format.duration);
    }
    
    // Chercher le stream vidéo
    const videoStream = data.streams?.find((s: { codec_type: string }) => s.codec_type === 'video');
    if (videoStream) {
      if (videoStream.width) result.width = videoStream.width;
      if (videoStream.height) result.height = videoStream.height;
      
      // Durée depuis le stream si pas dans format
      if (!result.duration && videoStream.duration) {
        result.duration = parseFloat(videoStream.duration);
      }
      
      // FPS - peut être dans r_frame_rate ou avg_frame_rate (format "30/1" ou "30000/1001")
      const fpsString = videoStream.r_frame_rate || videoStream.avg_frame_rate;
      if (fpsString && fpsString !== '0/0') {
        const [num, den] = fpsString.split('/').map(Number);
        if (den && den !== 0) {
          result.fps = Math.round((num / den) * 100) / 100; // Arrondi à 2 décimales
        }
      }
    }
    
    // Durée depuis le stream audio si pas encore trouvée
    if (!result.duration) {
      const audioStream = data.streams?.find((s: { codec_type: string }) => s.codec_type === 'audio');
      if (audioStream?.duration) {
        result.duration = parseFloat(audioStream.duration);
      }
    }
    
    // Mettre en cache
    ffprobeCache.set(filePath, result);
    
    return result;
  } catch {
    // ffprobe non disponible ou erreur - on ignore silencieusement
    ffprobeCache.set(filePath, {}); // Cache vide pour éviter de réessayer
    return null;
  }
}

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
  duration: number | null;
  fps: number | null;
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

    // Extraire les métadonnées selon le type
    let dimensions: { width: number; height: number } | null = null;
    let duration: number | null = null;
    let fps: number | null = null;

    if (mediaType === 'image') {
      // Pour les images, lire directement les headers
      dimensions = await getImageDimensions(filePath);
    } else if (mediaType === 'video' || mediaType === 'audio') {
      // Pour les vidéos/audio, utiliser ffprobe
      const ffprobeData = await getMediaMetadataWithFFprobe(filePath);
      if (ffprobeData) {
        if (ffprobeData.width && ffprobeData.height) {
          dimensions = { width: ffprobeData.width, height: ffprobeData.height };
        }
        if (ffprobeData.duration) {
          duration = ffprobeData.duration;
        }
        if (ffprobeData.fps) {
          fps = ffprobeData.fps;
        }
      }
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
      duration,
      fps,
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
  scene?: string;
  decor?: string;
}

// Trouver les projets qui utilisent chaque média et extraire les infos
async function findMediaInProjects(mediaUrl: string, projects: CachedProject[]): Promise<MediaProjectInfo> {
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
        
        // Extraire scene et decor depuis les métadonnées DVR ou directement du node
        const dvrMeta = data.dvrMetadata as Record<string, unknown> | undefined;
        if (dvrMeta) {
          if (!info.smartTitle && dvrMeta.title) {
            info.smartTitle = String(dvrMeta.title);
          }
          if (!info.description && dvrMeta.description) {
            info.description = String(dvrMeta.description);
          }
          // Scene et decor peuvent être dans dvrMetadata
          if (!info.scene && dvrMeta.scene) {
            info.scene = String(dvrMeta.scene);
          }
          if (!info.decor && dvrMeta.decor) {
            info.decor = String(dvrMeta.decor);
          }
        }
        
        // Scene et decor directement sur le node (si pas dans dvrMetadata)
        if (!info.scene && data.scene) {
          info.scene = String(data.scene);
        }
        if (!info.decor && data.decor) {
          info.decor = String(data.decor);
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
    
    // Charger les projets une fois pour toutes les recherches
    const projects = await getLocalProjectsFromCache();
    console.log(`[MediaLibrary] ${projects.length} projets chargés depuis le cache`);
    
    const enrichedMedias = await Promise.all(allMedias.map(async (media) => {
      // Chercher les infos dans les projets
      const projectInfo = await findMediaInProjects(media.url, projects);
      
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
        scene: media.metadata?.scene || projectInfo.scene,
        decor: media.metadata?.decor || projectInfo.decor,
        // Dimensions: priorité au fichier extrait (ffprobe/headers), puis metadata, puis projet
        width: media.dimensions?.width || media.metadata?.width || projectInfo.width,
        height: media.dimensions?.height || media.metadata?.height || projectInfo.height,
        // Durée et FPS: priorité au fichier extrait (ffprobe), puis metadata, puis projet
        duration: media.duration || media.metadata?.duration || projectInfo.duration,
        fps: media.fps || undefined, // Uniquement pour les vidéos
        format: media.metadata?.format || ext,
        isGenerated: media.metadata?.isGenerated ?? projectInfo.isGenerated ?? false,
        modelId: media.metadata?.modelId || projectInfo.modelId,
        prompt: media.metadata?.prompt || projectInfo.prompt,
        aspectRatio: media.metadata?.aspectRatio || projectInfo.aspectRatio,
        seed: media.metadata?.seed || projectInfo.seed,
        dvrTransferred: media.metadata?.dvrTransferred ?? projectInfo.dvrTransferred ?? false,
        dvrProject: media.metadata?.dvrProject || projectInfo.dvrProject,
        updatedAt: media.metadata?.updatedAt,
        favorites: media.metadata?.favorites || 0,
        tags: media.metadata?.tags || [],
        
        // Projets qui utilisent ce média
        usedInProjects: projectInfo.usedInProjects,
      };
    }));

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
    if (updates.favorites !== undefined) updatedMetadata.favorites = updates.favorites;
    if (updates.tags !== undefined) updatedMetadata.tags = updates.tags;

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

