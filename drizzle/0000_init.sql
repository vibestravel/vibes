CREATE TYPE "public"."message_author" AS ENUM('CUSTOMER', 'AI', 'HUMAN', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."channel" AS ENUM('WHATSAPP', 'INSTAGRAM_DM', 'INSTAGRAM_COMMENT', 'MESSENGER', 'FACEBOOK_COMMENT', 'SIMULATOR');--> statement-breakpoint
CREATE TYPE "public"."conversation_status" AS ENUM('OPEN', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('SIMULATED', 'SENT', 'LINK_SENT', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."extraction_status" AS ENUM('PENDING', 'DONE', 'NEEDS_OCR', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."integration_mode" AS ENUM('NOT_CONFIGURED', 'MOCK', 'LIVE');--> statement-breakpoint
CREATE TYPE "public"."conversation_mode" AS ENUM('AI', 'HUMAN', 'PAUSED');--> statement-breakpoint
CREATE TYPE "public"."package_status" AS ENUM('DRAFT', 'REVIEW', 'APPROVED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('CEO', 'DEPT_MANAGER', 'SALES_AGENT', 'CONTENT_MANAGER', 'SYSADMIN');--> statement-breakpoint
CREATE TABLE "ai_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text,
	"engine" text NOT NULL,
	"model" text,
	"latency_ms" integer NOT NULL,
	"tool_calls" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"assistant_name" text NOT NULL,
	"style" text NOT NULL,
	"formality" integer NOT NULL,
	"emoji_level" integer NOT NULL,
	"max_sentences" integer NOT NULL,
	"sales_approach" text NOT NULL,
	"preferred_phrases" text[] DEFAULT '{}' NOT NULL,
	"prohibited_phrases" text[] DEFAULT '{}' NOT NULL,
	"escalation_rules" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text,
	"actor_type" text NOT NULL,
	"action" text NOT NULL,
	"entity" text,
	"entity_id" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_identities" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"channel" "channel" NOT NULL,
	"external_id" text NOT NULL,
	"handle" text
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"channel" "channel" NOT NULL,
	"mode" "conversation_mode" DEFAULT 'AI' NOT NULL,
	"status" "conversation_status" DEFAULT 'OPEN' NOT NULL,
	"priority" "priority" DEFAULT 'NORMAL' NOT NULL,
	"department_id" text,
	"assigned_to_id" text,
	"summary" text,
	"handoff_reason" text,
	"is_simulated" boolean DEFAULT false NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"phone" text,
	"email" text,
	"preferred_language" text,
	"budget" text,
	"interests" text[] DEFAULT '{}' NOT NULL,
	"notes" text,
	"department_id" text,
	"assigned_to_id" text,
	"is_simulated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	CONSTRAINT "departments_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "document_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"package_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"conversation_id" text,
	"channel" "channel" NOT NULL,
	"status" "delivery_status" NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"storage_path" text NOT NULL,
	"sha256" text NOT NULL,
	"kind" text DEFAULT 'PACKAGE' NOT NULL,
	"department_id" text,
	"uploaded_by_id" text,
	"extraction_status" "extraction_status" DEFAULT 'PENDING' NOT NULL,
	"extraction_error" text,
	"text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "follow_up_reminders" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"note" text NOT NULL,
	"done_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"key" text PRIMARY KEY NOT NULL,
	"mode" "integration_mode" DEFAULT 'NOT_CONFIGURED' NOT NULL,
	"last_check" timestamp with time zone,
	"last_ok" timestamp with time zone,
	"last_error" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "knowledge_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"department_id" text,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"internal_only" boolean DEFAULT false NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"valid_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"conversation_id" text,
	"department_id" text NOT NULL,
	"stage_id" text NOT NULL,
	"assigned_to_id" text,
	"service" text,
	"destination" text,
	"travel_date" text,
	"travelers" integer,
	"budget" text,
	"visa_category" text,
	"details" jsonb,
	"summary" text,
	"score" integer DEFAULT 0 NOT NULL,
	"value" numeric(14, 2),
	"value_currency" text,
	"is_simulated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"author" "message_author" NOT NULL,
	"user_id" text,
	"text" text NOT NULL,
	"external_id" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "packages" (
	"id" text PRIMARY KEY NOT NULL,
	"department_id" text NOT NULL,
	"name" text NOT NULL,
	"destination" text,
	"country" text,
	"travel_dates" text,
	"nights" integer,
	"days" integer,
	"hotels" jsonb,
	"meal_plan" text,
	"flights" text,
	"transport" text,
	"included" text[] DEFAULT '{}' NOT NULL,
	"excluded" text[] DEFAULT '{}' NOT NULL,
	"prices" jsonb,
	"child_policy" text,
	"cancellation_policy" text,
	"valid_from" timestamp with time zone,
	"valid_until" timestamp with time zone,
	"status" "package_status" DEFAULT 'DRAFT' NOT NULL,
	"extracted_by" text,
	"source_document_id" text,
	"version" integer DEFAULT 1 NOT NULL,
	"replaces_id" text,
	"approved_by_id" text,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipeline_stages" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"order" integer NOT NULL,
	"is_won" boolean DEFAULT false NOT NULL,
	"is_lost" boolean DEFAULT false NOT NULL,
	CONSTRAINT "pipeline_stages_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" NOT NULL,
	"department_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_identities" ADD CONSTRAINT "channel_identities_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_deliveries" ADD CONSTRAINT "document_deliveries_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_deliveries" ADD CONSTRAINT "document_deliveries_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_deliveries" ADD CONSTRAINT "document_deliveries_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_reminders" ADD CONSTRAINT "follow_up_reminders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_entries" ADD CONSTRAINT "knowledge_entries_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_stage_id_pipeline_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."pipeline_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packages" ADD CONSTRAINT "packages_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packages" ADD CONSTRAINT "packages_source_document_id_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packages" ADD CONSTRAINT "packages_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_run_created" ON "ai_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_created" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_identity_unique" ON "channel_identities" USING btree ("channel","external_id");--> statement-breakpoint
CREATE INDEX "conversation_last_msg" ON "conversations" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "lead_created" ON "leads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "message_conv_created" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "package_status_valid" ON "packages" USING btree ("status","valid_until");