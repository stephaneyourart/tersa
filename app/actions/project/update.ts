'use server';

import { currentUser } from '@/lib/auth';
import { database } from '@/lib/database';
import { parseError } from '@/lib/error/parse';
import { projects } from '@/schema';
import { and, eq } from 'drizzle-orm';

// Mode local : ID utilisateur par défaut
const LOCAL_USER_ID = process.env.LOCAL_USER_ID || 'local-user-001';
const isLocalMode = process.env.LOCAL_MODE === 'true';

export const updateProjectAction = async (
  projectId: string,
  data: Partial<typeof projects.$inferInsert>
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
      // En mode local, utiliser l'ID utilisateur local
      userId = LOCAL_USER_ID;
      
      // Pour les projets locaux, sauvegarder en mémoire/localStorage
      // (la BDD n'est peut-être pas configurée)
      if (projectId === 'local-project') {
        // Pour le projet local, on simule une sauvegarde réussie
        // Les données sont déjà dans le state React
        console.log('[LOCAL MODE] Projet sauvegardé localement:', projectId);
        return { success: true };
      }
    } else {
      const user = await currentUser();

      if (!user) {
        throw new Error('You need to be logged in to update a project!');
      }
      
      userId = user.id;
    }

    const project = await database
      .update(projects)
      .set({
        ...data,
        updatedAt: new Date(),
      })
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
