/**
 * Utilitaires pour les aspect ratios d'images
 * Ce fichier peut être importé côté client
 */

export type AspectRatio = 
  | '1:1' | '16:9' | '9:16' | '4:3' | '3:4' 
  | '3:2' | '2:3' | '21:9' | '9:21';

// Liste des aspect ratios disponibles
export const ASPECT_RATIOS: AspectRatio[] = [
  '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9', '9:21'
];

// Conversion aspect ratio -> dimensions
const ASPECT_RATIO_SIZES: Record<AspectRatio, { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '16:9': { width: 1344, height: 768 },
  '9:16': { width: 768, height: 1344 },
  '4:3': { width: 1152, height: 896 },
  '3:4': { width: 896, height: 1152 },
  '3:2': { width: 1216, height: 832 },
  '2:3': { width: 832, height: 1216 },
  '21:9': { width: 1536, height: 640 },
  '9:21': { width: 640, height: 1536 },
};

export function getAspectRatioSize(aspectRatio: AspectRatio): { width: number; height: number } {
  return ASPECT_RATIO_SIZES[aspectRatio] || ASPECT_RATIO_SIZES['1:1'];
}

export function getSizeString(aspectRatio: AspectRatio): string {
  const { width, height } = getAspectRatioSize(aspectRatio);
  return `${width}x${height}`;
}

