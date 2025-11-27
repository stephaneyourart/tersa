'use server';

import { getSubscribedUser } from '@/lib/auth';
import { database } from '@/lib/database';
import { parseError } from '@/lib/error/parse';
import { speechModels } from '@/lib/models/speech';
import { trackCreditUsage } from '@/lib/stripe';
import { uploadBuffer, generateUniqueFilename } from '@/lib/storage';
import { projects } from '@/schema';
import type { Edge, Node, Viewport } from '@xyflow/react';
import { experimental_generateSpeech as generateSpeech } from 'ai';
import { eq } from 'drizzle-orm';

type GenerateSpeechActionProps = {
  text: string;
  modelId: string;
  nodeId: string;
  projectId: string;
  instructions?: string;
  voice?: string;
};

export const generateSpeechAction = async ({
  text,
  nodeId,
  modelId,
  projectId,
  instructions,
  voice,
}: GenerateSpeechActionProps): Promise<
  | {
      nodeData: object;
    }
  | {
      error: string;
    }
> => {
  try {
    await getSubscribedUser();

    const model = speechModels[modelId];

    if (!model) {
      throw new Error('Model not found');
    }

    const provider = model.providers[0];

    const { audio } = await generateSpeech({
      model: provider.model,
      text,
      outputFormat: 'mp3',
      instructions,
      voice,
    });

    await trackCreditUsage({
      action: 'generate_speech',
      cost: provider.getCost(text.length),
    });

    // Utiliser le wrapper de stockage unifié (local ou Supabase)
    const name = generateUniqueFilename('mp3');
    const stored = await uploadBuffer(
      Buffer.from(audio.uint8Array),
      name,
      audio.mediaType
    );

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

    if (!existingNode) {
      throw new Error('Node not found');
    }

    const newData = {
      ...(existingNode.data ?? {}),
      updatedAt: new Date().toISOString(),
      generated: {
        url: stored.url,
        type: audio.mediaType,
      },
    };

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

    return {
      nodeData: newData,
    };
  } catch (error) {
    const message = parseError(error);

    return { error: message };
  }
};
