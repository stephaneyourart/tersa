import { vercel } from '@t3-oss/env-core/presets-zod';
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

// Mode local - toutes les variables sont optionnelles
const isLocalMode = process.env.LOCAL_MODE === 'true';

// Helper pour rendre une validation optionnelle en mode local
const optionalInLocal = <T extends z.ZodTypeAny>(schema: T) => 
  isLocalMode ? schema.optional().or(z.literal('')) : schema;

export const env = createEnv({
  extends: isLocalMode ? [] : [vercel()],
  server: {
    // Mode local
    LOCAL_MODE: z.string().optional(),
    LOCAL_USER_ID: z.string().optional(),
    LOCAL_STORAGE_PATH: z.string().optional(),

    // Services externes - optionnels en mode local
    UPSTASH_REDIS_REST_URL: optionalInLocal(z.string().url().min(1)),
    UPSTASH_REDIS_REST_TOKEN: optionalInLocal(z.string().min(1)),

    RESEND_TOKEN: optionalInLocal(z.string().min(1).startsWith('re_')),
    RESEND_EMAIL: optionalInLocal(z.string().email().min(1)),

    STRIPE_SECRET_KEY: optionalInLocal(z.string().min(1).startsWith('sk_')),
    STRIPE_HOBBY_PRODUCT_ID: optionalInLocal(z.string().min(1).startsWith('prod_')),
    STRIPE_PRO_PRODUCT_ID: optionalInLocal(z.string().min(1).startsWith('prod_')),
    STRIPE_USAGE_PRODUCT_ID: optionalInLocal(z.string().min(1).startsWith('prod_')),
    STRIPE_CREDITS_METER_ID: optionalInLocal(z.string().min(1).startsWith('mtr_')),
    STRIPE_CREDITS_METER_NAME: optionalInLocal(z.string().min(1)),
    STRIPE_WEBHOOK_SECRET: optionalInLocal(z.string().min(1).startsWith('whsec_')),

    SUPABASE_AUTH_HOOK_SECRET: optionalInLocal(z.string().min(1).startsWith('v1,whsec_')),

    // Supabase Integration - optionnel en mode local
    POSTGRES_URL: optionalInLocal(z.string().url().min(1)),
    SUPABASE_SERVICE_ROLE_KEY: optionalInLocal(z.string().min(1)),

    // AI SDK - optionnels, utiliser ceux que vous avez
    OPENAI_API_KEY: z.string().optional(),
    XAI_API_KEY: z.string().optional(),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    AWS_REGION: z.string().optional(),
    HUME_API_KEY: z.string().optional(),
    LMNT_API_KEY: z.string().optional(),

    // Other Models - optionnels
    MINIMAX_GROUP_ID: z.string().optional(),
    MINIMAX_API_KEY: z.string().optional(),
    RUNWAYML_API_SECRET: z.string().optional(),
    LUMA_API_KEY: z.string().optional(),
    BF_API_KEY: z.string().optional(),

    // Nouveaux providers
    FAL_API_KEY: z.string().optional(),
    WAVESPEED_API_KEY: z.string().optional(),
    LUPA_API_KEY: z.string().optional(),

    // Vercel AI Gateway - optionnel
    AI_GATEWAY_API_KEY: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: optionalInLocal(z.string().min(1)),
    NEXT_PUBLIC_POSTHOG_KEY: optionalInLocal(z.string().min(1)),
    NEXT_PUBLIC_POSTHOG_HOST: optionalInLocal(z.string().url().min(1)),

    // Supabase Integration - optionnel en mode local
    NEXT_PUBLIC_SUPABASE_URL: optionalInLocal(z.string().url().min(1)),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalInLocal(z.string().min(1)),
  },
  runtimeEnv: {
    LOCAL_MODE: process.env.LOCAL_MODE,
    LOCAL_USER_ID: process.env.LOCAL_USER_ID,
    LOCAL_STORAGE_PATH: process.env.LOCAL_STORAGE_PATH,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    XAI_API_KEY: process.env.XAI_API_KEY,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_REGION: process.env.AWS_REGION,
    POSTGRES_URL: process.env.POSTGRES_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    MINIMAX_GROUP_ID: process.env.MINIMAX_GROUP_ID,
    MINIMAX_API_KEY: process.env.MINIMAX_API_KEY,
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
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_AUTH_HOOK_SECRET: process.env.SUPABASE_AUTH_HOOK_SECRET,
    RUNWAYML_API_SECRET: process.env.RUNWAYML_API_SECRET,
    LUMA_API_KEY: process.env.LUMA_API_KEY,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    HUME_API_KEY: process.env.HUME_API_KEY,
    LMNT_API_KEY: process.env.LMNT_API_KEY,
    BF_API_KEY: process.env.BF_API_KEY,
    AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
    FAL_API_KEY: process.env.FAL_API_KEY,
    WAVESPEED_API_KEY: process.env.WAVESPEED_API_KEY,
    LUPA_API_KEY: process.env.LUPA_API_KEY,
  },
  // Skip validation en mode local si des variables manquent
  skipValidation: isLocalMode,
});
