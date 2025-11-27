/**
 * Wrapper de stockage unifié
 * Utilise le stockage local en mode LOCAL, Supabase sinon
 */

import { nanoid } from 'nanoid';
import { saveFile, saveBase64 } from './storage-local';
import { createClient } from './supabase/server';

// Déterminer le mode
const isLocalMode = process.env.LOCAL_MODE === 'true';
const LOCAL_USER_ID = process.env.LOCAL_USER_ID || 'local-user-001';

export type StorageResult = {
  url: string;
  path: string;
  type: string;
};

/**
 * Upload un fichier (Buffer/Uint8Array)
 */
export async function uploadBuffer(
  data: Buffer | Uint8Array,
  filename: string,
  contentType: string,
  bucket: string = 'files'
): Promise<StorageResult> {
  if (isLocalMode) {
    console.log('[LOCAL MODE] Sauvegarde locale:', filename);
    const stored = await saveFile(
      data instanceof Uint8Array ? Buffer.from(data) : data,
      filename
    );
    return {
      url: stored.url,
      path: stored.path,
      type: contentType,
    };
  }

  // Mode Supabase
  const client = await createClient();
  const { data: userData } = await client.auth.getUser();
  const userId = userData?.user?.id;

  if (!userId) {
    throw new Error('Utilisateur non connecté');
  }

  const blob = await client.storage
    .from(bucket)
    .upload(`${userId}/${filename}`, data, {
      contentType,
    });

  if (blob.error) {
    throw new Error(blob.error.message);
  }

  const { data: downloadUrl } = client.storage
    .from(bucket)
    .getPublicUrl(blob.data.path);

  return {
    url: downloadUrl.publicUrl,
    path: blob.data.path,
    type: contentType,
  };
}

/**
 * Upload un fichier base64
 */
export async function uploadBase64(
  base64Data: string,
  filename: string,
  contentType: string,
  bucket: string = 'files'
): Promise<StorageResult> {
  if (isLocalMode) {
    console.log('[LOCAL MODE] Sauvegarde base64 locale:', filename);
    const fullBase64 = base64Data.startsWith('data:') 
      ? base64Data 
      : `data:${contentType};base64,${base64Data}`;
    const stored = await saveBase64(fullBase64, filename);
    return {
      url: stored.url,
      path: stored.path,
      type: contentType,
    };
  }

  // Mode Supabase - convertir base64 en buffer
  const base64Content = base64Data.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(base64Content, 'base64');
  return uploadBuffer(buffer, filename, contentType, bucket);
}

/**
 * Upload depuis une URL
 */
export async function uploadFromUrl(
  url: string,
  filename: string,
  contentType: string,
  bucket: string = 'files'
): Promise<StorageResult> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Échec du téléchargement: ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return uploadBuffer(buffer, filename, contentType, bucket);
}

/**
 * Obtenir l'ID utilisateur (local ou Supabase)
 */
export async function getCurrentUserId(): Promise<string> {
  if (isLocalMode) {
    return LOCAL_USER_ID;
  }

  const client = await createClient();
  const { data: userData } = await client.auth.getUser();
  
  if (!userData?.user?.id) {
    throw new Error('Utilisateur non connecté');
  }
  
  return userData.user.id;
}

/**
 * Générer un nom de fichier unique
 */
export function generateUniqueFilename(extension: string): string {
  return `${nanoid()}.${extension}`;
}

