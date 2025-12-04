/**
 * Gestion des métadonnées de médias via fichiers sidecar .meta.json
 * Ces métadonnées sont accessibles même hors du canvas
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname, basename, extname } from 'path';

export interface MediaMetadata {
  // Identifiant
  id?: string;
  originalFilename?: string;
  
  // Technique
  width?: number;
  height?: number;
  duration?: number;
  format?: string;
  fileSize?: number;
  
  // Génération
  isGenerated?: boolean;
  modelId?: string;
  prompt?: string;
  aspectRatio?: string;
  seed?: number | string;
  steps?: number;
  cfg?: number;
  inputImages?: string[];
  generatedAt?: string;
  
  // Coût de génération
  cost?: number;
  service?: string; // 'wavespeed', 'fal', 'replicate', etc.
  
  // DVR
  dvrTransferred?: boolean;
  dvrTransferDate?: string;
  dvrProject?: string;
  dvrClipName?: string;
  
  // Titre & descriptions
  smartTitle?: string;
  description?: string;
  decor?: string;
  scene?: string;
  tags?: string[];
  favorites?: number; // 0-5 étoiles
  
  // Dates
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Obtient le chemin du fichier .meta.json pour un média
 */
export function getMetadataPath(mediaPath: string): string {
  const dir = dirname(mediaPath);
  const name = basename(mediaPath);
  return join(dir, `${name}.meta.json`);
}

/**
 * Sauvegarde les métadonnées d'un média
 */
export function saveMediaMetadata(mediaPath: string, metadata: MediaMetadata): void {
  const metaPath = getMetadataPath(mediaPath);
  const existing = loadMediaMetadata(mediaPath);
  
  const merged: MediaMetadata = {
    ...existing,
    ...metadata,
    updatedAt: new Date().toISOString(),
  };
  
  if (!merged.createdAt) {
    merged.createdAt = merged.updatedAt;
  }
  
  writeFileSync(metaPath, JSON.stringify(merged, null, 2), 'utf-8');
  console.log(`[META] Sauvegardé: ${metaPath}`);
}

/**
 * Charge les métadonnées d'un média
 */
export function loadMediaMetadata(mediaPath: string): MediaMetadata | null {
  const metaPath = getMetadataPath(mediaPath);
  
  if (!existsSync(metaPath)) {
    return null;
  }
  
  try {
    const content = readFileSync(metaPath, 'utf-8');
    return JSON.parse(content) as MediaMetadata;
  } catch (error) {
    console.error(`[META] Erreur lecture: ${metaPath}`, error);
    return null;
  }
}

/**
 * Vérifie si un média a des métadonnées
 */
export function hasMetadata(mediaPath: string): boolean {
  return existsSync(getMetadataPath(mediaPath));
}

/**
 * Construit les métadonnées depuis les données d'un nœud
 */
export function buildMetadataFromNodeData(nodeData: Record<string, unknown>): MediaMetadata {
  const metadata: MediaMetadata = {
    isGenerated: Boolean(nodeData.isGenerated || nodeData.generated),
    format: (nodeData.generated?.type || nodeData.content?.type) as string | undefined,
  };
  
  // Dimensions
  const width = nodeData.width || nodeData.generated?.width || nodeData.content?.width;
  const height = nodeData.height || nodeData.generated?.height || nodeData.content?.height;
  if (width) metadata.width = Number(width);
  if (height) metadata.height = Number(height);
  
  // Durée
  const duration = nodeData.duration || nodeData.generated?.duration || nodeData.content?.duration;
  if (duration) metadata.duration = Number(duration);
  
  // Génération
  if (nodeData.modelId) metadata.modelId = String(nodeData.modelId);
  if (nodeData.instructions) metadata.prompt = String(nodeData.instructions);
  if (nodeData.aspectRatio) metadata.aspectRatio = String(nodeData.aspectRatio);
  if (nodeData.seed) metadata.seed = nodeData.seed as number | string;
  if (nodeData.steps) metadata.steps = Number(nodeData.steps);
  if (nodeData.cfg) metadata.cfg = Number(nodeData.cfg);
  if (nodeData.inputImages) metadata.inputImages = nodeData.inputImages as string[];
  
  // Titre
  if (nodeData.smartTitle) metadata.smartTitle = String(nodeData.smartTitle);
  if (nodeData.dvrMetadata) {
    const dvr = nodeData.dvrMetadata as Record<string, unknown>;
    if (dvr.title) metadata.smartTitle = String(dvr.title);
    if (dvr.description) metadata.description = String(dvr.description);
    if (dvr.decor) metadata.decor = String(dvr.decor);
  }
  
  // DVR
  if (nodeData.dvrTransferred) {
    metadata.dvrTransferred = true;
    metadata.dvrTransferDate = nodeData.dvrTransferDate as string;
    metadata.dvrProject = nodeData.dvrProject as string;
    metadata.dvrClipName = nodeData.dvrClipName as string;
  }
  
  return metadata;
}

