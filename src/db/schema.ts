// Vibes AI — database schema (Drizzle ORM, PostgreSQL)
// Semantic search (pgvector) is added in Phase 2 by a separate migration.
import { relations } from "drizzle-orm";
import {
  pgTable, pgEnum, text, integer, boolean, timestamp, jsonb, numeric, uniqueIndex, index,
} from "drizzle-orm/pg-core";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date());

export const roleEnum = pgEnum("role", ["CEO", "DEPT_MANAGER", "SALES_AGENT", "CONTENT_MANAGER", "SYSADMIN"]);
export const channelEnum = pgEnum("channel", [
  "WHATSAPP", "INSTAGRAM_DM", "INSTAGRAM_COMMENT", "MESSENGER", "FACEBOOK_COMMENT", "SIMULATOR",
]);
export const modeEnum = pgEnum("conversation_mode", ["AI", "HUMAN", "PAUSED"]);
export const convStatusEnum = pgEnum("conversation_status", ["OPEN", "CLOSED"]);
export const priorityEnum = pgEnum("priority", ["LOW", "NORMAL", "HIGH", "URGENT"]);
export const authorEnum = pgEnum("message_author", ["CUSTOMER", "AI", "HUMAN", "SYSTEM"]);
export const packageStatusEnum = pgEnum("package_status", ["DRAFT", "REVIEW", "APPROVED", "ARCHIVED"]);
export const extractionEnum = pgEnum("extraction_status", ["PENDING", "DONE", "NEEDS_OCR", "FAILED"]);
export const deliveryEnum = pgEnum("delivery_status", ["SIMULATED", "SENT", "LINK_SENT", "FAILED"]);
export const integrationModeEnum = pgEnum("integration_mode", ["NOT_CONFIGURED", "MOCK", "LIVE"]);

export type Role = (typeof roleEnum.enumValues)[number];
export type Channel = (typeof channelEnum.enumValues)[number];
export type ConversationMode = (typeof modeEnum.enumValues)[number];

export const departments = pgTable("departments", {
  id: id(),
  key: text("key").notNull().unique(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
});

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull(),
  departmentId: text("department_id").references(() => departments.id),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export const customers = pgTable("customers", {
  id: id(),
  name: text("name"),
  phone: text("phone").unique(),
  email: text("email"),
  preferredLanguage: text("preferred_language"),
  budget: text("budget"),
  interests: text("interests").array().notNull().default([]),
  notes: text("notes"),
  departmentId: text("department_id").references(() => departments.id),
  assignedToId: text("assigned_to_id").references(() => users.id),
  isSimulated: boolean("is_simulated").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const channelIdentities = pgTable(
  "channel_identities",
  {
    id: id(),
    customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
    channel: channelEnum("channel").notNull(),
    externalId: text("external_id").notNull(),
    handle: text("handle"),
  },
  (t) => [uniqueIndex("channel_identity_unique").on(t.channel, t.externalId)],
);

export const conversations = pgTable(
  "conversations",
  {
    id: id(),
    customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
    channel: channelEnum("channel").notNull(),
    mode: modeEnum("mode").notNull().default("AI"),
    status: convStatusEnum("status").notNull().default("OPEN"),
    priority: priorityEnum("priority").notNull().default("NORMAL"),
    departmentId: text("department_id").references(() => departments.id),
    assignedToId: text("assigned_to_id").references(() => users.id),
    summary: text("summary"),
    handoffReason: text("handoff_reason"),
    isSimulated: boolean("is_simulated").notNull().default(false),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [index("conversation_last_msg").on(t.lastMessageAt)],
);

export const messages = pgTable(
  "messages",
  {
    id: id(),
    conversationId: text("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    author: authorEnum("author").notNull(),
    userId: text("user_id").references(() => users.id),
    text: text("text").notNull(),
    externalId: text("external_id").unique(), // platform message id → de-duplication
    meta: jsonb("meta"),
    createdAt: createdAt(),
  },
  (t) => [index("message_conv_created").on(t.conversationId, t.createdAt)],
);

export const pipelineStages = pgTable("pipeline_stages", {
  id: id(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  order: integer("order").notNull(),
  isWon: boolean("is_won").notNull().default(false),
  isLost: boolean("is_lost").notNull().default(false),
});

export const leads = pgTable(
  "leads",
  {
    id: id(),
    customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
    departmentId: text("department_id").notNull().references(() => departments.id),
    stageId: text("stage_id").notNull().references(() => pipelineStages.id),
    assignedToId: text("assigned_to_id").references(() => users.id),
    service: text("service"),
    destination: text("destination"),
    travelDate: text("travel_date"),
    travelers: integer("travelers"),
    budget: text("budget"),
    visaCategory: text("visa_category"),
    details: jsonb("details"),
    summary: text("summary"),
    score: integer("score").notNull().default(0),
    value: numeric("value", { precision: 14, scale: 2 }), // only when a human enters a quoted value
    valueCurrency: text("value_currency"),
    isSimulated: boolean("is_simulated").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("lead_created").on(t.createdAt)],
);

export const followUpReminders = pgTable("follow_up_reminders", {
  id: id(),
  customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  note: text("note").notNull(),
  doneAt: timestamp("done_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const documents = pgTable("documents", {
  id: id(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  storagePath: text("storage_path").notNull(),
  sha256: text("sha256").notNull(),
  kind: text("kind").notNull().default("PACKAGE"), // PACKAGE | KNOWLEDGE
  departmentId: text("department_id").references(() => departments.id),
  uploadedById: text("uploaded_by_id").references(() => users.id),
  extractionStatus: extractionEnum("extraction_status").notNull().default("PENDING"),
  extractionError: text("extraction_error"),
  text: text("text"),
  createdAt: createdAt(),
});

export type PackagePrice = { label: string; occupancy?: string; amount: number; currency: string };
export type PackageHotel = { name: string; city?: string; stars?: number };

export const packages = pgTable(
  "packages",
  {
    id: id(),
    departmentId: text("department_id").notNull().references(() => departments.id),
    name: text("name").notNull(),
    destination: text("destination"),
    country: text("country"),
    travelDates: text("travel_dates"),
    nights: integer("nights"),
    days: integer("days"),
    hotels: jsonb("hotels").$type<PackageHotel[]>(),
    mealPlan: text("meal_plan"),
    flights: text("flights"),
    transport: text("transport"),
    included: text("included").array().notNull().default([]),
    excluded: text("excluded").array().notNull().default([]),
    prices: jsonb("prices").$type<PackagePrice[]>(),
    childPolicy: text("child_policy"),
    cancellationPolicy: text("cancellation_policy"),
    validFrom: timestamp("valid_from", { withTimezone: true }),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    status: packageStatusEnum("status").notNull().default("DRAFT"),
    extractedBy: text("extracted_by"), // ai | manual
    sourceDocumentId: text("source_document_id").references(() => documents.id),
    version: integer("version").notNull().default(1),
    replacesId: text("replaces_id"),
    approvedById: text("approved_by_id").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("package_status_valid").on(t.status, t.validUntil)],
);

export const documentDeliveries = pgTable("document_deliveries", {
  id: id(),
  packageId: text("package_id").notNull().references(() => packages.id),
  customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  conversationId: text("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
  channel: channelEnum("channel").notNull(),
  status: deliveryEnum("status").notNull(),
  error: text("error"),
  createdAt: createdAt(),
});

export const knowledgeEntries = pgTable("knowledge_entries", {
  id: id(),
  departmentId: text("department_id").references(() => departments.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  internalOnly: boolean("internal_only").notNull().default(false), // never shown to customers
  approved: boolean("approved").notNull().default(false),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const aiSettings = pgTable("ai_settings", {
  id: text("id").primaryKey(), // "draft" | "published"
  assistantName: text("assistant_name").notNull(),
  style: text("style").notNull(),
  formality: integer("formality").notNull(), // 1 casual .. 5 formal
  emojiLevel: integer("emoji_level").notNull(), // 0 none .. 3 frequent
  maxSentences: integer("max_sentences").notNull(),
  salesApproach: text("sales_approach").notNull(),
  preferredPhrases: text("preferred_phrases").array().notNull().default([]),
  prohibitedPhrases: text("prohibited_phrases").array().notNull().default([]),
  escalationRules: text("escalation_rules").notNull(),
  updatedAt: updatedAt(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
});

export const aiRuns = pgTable(
  "ai_runs",
  {
    id: id(),
    conversationId: text("conversation_id").references(() => conversations.id, { onDelete: "cascade" }),
    engine: text("engine").notNull(), // claude | demo
    model: text("model"),
    latencyMs: integer("latency_ms").notNull(),
    toolCalls: jsonb("tool_calls"),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [index("ai_run_created").on(t.createdAt)],
);

export const integrations = pgTable("integrations", {
  key: text("key").primaryKey(), // FLEXIVI | META | WHATSAPP | ANTHROPIC | ZOHO
  mode: integrationModeEnum("mode").notNull().default("NOT_CONFIGURED"),
  lastCheck: timestamp("last_check", { withTimezone: true }),
  lastOk: timestamp("last_ok", { withTimezone: true }),
  lastError: text("last_error"),
  notes: text("notes"),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    actorId: text("actor_id").references(() => users.id),
    actorType: text("actor_type").notNull(), // USER | AI | SYSTEM
    action: text("action").notNull(),
    entity: text("entity"),
    entityId: text("entity_id"),
    details: jsonb("details"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_created").on(t.createdAt)],
);

// ── relations (for the query API) ─────────────────────────
export const customersRelations = relations(customers, ({ many, one }) => ({
  identities: many(channelIdentities),
  conversations: many(conversations),
  leads: many(leads),
  deliveries: many(documentDeliveries),
  department: one(departments, { fields: [customers.departmentId], references: [departments.id] }),
  assignedTo: one(users, { fields: [customers.assignedToId], references: [users.id] }),
}));
export const identitiesRelations = relations(channelIdentities, ({ one }) => ({
  customer: one(customers, { fields: [channelIdentities.customerId], references: [customers.id] }),
}));
export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  customer: one(customers, { fields: [conversations.customerId], references: [customers.id] }),
  department: one(departments, { fields: [conversations.departmentId], references: [departments.id] }),
  assignedTo: one(users, { fields: [conversations.assignedToId], references: [users.id] }),
  messages: many(messages),
  leads: many(leads),
}));
export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
  user: one(users, { fields: [messages.userId], references: [users.id] }),
}));
export const leadsRelations = relations(leads, ({ one }) => ({
  customer: one(customers, { fields: [leads.customerId], references: [customers.id] }),
  department: one(departments, { fields: [leads.departmentId], references: [departments.id] }),
  stage: one(pipelineStages, { fields: [leads.stageId], references: [pipelineStages.id] }),
  assignedTo: one(users, { fields: [leads.assignedToId], references: [users.id] }),
  conversation: one(conversations, { fields: [leads.conversationId], references: [conversations.id] }),
}));
export const packagesRelations = relations(packages, ({ one, many }) => ({
  department: one(departments, { fields: [packages.departmentId], references: [departments.id] }),
  sourceDocument: one(documents, { fields: [packages.sourceDocumentId], references: [documents.id] }),
  approvedBy: one(users, { fields: [packages.approvedById], references: [users.id] }),
  deliveries: many(documentDeliveries),
}));
export const deliveriesRelations = relations(documentDeliveries, ({ one }) => ({
  package: one(packages, { fields: [documentDeliveries.packageId], references: [packages.id] }),
  customer: one(customers, { fields: [documentDeliveries.customerId], references: [customers.id] }),
}));
export const usersRelations = relations(users, ({ one }) => ({
  department: one(departments, { fields: [users.departmentId], references: [departments.id] }),
}));
export const documentsRelations = relations(documents, ({ many }) => ({ packages: many(packages) }));
