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
