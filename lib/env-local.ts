import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

/**
 * Configuration d'environnement pour le mode LOCAL
 * Cette version est simplifiée et ne nécessite pas Supabase, Stripe, etc.
 */
export const localEnv = createEnv({
  server: {
    // Mode local
    LOCAL_MODE: z.string().transform((v) => v === 'true').default('true'),
    LOCAL_USER_ID: z.string().default('local-user-001'),

    // Base de données
    POSTGRES_URL: z.string().url().min(1),

    // Stockage local
    LOCAL_STORAGE_PATH: z.string().min(1),

    // Batch processing
    BATCH_MAX_CONCURRENCY: z.string().transform(Number).default('10'),
    BATCH_REQUEST_TIMEOUT: z.string().transform(Number).default('300000'),

    // APIs IA - Core
    FAL_API_KEY: z.string().optional(),
    WAVESPEED_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),

    // APIs IA - Vidéo
    KLING_API_KEY: z.string().optional(),
    PIXVERSE_API_KEY: z.string().optional(),
    RUNWAYML_API_SECRET: z.string().optional(),
    LUMA_API_KEY: z.string().optional(),
    MINIMAX_GROUP_ID: z.string().optional(),
    MINIMAX_API_KEY: z.string().optional(),

    // APIs IA - Image
    BF_API_KEY: z.string().optional(),

    // APIs IA - Autres
    XAI_API_KEY: z.string().optional(),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    AWS_REGION: z.string().default('us-east-1'),
    HUME_API_KEY: z.string().optional(),
    LMNT_API_KEY: z.string().optional(),

    // Services externes optionnels (désactivés en mode local)
    UPSTASH_REDIS_REST_URL: z.string().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
    RESEND_TOKEN: z.string().optional(),
    RESEND_EMAIL: z.string().optional(),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_HOBBY_PRODUCT_ID: z.string().optional(),
    STRIPE_PRO_PRODUCT_ID: z.string().optional(),
    STRIPE_USAGE_PRODUCT_ID: z.string().optional(),
    STRIPE_CREDITS_METER_ID: z.string().optional(),
    STRIPE_CREDITS_METER_NAME: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    SUPABASE_AUTH_HOOK_SECRET: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    AI_GATEWAY_API_KEY: z.string().optional(),
  },
  client: {
    // Pas besoin de Supabase en mode local
    NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().optional(),
  },
  runtimeEnv: {
    // Mode local
    LOCAL_MODE: process.env.LOCAL_MODE,
    LOCAL_USER_ID: process.env.LOCAL_USER_ID,

    // Base de données
    POSTGRES_URL: process.env.POSTGRES_URL,

    // Stockage local
    LOCAL_STORAGE_PATH: process.env.LOCAL_STORAGE_PATH,

    // Batch processing
    BATCH_MAX_CONCURRENCY: process.env.BATCH_MAX_CONCURRENCY,
    BATCH_REQUEST_TIMEOUT: process.env.BATCH_REQUEST_TIMEOUT,

    // APIs IA
    FAL_API_KEY: process.env.FAL_API_KEY,
    WAVESPEED_API_KEY: process.env.WAVESPEED_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    KLING_API_KEY: process.env.KLING_API_KEY,
    PIXVERSE_API_KEY: process.env.PIXVERSE_API_KEY,
    BF_API_KEY: process.env.BF_API_KEY,
    XAI_API_KEY: process.env.XAI_API_KEY,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_REGION: process.env.AWS_REGION,
    RUNWAYML_API_SECRET: process.env.RUNWAYML_API_SECRET,
    LUMA_API_KEY: process.env.LUMA_API_KEY,
    MINIMAX_GROUP_ID: process.env.MINIMAX_GROUP_ID,
    MINIMAX_API_KEY: process.env.MINIMAX_API_KEY,
    HUME_API_KEY: process.env.HUME_API_KEY,
    LMNT_API_KEY: process.env.LMNT_API_KEY,

    // Services externes optionnels
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    RESEND_TOKEN: process.env.RESEND_TOKEN,
    RESEND_EMAIL: process.env.RESEND_EMAIL,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_HOBBY_PRODUCT_ID: process.env.STRIPE_HOBBY_PRODUCT_ID,
    STRIPE_PRO_PRODUCT_ID: process.env.STRIPE_PRO_PRODUCT_ID,
    STRIPE_USAGE_PRODUCT_ID: process.env.STRIPE_USAGE_PRODUCT_ID,
    STRIPE_CREDITS_METER_ID: process.env.STRIPE_CREDITS_METER_ID,
    STRIPE_CREDITS_METER_NAME: process.env.STRIPE_CREDITS_METER_NAME,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    SUPABASE_AUTH_HOOK_SECRET: process.env.SUPABASE_AUTH_HOOK_SECRET,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,

    // Client
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  },
});

// Helper pour vérifier si on est en mode local
export const isLocalMode = () => {
  return process.env.LOCAL_MODE === 'true';
};

// Helper pour obtenir l'ID utilisateur (local ou Supabase)
export const getLocalUserId = () => {
  return process.env.LOCAL_USER_ID || 'local-user-001';
};

