'use server';

import { getSubscribedUser } from '@/lib/auth';
import { database } from '@/lib/database';
import { parseError } from '@/lib/error/parse';
import { visionModels } from '@/lib/models/vision';
import { isLocalProject, getLocalProject, isLocalMode } from '@/lib/local-project';
import { projects } from '@/schema';
import { eq } from 'drizzle-orm';
import { readFile } from 'fs/promises';
import { join } from 'path';
import OpenAI from 'openai';

export const describeAction = async (
  url: string,
  projectId: string
): Promise<
  | {
      description: string;
    }
  | {
      error: string;
    }
> => {
  try {
    await getSubscribedUser();

    const openai = new OpenAI();

    // En mode local, utiliser le projet local simulé
    const project = isLocalProject(projectId)
      ? getLocalProject()
      : await database.query.projects.findFirst({
          where: eq(projects.id, projectId),
        });

    if (!project) {
      throw new Error('Project not found');
    }

    const model = visionModels[project.visionModel];

    if (!model) {
      throw new Error('Model not found');
    }

    let parsedUrl = url;

    // En mode local avec URL relative, lire le fichier directement
    if (url.startsWith('/api/storage/')) {
      const storagePath = process.env.LOCAL_STORAGE_PATH || './storage';
      // /api/storage/images/filename.jpg -> storage/images/filename.jpg
      const relativePath = url.replace('/api/storage/', '');
      const filePath = join(storagePath, relativePath);
      
      const buffer = await readFile(filePath);
      const ext = filePath.split('.').pop()?.toLowerCase();
      const mimeType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
      
      parsedUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
    } else if (!url.startsWith('http') && process.env.NODE_ENV !== 'production') {
      // URL relative non-locale - ne devrait pas arriver mais on gère
      console.warn('URL relative non supportée:', url);
    }

    const response = await openai.chat.completions.create({
      model: model.providers[0].model.modelId,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this image.' },
            {
              type: 'image_url',
              image_url: {
                url: parsedUrl,
              },
            },
          ],
        },
      ],
    });

    const description = response.choices.at(0)?.message.content;

    if (!description) {
      throw new Error('No description found');
    }

    return {
      description,
    };
  } catch (error) {
    const message = parseError(error);

    return { error: message };
  }
};
