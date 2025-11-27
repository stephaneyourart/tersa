'use server';

import { currentUser } from '@/lib/auth';
import { database } from '@/lib/database';
import { parseError } from '@/lib/error/parse';
import { projects } from '@/schema';
import { and, eq } from 'drizzle-orm';

// Mode local
const isLocalMode = process.env.LOCAL_MODE === 'true';
const LOCAL_USER_ID = process.env.LOCAL_USER_ID || 'local-user-001';

export const deleteProjectAction = async (
  projectId: string
): Promise<
  | {
      success: true;
    }
  | {
      error: string;
    }
> => {
  try {
    let userId: string;

    if (isLocalMode) {
      userId = LOCAL_USER_ID;
      // Projet local - juste retourner success
      if (projectId === 'local-project') {
        return { success: true };
      }
    } else {
      const user = await currentUser();
      if (!user) {
        throw new Error('You need to be logged in to delete a project!');
      }
      userId = user.id;
    }

    const project = await database
      .delete(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

    if (!project) {
      throw new Error('Project not found');
    }

    return { success: true };
  } catch (error) {
    const message = parseError(error);

    return { error: message };
  }
};
