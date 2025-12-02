import { nanoid } from 'nanoid';
import { createClient } from './supabase/client';

// Vérifier si on est en mode local (côté client)
const getIsLocalMode = () => {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.startsWith('/local');
};

/**
 * Upload un fichier localement via l'API
 */
const uploadFileLocally = async (
  file: File,
  bucket: 'avatars' | 'files' | 'screenshots',
  filename?: string
) => {
  const extension = file.name.split('.').pop();
  const name = filename ?? `${nanoid()}.${extension}`;
  
  // Convertir le fichier en base64
  const buffer = await file.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
  );
  
  // Envoyer au serveur via l'API de stockage local
  const response = await fetch('/api/upload-local', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filename: name,
      base64Data: `data:${file.type};base64,${base64}`,
      bucket,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erreur lors de l\'upload');
  }
  
  const result = await response.json();
  
  return {
    url: result.url,
    type: file.type,
  };
};

export const uploadFile = async (
  file: File,
  bucket: 'avatars' | 'files' | 'screenshots',
  filename?: string
) => {
  // En mode local, utiliser l'upload local
  if (getIsLocalMode()) {
    return uploadFileLocally(file, bucket, filename);
  }

  // Mode normal avec Supabase
  const client = createClient();
  const { data } = await client.auth.getUser();
  const extension = file.name.split('.').pop();

  if (!data?.user) {
    throw new Error('You need to be logged in to upload a file!');
  }

  const name = filename ?? `${nanoid()}.${extension}`;

  const blob = await client.storage
    .from(bucket)
    .upload(`${data.user.id}/${name}`, file, {
      contentType: file.type,
      upsert: bucket === 'screenshots',
    });

  if (blob.error) {
    throw new Error(blob.error.message);
  }

  const { data: downloadUrl } = client.storage
    .from(bucket)
    .getPublicUrl(blob.data.path);

  return {
    url: downloadUrl.publicUrl,
    type: file.type,
  };
};
