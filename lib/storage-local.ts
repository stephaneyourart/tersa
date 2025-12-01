/**
 * Stockage local pour TersaFork
 * Remplace Supabase Storage - stocke les fichiers dans le système de fichiers local
 */

import { mkdir, writeFile, readFile, unlink, stat, readdir, rename } from 'fs/promises';
import { join, dirname, extname, basename } from 'path';
import { existsSync } from 'fs';
import { nanoid } from 'nanoid';

// Obtenir le chemin de stockage depuis les variables d'environnement
const getStoragePath = (): string => {
  const storagePath = process.env.LOCAL_STORAGE_PATH;
  if (!storagePath) {
    throw new Error('LOCAL_STORAGE_PATH non défini dans les variables d\'environnement');
  }
  return storagePath;
};

export type StorageAssetType = 'images' | 'videos' | 'audio' | 'documents' | 'temp';

export type StoredFile = {
  id: string;
  path: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: Date;
};

/**
 * Initialise les dossiers de stockage
 */
export async function initializeStorage(): Promise<void> {
  const basePath = getStoragePath();
  const folders: StorageAssetType[] = ['images', 'videos', 'audio', 'documents', 'temp'];

  for (const folder of folders) {
    const folderPath = join(basePath, folder);
    if (!existsSync(folderPath)) {
      await mkdir(folderPath, { recursive: true });
    }
  }
}

/**
 * Génère un nom de fichier unique
 */
function generateFilename(originalName: string): string {
  const ext = extname(originalName);
  const base = basename(originalName, ext);
  const timestamp = Date.now();
  const uniqueId = nanoid(8);
  return `${base}-${timestamp}-${uniqueId}${ext}`;
}

/**
 * Détermine le type MIME à partir de l'extension
 */
function getMimeType(filename: string): string {
  const ext = extname(filename).toLowerCase();
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
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Détermine le dossier de stockage en fonction du type MIME
 */
function getAssetFolder(mimeType: string): StorageAssetType {
  if (mimeType.startsWith('image/')) return 'images';
  if (mimeType.startsWith('video/')) return 'videos';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'documents';
}

/**
 * Sauvegarde un fichier localement
 */
export async function saveFile(
  data: Buffer | Uint8Array,
  originalFilename: string,
  assetType?: StorageAssetType
): Promise<StoredFile> {
  const basePath = getStoragePath();
  const mimeType = getMimeType(originalFilename);
  const folder = assetType || getAssetFolder(mimeType);
  const filename = generateFilename(originalFilename);
  const filePath = join(basePath, folder, filename);

  // Créer le dossier si nécessaire
  await mkdir(dirname(filePath), { recursive: true });

  // Écrire le fichier
  await writeFile(filePath, data);

  // Obtenir la taille
  const stats = await stat(filePath);

  const id = nanoid();

  return {
    id,
    path: filePath,
    url: `/api/storage/${folder}/${filename}`,
    filename,
    mimeType,
    size: stats.size,
    createdAt: new Date(),
  };
}

/**
 * Sauvegarde un fichier depuis une URL distante ou locale
 */
export async function saveFromUrl(
  url: string,
  originalFilename?: string
): Promise<StoredFile> {
  let buffer: Buffer;
  
  // Si c'est une URL locale (/api/storage/...), lire directement depuis le disque
  if (url.startsWith('/api/storage/')) {
    const storagePath = getStoragePath();
    // Extraire le chemin relatif: /api/storage/images/file.png -> images/file.png
    const relativePath = url.replace('/api/storage/', '');
    const localPath = join(storagePath, relativePath);
    
    // Vérifier si le fichier existe
    try {
      await stat(localPath);
    } catch {
      throw new Error(`Fichier local non trouvé: ${localPath}`);
    }
    
    buffer = await readFile(localPath);
    console.log(`[LOCAL MODE] Lecture directe depuis: ${localPath}`);
  } else {
    // URL externe - construire URL absolue si nécessaire
    let fetchUrl = url;
    if (url.startsWith('/')) {
      // URL relative - ajouter le host local
      const host = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      fetchUrl = `${host}${url}`;
    }
    
    const response = await fetch(fetchUrl);
    if (!response.ok) {
      throw new Error(`Échec du téléchargement: ${response.statusText}`);
    }
    
    buffer = Buffer.from(await response.arrayBuffer());
  }

  const filename = originalFilename || url.split('/').pop() || 'file';
  return saveFile(buffer, filename);
}

/**
 * Sauvegarde un fichier base64
 */
export async function saveBase64(
  base64Data: string,
  filename: string
): Promise<StoredFile> {
  // Retirer le préfixe data:mime/type;base64, si présent
  const base64Content = base64Data.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(base64Content, 'base64');

  return saveFile(buffer, filename);
}

/**
 * Lit un fichier
 */
export async function readStoredFile(filePath: string): Promise<Buffer> {
  return readFile(filePath);
}

/**
 * Supprime un fichier
 */
export async function deleteFile(filePath: string): Promise<void> {
  if (existsSync(filePath)) {
    await unlink(filePath);
  }
}

/**
 * Renomme un fichier en gardant le suffixe unique (timestamp-id)
 * Le format du fichier est: {nom}-{timestamp}-{uniqueId}.{ext}
 * 
 * @param filePath - Chemin absolu du fichier actuel
 * @param newName - Nouveau nom (sans suffixe ni extension)
 * @returns Le nouveau chemin du fichier
 */
export async function renameFile(filePath: string, newName: string): Promise<{ newPath: string; newFilename: string }> {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const dir = dirname(filePath);
  const currentFilename = basename(filePath);
  const ext = extname(currentFilename);
  const nameWithoutExt = basename(currentFilename, ext);
  
  // Extraire le suffixe (timestamp-uniqueId) depuis le nom actuel
  // Format: nom-1234567890123-AbCdEfGh.ext
  const match = nameWithoutExt.match(/-(\d{13,})-([a-zA-Z0-9_-]{6,})$/);
  
  let newFilename: string;
  if (match) {
    // Garder le même suffixe
    const timestamp = match[1];
    const uniqueId = match[2];
    newFilename = `${newName}-${timestamp}-${uniqueId}${ext}`;
  } else {
    // Pas de suffixe standard, ajouter un nouveau
    const timestamp = Date.now();
    const uniqueId = nanoid(8);
    newFilename = `${newName}-${timestamp}-${uniqueId}${ext}`;
  }
  
  const newPath = join(dir, newFilename);
  
  // Renommer le fichier principal
  await rename(filePath, newPath);
  
  // Renommer le fichier .meta.json si existant
  const metaPath = `${filePath}.meta.json`;
  const newMetaPath = `${newPath}.meta.json`;
  if (existsSync(metaPath)) {
    await rename(metaPath, newMetaPath);
    
    // Mettre à jour le nom dans le fichier meta
    try {
      const metaContent = await readFile(newMetaPath, 'utf-8');
      const meta = JSON.parse(metaContent);
      meta.name = newName;
      meta.filename = newFilename;
      await writeFile(newMetaPath, JSON.stringify(meta, null, 2));
    } catch {
      // Ignorer les erreurs de mise à jour du meta
    }
  }
  
  return { newPath, newFilename };
}

/**
 * Liste les fichiers dans un dossier
 */
export async function listFiles(assetType: StorageAssetType): Promise<string[]> {
  const basePath = getStoragePath();
  const folderPath = join(basePath, assetType);

  if (!existsSync(folderPath)) {
    return [];
  }

  return readdir(folderPath);
}

/**
 * Obtient le chemin complet d'un fichier stocké
 */
export function getFilePath(assetType: StorageAssetType, filename: string): string {
  const basePath = getStoragePath();
  return join(basePath, assetType, filename);
}

/**
 * Nettoie les fichiers temporaires plus vieux que maxAge (en ms)
 */
export async function cleanupTempFiles(maxAge: number = 24 * 60 * 60 * 1000): Promise<number> {
  const basePath = getStoragePath();
  const tempPath = join(basePath, 'temp');

  if (!existsSync(tempPath)) {
    return 0;
  }

  const files = await readdir(tempPath);
  const now = Date.now();
  let deletedCount = 0;

  for (const file of files) {
    const filePath = join(tempPath, file);
    const stats = await stat(filePath);
    const age = now - stats.mtimeMs;

    if (age > maxAge) {
      await unlink(filePath);
      deletedCount++;
    }
  }

  return deletedCount;
}

