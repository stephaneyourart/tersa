'use server';

import { currentUser } from '@/lib/auth';
import { database } from '@/lib/database';
import { parseError } from '@/lib/error/parse';
import { profile } from '@/schema';
import { eq } from 'drizzle-orm';

// Mode local
const isLocalMode = process.env.LOCAL_MODE === 'true';

export const updateProfileAction = async (
  userId: string,
  data: Partial<typeof profile.$inferInsert>
): Promise<
  | {
      success: true;
    }
  | {
      error: string;
    }
> => {
  try {
    // Mode local : simuler la mise à jour
    if (isLocalMode) {
      console.log('[LOCAL MODE] Profil mis à jour:', userId, data);
      return { success: true };
    }

    const user = await currentUser();

    if (!user) {
      throw new Error('You need to be logged in to update your profile!');
    }

    await database.update(profile).set(data).where(eq(profile.id, userId));

    return { success: true };
  } catch (error) {
    const message = parseError(error);

    return { error: message };
  }
};
