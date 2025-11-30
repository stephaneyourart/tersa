'use server';

import { getSubscribedUser } from '@/lib/auth';
import { database } from '@/lib/database';
import { parseError } from '@/lib/error/parse';
import { videoModels } from '@/lib/models/video';
import { trackCreditUsage } from '@/lib/stripe';
import { uploadBuffer, generateUniqueFilename } from '@/lib/storage';
import { isLocalProject, getLocalProject } from '@/lib/local-project';
import { saveMediaMetadata } from '@/lib/media-metadata';
import { projects } from '@/schema';
import OpenAI from 'openai';
import type { Edge, Node, Viewport } from '@xyflow/react';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

// Mode local
const isLocalMode = process.env.LOCAL_MODE === 'true';

/**
 * Génère un titre intelligent pour une vidéo basé sur le prompt
 */
async function generateSmartTitle(prompt: string): Promise<string> {
  try {
    const openai = new OpenAI();
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: `Tu génères des titres de fichiers courts et descriptifs pour des vidéos.
Règles:
- Maximum 50 caractères
- Pas de caractères spéciaux (/ \\ : * ? " < > |)
- Remplace les espaces par des tirets
- Capture l'essence de la scène
- En français si le prompt est en français
- Pas d'extension de fichier
Réponds UNIQUEMENT avec le titre, rien d'autre.`
        },
        {
          role: 'user',
          content: `Génère un titre de fichier pour cette vidéo:\n${prompt}`
        }
      ],
      max_tokens: 60,
      temperature: 0.7,
    });

    let title = response.choices[0]?.message?.content?.trim() || 'video';
    title = title
      .replace(/[/\\:*?"<>|]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
    
    return title;
  } catch (error) {
    console.error('[Video] Erreur génération titre:', error);
    return `video-${Date.now()}`;
  }
}

// Lit le contenu d'une image (locale ou distante)
async function readImageContent(url: string): Promise<Buffer> {
  // Si c'est une URL locale /api/storage/...
  if (url.startsWith('/api/storage/')) {
    const relativePath = url.replace('/api/storage/', '');
    const storagePath = process.env.LOCAL_STORAGE_PATH || './storage';
    const filePath = path.join(storagePath, relativePath);
    
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath);
    }
  }
  
  // Sinon, fetch normal (URL absolue)
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

type GenerateVideoActionProps = {
  modelId: string;
  prompt: string;
  images: {
    url: string;
    type: string;
  }[];
  nodeId: string;
  projectId: string;
};

export const generateVideoAction = async ({
  modelId,
  prompt,
  images,
  nodeId,
  projectId,
}: GenerateVideoActionProps): Promise<
  | {
      nodeData: object;
    }
  | {
      error: string;
    }
> => {
  try {
    await getSubscribedUser();
    const model = videoModels[modelId];

    if (!model) {
      throw new Error('Model not found');
    }

    const provider = model.providers[0];

    console.log(`[Video Action] Received ${images.length} images:`, images.map(i => i.url?.substring(0, 50)));

    let firstFrameImage = images.at(0)?.url;
    let lastFrameImage = images.length > 1 ? images.at(-1)?.url : undefined;

    console.log(`[Video Action] First frame URL: ${firstFrameImage?.substring(0, 50)}`);
    console.log(`[Video Action] Last frame URL: ${lastFrameImage?.substring(0, 50)}`);

    // Convertir la première image en base64 si nécessaire
    if (firstFrameImage) {
      const buffer = await readImageContent(firstFrameImage);
      const base64 = buffer.toString('base64');
      firstFrameImage = `data:${images.at(0)?.type || 'image/jpeg'};base64,${base64}`;
      console.log(`[Video Action] First frame converted to base64 (${base64.length} chars)`);
    }

    // Convertir la dernière image en base64 si nécessaire (pour tail_image)
    if (lastFrameImage && images.length > 1) {
      const buffer = await readImageContent(lastFrameImage);
      const base64 = buffer.toString('base64');
      lastFrameImage = `data:${images.at(-1)?.type || 'image/jpeg'};base64,${base64}`;
      console.log(`[Video Action] Last frame converted to base64 (${base64.length} chars)`);
    }

    console.log(`[Video Action] Sending to API - First frame: ${firstFrameImage ? 'yes' : 'no'}, Last frame: ${lastFrameImage ? 'yes' : 'no'}`);

    // Paramètres de génération
    const generationParams = {
      duration: 5,
      aspectRatio: '16:9',
    };

    // Générer le titre EN PARALLÈLE de la vidéo
    const titlePromise = generateSmartTitle(prompt);
    
    const url = await provider.model.generate({
      prompt,
      imagePrompt: firstFrameImage,
      lastFrameImage: lastFrameImage,
      duration: generationParams.duration,
      aspectRatio: generationParams.aspectRatio,
    });

    const smartTitle = await titlePromise;
    console.log(`[Video Action] Titre généré: ${smartTitle}`);

    // Calculer le coût
    const cost = provider.getCost({ duration: generationParams.duration });

    // Ne pas tracker les crédits en mode local
    if (!isLocalMode) {
      await trackCreditUsage({
        action: 'generate_video',
        cost: cost,
      });
    }

    // Conserver les URLs originales des images input (avant conversion base64)
    const inputImagePaths = images.map(img => img.url);

    // Calculer la résolution depuis l'aspect ratio
    const resolutions: Record<string, { width: number; height: number }> = {
      '16:9': { width: 1280, height: 720 },
      '9:16': { width: 720, height: 1280 },
      '1:1': { width: 1024, height: 1024 },
      '4:3': { width: 1024, height: 768 },
      '3:4': { width: 768, height: 1024 },
    };
    const resolution = resolutions[generationParams.aspectRatio] || { width: 1280, height: 720 };

    // Télécharger la vidéo avec le titre intelligent
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();

    const filename = `${smartTitle}.mp4`;
    const stored = await uploadBuffer(
      Buffer.from(arrayBuffer),
      filename,
      'video/mp4'
    );

    console.log(`[Video Action] Fichier sauvegardé: ${stored.path}`);

    // Sauvegarder les métadonnées dans un fichier sidecar .meta.json
    if (stored.path) {
      saveMediaMetadata(stored.path, {
        isGenerated: true,
        modelId: modelId,
        prompt: prompt,
        aspectRatio: generationParams.aspectRatio,
        duration: generationParams.duration,
        width: resolution.width,
        height: resolution.height,
        format: 'video/mp4',
        smartTitle: smartTitle,
        inputImages: inputImagePaths,
        generatedAt: new Date().toISOString(),
      });
    }

    const newData = {
      updatedAt: new Date().toISOString(),
      generated: {
        url: stored.url,
        type: 'video/mp4',
        width: resolution.width,
        height: resolution.height,
        duration: generationParams.duration,
      },
      isGenerated: true,
      localPath: stored.path,
      smartTitle: smartTitle,
      modelId: modelId,
      instructions: prompt,
      aspectRatio: generationParams.aspectRatio,
      duration: generationParams.duration,
      width: resolution.width,
      height: resolution.height,
      inputImages: inputImagePaths,
      cost: cost,
    };

    // En mode local, on ne met pas à jour la BDD
    if (!isLocalProject(projectId)) {
      const project = await database.query.projects.findFirst({
        where: eq(projects.id, projectId),
      });

      if (!project) {
        throw new Error('Project not found');
      }

      const content = project.content as {
        nodes: Node[];
        edges: Edge[];
        viewport: Viewport;
      };

      const existingNode = content.nodes.find((n) => n.id === nodeId);

      // Merger les données existantes avec les nouvelles (nouvelles prioritaires)
      const mergedData = existingNode 
        ? { ...existingNode.data, ...newData }
        : newData;

      const updatedNodes = content.nodes.map((existingNode) => {
        if (existingNode.id === nodeId) {
          return {
            ...existingNode,
            data: mergedData,
          };
        }
        return existingNode;
      });

      await database
        .update(projects)
        .set({ content: { ...content, nodes: updatedNodes } })
        .where(eq(projects.id, projectId));
    }

    return {
      nodeData: newData,
    };
  } catch (error) {
    const message = parseError(error);

    return { error: message };
  }
};
