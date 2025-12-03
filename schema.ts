import { sql } from 'drizzle-orm';
import {
  boolean,
  integer,
  json,
  pgTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

const uuid = sql`uuid_generate_v4()`;

export const projects = pgTable('project', {
  id: text('id').primaryKey().default(uuid).notNull(),
  name: varchar('name').notNull(),
  transcriptionModel: varchar('transcription_model').notNull(),
  visionModel: varchar('vision_model').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
  content: json('content'),
  userId: varchar('user_id').notNull(),
  image: varchar('image'),
  members: text('members').array(),
  welcomeProject: boolean('demo_project').notNull().default(false),
});

export const profile = pgTable('profile', {
  id: text('id').primaryKey().notNull(),
  customerId: text('customer_id'),
  subscriptionId: text('subscription_id'),
  productId: text('product_id'),
  onboardedAt: timestamp('onboarded_at'),
});

// ========================================
// TABLES POUR LE MODE LOCAL
// ========================================

/**
 * Table des assets générés localement
 * Stocke les métadonnées des fichiers générés
 */
export const localAssets = pgTable('local_asset', {
  id: text('id').primaryKey().notNull(),
  projectId: text('project_id').notNull(),
  nodeId: text('node_id').notNull(),
  type: varchar('type', { length: 50 }).notNull(), // 'image' | 'video' | 'audio' | 'document'
  filename: varchar('filename').notNull(),
  path: text('path').notNull(),
  url: text('url').notNull(),
  mimeType: varchar('mime_type').notNull(),
  size: integer('size').notNull(),
  metadata: json('metadata'), // Prompt, seed, model, etc.
  batchJobId: text('batch_job_id'),
  batchIndex: integer('batch_index'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Table des jobs de batch
 * Persiste l'historique des batch jobs
 */
export const batchJobs = pgTable('batch_job', {
  id: text('id').primaryKey().notNull(),
  projectId: text('project_id').notNull(),
  nodeId: text('node_id').notNull(),
  status: varchar('status', { length: 20 }).notNull(), // 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  type: varchar('type', { length: 20 }).notNull(), // 'video' | 'image' | 'audio'
  totalCount: integer('total_count').notNull(),
  completedCount: integer('completed_count').notNull().default(0),
  failedCount: integer('failed_count').notNull().default(0),
  settings: json('settings').notNull(), // BatchSettings
  results: json('results'), // BatchJobResult[]
  createdAt: timestamp('created_at').defaultNow().notNull(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
});

/**
 * Table des groupes de nœuds
 * Pour le groupement et duplication de sous-graphes
 */
export const nodeGroups = pgTable('node_group', {
  id: text('id').primaryKey().notNull(),
  projectId: text('project_id').notNull(),
  name: varchar('name').notNull(),
  description: text('description'),
  nodeIds: json('node_ids').notNull(), // string[]
  edgeIds: json('edge_ids').notNull(), // string[]
  position: json('position'), // { x: number, y: number }
  isTemplate: boolean('is_template').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

// ========================================
// TABLES POUR LE SYSTÈME DE BRIEFS
// ========================================

/**
 * Table des briefs
 * Un brief est une collection de documents qui servira à générer un projet
 */
export const briefs = pgTable('brief', {
  id: text('id').primaryKey().default(uuid).notNull(),
  name: varchar('name').notNull(),
  description: text('description'),
  userId: varchar('user_id').notNull(),
  totalTokens: integer('total_tokens').notNull().default(0),
  estimatedCost: varchar('estimated_cost'),
  status: varchar('status', { length: 20 }).notNull().default('draft'), // 'draft' | 'ready' | 'generating' | 'completed'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at'),
});

/**
 * Table des documents d'un brief
 * Stocke les métadonnées des fichiers uploadés (texte, PDF, images, vidéos)
 */
export const briefDocuments = pgTable('brief_document', {
  id: text('id').primaryKey().default(uuid).notNull(),
  briefId: text('brief_id').notNull(),
  name: varchar('name').notNull(),
  type: varchar('type', { length: 50 }).notNull(), // 'text' | 'pdf' | 'image' | 'video' | 'audio'
  mimeType: varchar('mime_type'),
  size: integer('size').notNull(),
  storagePath: text('storage_path').notNull(), // Chemin dans Supabase Storage
  url: text('url').notNull(),
  content: text('content'), // Pour les textes directs
  tokens: integer('tokens').notNull().default(0),
  metadata: json('metadata'), // Dimensions, durée, etc.
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Table des configurations de génération de projet
 * Sauvegarde les paramètres utilisés pour générer un projet à partir d'un brief
 */
export const projectGenerationConfigs = pgTable('project_generation_config', {
  id: text('id').primaryKey().default(uuid).notNull(),
  briefId: text('brief_id').notNull(),
  projectId: text('project_id'), // Null tant que le projet n'est pas créé
  aiModel: varchar('ai_model').notNull().default('gemini-3'), // gemini-3, gpt-4o, etc.
  reasoningLevel: varchar('reasoning_level', { length: 20 }).notNull().default('medium'), // 'low' | 'medium' | 'high'
  generateMediaDirectly: boolean('generate_media_directly').notNull().default(false),
  systemPrompt: text('system_prompt').notNull(),
  customInstructions: text('custom_instructions'),
  settings: json('settings'), // Paramètres supplémentaires
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
