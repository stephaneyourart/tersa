'use server';

import { getSubscribedUser } from '@/lib/auth';
import { database } from '@/lib/database';
import { parseError } from '@/lib/error/parse';
import { videoModels } from '@/lib/models/video';
import { trackCreditUsage } from '@/lib/stripe';
import { uploadBuffer, generateUniqueFilename } from '@/lib/storage';
import { isLocalProject, getLocalProject } from '@/lib/local-project';
import { projects } from '@/schema';
import type { Edge, Node, Viewport } from '@xyflow/react';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

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

    let firstFrameImage = images.at(0)?.url;

    // Convertir l'image en base64 si nécessaire (pour les APIs qui ne supportent pas les URLs)
    if (firstFrameImage) {
      const buffer = await readImageContent(firstFrameImage);
      const base64 = buffer.toString('base64');
      firstFrameImage = `data:${images.at(0)?.type || 'image/jpeg'};base64,${base64}`;
    }

    const url = await provider.model.generate({
      prompt,
      imagePrompt: firstFrameImage,
      duration: 5,
      aspectRatio: '16:9',
    });

    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();

    await trackCreditUsage({
      action: 'generate_video',
      cost: provider.getCost({ duration: 5 }),
    });

    // Utiliser le wrapper de stockage unifié (local ou Supabase)
    const name = generateUniqueFilename('mp4');
    const stored = await uploadBuffer(
      Buffer.from(arrayBuffer),
      name,
      'video/mp4'
    );

    // En mode local, créer les données directement sans accès BDD
    const newData = {
      updatedAt: new Date().toISOString(),
      generated: {
        url: stored.url,
        type: 'video/mp4',
      },
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

      if (existingNode) {
        Object.assign(newData, existingNode.data);
      }

      const updatedNodes = content.nodes.map((existingNode) => {
        if (existingNode.id === nodeId) {
          return {
            ...existingNode,
            data: newData,
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
