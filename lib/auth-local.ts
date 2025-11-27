/**
 * Authentification locale pour TersaFork
 * Remplace Supabase Auth en mode LOCAL_MODE=true
 */

import { getLocalUserId, isLocalMode } from './env-local';

export type LocalUser = {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
};

// Utilisateur local par défaut
const defaultLocalUser: LocalUser = {
  id: 'local-user-001',
  email: 'local@tersafork.local',
  name: 'Utilisateur Local',
  createdAt: new Date(),
};

/**
 * Obtient l'utilisateur courant
 * En mode local, retourne toujours l'utilisateur local
 */
export async function getCurrentUser(): Promise<LocalUser | null> {
  if (isLocalMode()) {
    return {
      ...defaultLocalUser,
      id: getLocalUserId(),
    };
  }

  // En mode non-local, on délègue à Supabase (code existant)
  return null;
}

/**
 * Vérifie si l'utilisateur est authentifié
 * En mode local, retourne toujours true
 */
export async function isAuthenticated(): Promise<boolean> {
  if (isLocalMode()) {
    return true;
  }

  // En mode non-local, vérifier via Supabase
  return false;
}

/**
 * Obtient l'ID de l'utilisateur courant
 */
export async function getCurrentUserId(): Promise<string> {
  if (isLocalMode()) {
    return getLocalUserId();
  }

  // Fallback
  return getLocalUserId();
}

/**
 * Mock des méthodes d'auth Supabase pour le mode local
 */
export const localAuthMethods = {
  signIn: async () => {
    if (isLocalMode()) {
      return { user: defaultLocalUser, error: null };
    }
    return { user: null, error: new Error('Not in local mode') };
  },

  signUp: async () => {
    if (isLocalMode()) {
      return { user: defaultLocalUser, error: null };
    }
    return { user: null, error: new Error('Not in local mode') };
  },

  signOut: async () => {
    // En mode local, on ne fait rien
    return { error: null };
  },

  getSession: async () => {
    if (isLocalMode()) {
      return {
        session: {
          user: defaultLocalUser,
          access_token: 'local-access-token',
          refresh_token: 'local-refresh-token',
        },
        error: null,
      };
    }
    return { session: null, error: null };
  },
};

