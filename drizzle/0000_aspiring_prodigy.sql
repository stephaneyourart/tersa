CREATE TABLE "batch_job" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"node_id" text NOT NULL,
	"status" varchar(20) NOT NULL,
	"type" varchar(20) NOT NULL,
	"total_count" integer NOT NULL,
	"completed_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"settings" json NOT NULL,
	"results" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "brief_document" (
	"id" text PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"brief_id" text NOT NULL,
	"name" varchar NOT NULL,
	"type" varchar(50) NOT NULL,
	"mime_type" varchar,
	"size" integer NOT NULL,
	"storage_path" text NOT NULL,
	"url" text NOT NULL,
	"content" text,
	"tokens" integer DEFAULT 0 NOT NULL,
	"metadata" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brief" (
	"id" text PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"user_id" varchar NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"estimated_cost" varchar,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "local_asset" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"node_id" text NOT NULL,
	"type" varchar(50) NOT NULL,
	"filename" varchar NOT NULL,
	"path" text NOT NULL,
	"url" text NOT NULL,
	"mime_type" varchar NOT NULL,
	"size" integer NOT NULL,
	"metadata" json,
	"batch_job_id" text,
	"batch_index" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "node_group" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"node_ids" json NOT NULL,
	"edge_ids" json NOT NULL,
	"position" json,
	"is_template" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text,
	"subscription_id" text,
	"product_id" text,
	"onboarded_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "project_generation_config" (
	"id" text PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"brief_id" text NOT NULL,
	"project_id" text,
	"ai_model" varchar DEFAULT 'gemini-3' NOT NULL,
	"reasoning_level" varchar(20) DEFAULT 'medium' NOT NULL,
	"generate_media_directly" boolean DEFAULT false NOT NULL,
	"system_prompt" text NOT NULL,
	"custom_instructions" text,
	"settings" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" text PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"name" varchar NOT NULL,
	"transcription_model" varchar NOT NULL,
	"vision_model" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"content" json,
	"user_id" varchar NOT NULL,
	"image" varchar,
	"members" text[],
	"demo_project" boolean DEFAULT false NOT NULL
);
