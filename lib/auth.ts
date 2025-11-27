import { getCredits } from '@/app/actions/credits/get';
import { profile } from '@/schema';
import { eq } from 'drizzle-orm';
import { database } from './database';
import { env } from './env';
import { createClient } from './supabase/server';

// ============================================
// MODE LOCAL - Configuration
// ============================================
const isLocalMode = process.env.LOCAL_MODE === 'true';
const LOCAL_USER_ID = process.env.LOCAL_USER_ID || 'local-user-001';

// Utilisateur local simulé
const localUser = {
  id: LOCAL_USER_ID,
  email: 'local@tersafork.local',
  app_metadata: {},
  user_metadata: { name: 'Utilisateur Local' },
  aud: 'local',
  created_at: new Date().toISOString(),
};

// Profil local simulé
const localProfile = {
  id: LOCAL_USER_ID,
  customerId: 'local-customer',
  subscriptionId: 'local-subscription', // Simule un abonnement actif
  productId: 'local-pro-product',
  onboardedAt: new Date(),
};

// ============================================
// Fonctions d'authentification
// ============================================

export const currentUser = async () => {
  // Mode local : retourner l'utilisateur local
  if (isLocalMode) {
    return localUser as any;
  }

  // Mode normal : Supabase
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  return user;
};

export const currentUserProfile = async () => {
  // Mode local : retourner le profil local
  if (isLocalMode) {
    return localProfile as any;
  }

  // Mode normal : Supabase + Database
  const user = await currentUser();

  if (!user) {
    throw new Error('User not found');
  }

  const userProfiles = await database
    .select()
    .from(profile)
    .where(eq(profile.id, user.id));
  let userProfile = userProfiles.at(0);

  if (!userProfile && user.email) {
    const response = await database
      .insert(profile)
      .values({ id: user.id })
      .returning();

    if (!response.length) {
      throw new Error('Failed to create user profile');
    }

    userProfile = response[0];
  }

  return userProfile;
};

export const getSubscribedUser = async () => {
  // Mode local : retourner l'utilisateur local (pas de vérification de crédits)
  if (isLocalMode) {
    console.log('[LOCAL MODE] Accès AI autorisé pour utilisateur local');
    return localUser as any;
  }

  // Mode normal : vérifications Supabase + Stripe
  const user = await currentUser();

  if (!user) {
    throw new Error('Create an account to use AI features.');
  }

  const profile = await currentUserProfile();

  if (!profile) {
    throw new Error('User profile not found');
  }

  if (!profile.subscriptionId) {
    throw new Error('Claim your free AI credits to use this feature.');
  }

  const credits = await getCredits();

  if ('error' in credits) {
    throw new Error(credits.error);
  }

  if (
    profile.productId === env.STRIPE_HOBBY_PRODUCT_ID &&
    credits.credits <= 0
  ) {
    throw new Error(
      'Sorry, you have no credits remaining! Please upgrade for more credits.'
    );
  }

  return user;
};
