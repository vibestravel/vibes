"use server";
// Server actions. Every action re-checks the session and role, and writes an audit log.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { conversations, leads, packages, pipelineStages, aiSettings, knowledgeEntries, users, customers, followUpReminders } from "@/db/schema";
import { requireUser, hashPassword } from "@/lib/auth";
import { ACCESS } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { sendHumanMessage, replyIfAiMode, findOrCreateConversation, storeCustomerMessage, getThread } from "@/lib/conversations";
import { ingestFile } from "@/lib/packages/ingest";
import { getFlexiVi } from "@/lib/flexivi";

// ── inbox ────────────────────────────────────────────────
export async function setMode(conversationId: string, mode: "AI" | "HUMAN" | "PAUSED") {
  const u = await requireUser(ACCESS.inbox);
  await db.update(conversations).set({ mode, ...(mode === "HUMAN" ? { assignedToId: u.id } : {}), ...(mode === "AI" ? { handoffReason: null } : {}) }).where(eq(conversations.id, conversationId));
  await audit({ actorId: u.id, actorType: "USER", action: `conversation.mode.${mode}`, entity: "conversation", entityId: conversationId });
  revalidatePath(`/inbox/${conversationId}`);
}

export async function humanReply(conversationId: string, form: FormData) {
  const u = await requireUser(ACCESS.inbox);
  const text = String(form.get("text") ?? "").trim().slice(0, 4000);
  if (text) await sendHumanMessage(conversationId, u.id, text);
  revalidatePath(`/inbox/${conversationId}`);
}

export async function closeConversation(conversationId: string) {
  const u = await requireUser(ACCESS.inbox);
  await db.update(conversations).set({ status: "CLOSED" }).where(eq(conversations.id, conversationId));
  await audit({ actorId: u.id, actorType: "USER", action: "conversation.close", entity: "conversation", entityId: conversationId });
  revalidatePath("/inbox");
}

// ── simulator ────────────────────────────────────────────
export async function simulatorSend(conversationId: string | null, text: string) {
  const u = await requireUser(ACCESS.simulator);
  const clean = text.trim().slice(0, 2000);
  if (!clean) return null;
  let id = conversationId;
  if (!id) {
    const c = await findOrCreateConversation({ channel: "SIMULATOR", externalUserId: `sim-${u.id}-${Date.now()}`, name: "عميل تجريبي", isSimulated: true });
    id = c.id;
  }
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
  if (!conv?.isSimulated) throw new Error("not a simulator conversation");
  await storeCustomerMessage(id, clean);
  await replyIfAiMode(id);
  return loadSimulator(id);
}

export async function loadSimulator(id: string) {
  await requireUser(ACCESS.simulator);
  const t = await getThread(id);
  if (!t || !t.isSimulated) return null;
  const { aiRuns } = await import("@/db/schema");
  const runs = await db.select().from(aiRuns).where(eq(aiRuns.conversationId, id));
  return {
    id: t.id, mode: t.mode, handoffReason: t.handoffReason,
    messages: t.messages.map((m) => ({ id: m.id, author: m.author, text: m.text, meta: m.meta as Record<string, unknown> | null, at: m.createdAt.toISOString() })),
    runs: runs.map((r) => ({ id: r.id, engine: r.engine, latencyMs: r.latencyMs, toolCalls: r.toolCalls as unknown[] | null, error: r.error, at: r.createdAt.toISOString() })),
    lead: t.customer.leads[0] ? { score: t.customer.leads[0].score, destination: t.customer.leads[0].destination, travelDate: t.customer.leads[0].travelDate, budget: t.customer.leads[0].budget } : null,
    customer: { name: t.customer.name, phone: t.customer.phone },
  };
}

// ── CRM ──────────────────────────────────────────────────
export async function moveLead(leadId: string, stageId: string) {
  const u = await requireUser(ACCESS.crm);
  await db.update(leads).set({ stageId }).where(eq(leads.id, leadId));
  await audit({ actorId: u.id, actorType: "USER", action: "lead.stage", entity: "lead", entityId: leadId, details: { stageId } });
  revalidatePath("/crm");
}

export async function updateLeadValue(leadId: string, form: FormData) {
  const u = await requireUser(ACCESS.crm);
  const v = String(form.get("value") ?? "").trim();
  const currency = String(form.get("currency") ?? "EGP").slice(0, 3);
  await db.update(leads).set({ value: v ? String(Number(v)) : null, valueCurrency: v ? currency : null, assignedToId: u.id }).where(eq(leads.id, leadId));
  await audit({ actorId: u.id, actorType: "USER", action: "lead.value", entity: "lead", entityId: leadId });
  revalidatePath("/crm");
}

export async function saveCustomerNotes(customerId: string, form: FormData) {
  const u = await requireUser(ACCESS.crm);
  await db.update(customers).set({ notes: String(form.get("notes") ?? "").slice(0, 5000) }).where(eq(customers.id, customerId));
  const due = String(form.get("dueAt") ?? ""); const note = String(form.get("reminder") ?? "").trim();
  if (due && note) await db.insert(followUpReminders).values({ customerId, dueAt: new Date(due), note: note.slice(0, 500) });
  await audit({ actorId: u.id, actorType: "USER", action: "customer.notes", entity: "customer", entityId: customerId });
  revalidatePath(`/crm/${customerId}`);
}

// ── packages ─────────────────────────────────────────────
export async function uploadPackages(_: unknown, form: FormData) {
  const u = await requireUser(ACCESS.packages);
  const departmentId = String(form.get("departmentId") ?? "");
  if (!departmentId) return { results: [], error: "اختار القسم" };
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 30);
  const results = [];
  for (const f of files) results.push(await ingestFile(f, { departmentId, userId: u.id }));
  revalidatePath("/packages");
  return { results };
}

const lines = (v: FormDataEntryValue | null) => String(v ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
const priceSchema = z.array(z.object({ label: z.string().min(1), occupancy: z.string().optional(), amount: z.number().nonnegative(), currency: z.string().min(3).max(3) }));

export async function savePackage(id: string, form: FormData) {
  const u = await requireUser(ACCESS.packages);
  const priceLines = lines(form.get("prices")).map((l) => {
    const [label, occupancy, amount, currency] = l.split("|").map((s) => s.trim());
    return { label, occupancy: occupancy || undefined, amount: Number(amount), currency: (currency || "EGP").toUpperCase() };
  });
  const prices = priceSchema.safeParse(priceLines);
  if (!prices.success) redirect(`/packages/${id}?err=prices`);
  const hotels = lines(form.get("hotels")).map((l) => { const [name, city, stars] = l.split("|").map((s) => s.trim()); return { name, city: city || undefined, stars: stars ? Number(stars) : undefined }; });
  const num = (k: string) => { const v = String(form.get(k) ?? "").trim(); return v ? Number(v) : null; };
  const date = (k: string) => { const v = String(form.get(k) ?? ""); return v ? new Date(v) : null; };
  await db.update(packages).set({
    name: String(form.get("name")).slice(0, 200), departmentId: String(form.get("departmentId")),
    destination: String(form.get("destination") || "") || null, country: String(form.get("country") || "") || null,
    travelDates: String(form.get("travelDates") || "") || null, nights: num("nights"), days: num("days"),
    mealPlan: String(form.get("mealPlan") || "") || null, flights: String(form.get("flights") || "") || null,
    transport: String(form.get("transport") || "") || null, hotels, prices: prices.data,
    included: lines(form.get("included")), excluded: lines(form.get("excluded")),
    childPolicy: String(form.get("childPolicy") || "") || null, cancellationPolicy: String(form.get("cancellationPolicy") || "") || null,
    validFrom: date("validFrom"), validUntil: date("validUntil"),
    status: "REVIEW", approvedAt: null, approvedById: null, // any edit requires re-approval
  }).where(eq(packages.id, id));
  await audit({ actorId: u.id, actorType: "USER", action: "package.edit", entity: "package", entityId: id });
  redirect(`/packages/${id}?saved=1`);
}

export async function setPackageStatus(id: string, status: "APPROVED" | "ARCHIVED" | "REVIEW") {
  const u = await requireUser(ACCESS.packages);
  const [p] = await db.select().from(packages).where(eq(packages.id, id));
  if (!p) return;
  if (status === "APPROVED") {
    if (!p.prices?.length) redirect(`/packages/${id}?err=noprice`);
    if (p.validUntil && p.validUntil < new Date()) redirect(`/packages/${id}?err=expired`);
  }
  await db.update(packages).set({ status, ...(status === "APPROVED" ? { approvedById: u.id, approvedAt: new Date() } : {}) }).where(eq(packages.id, id));
  await audit({ actorId: u.id, actorType: "USER", action: `package.${status.toLowerCase()}`, entity: "package", entityId: id });
  revalidatePath(`/packages/${id}`); revalidatePath("/packages");
}

// ── FlexiVi ──────────────────────────────────────────────
export async function testFlexiVi() {
  const u = await requireUser(ACCESS.flexivi);
  const fv = getFlexiVi();
  const { integrations } = await import("@/db/schema");
  const now = new Date();
  if (!fv) {
    await db.update(integrations).set({ mode: "NOT_CONFIGURED", lastCheck: now, lastError: "FLEXIVI_BASE_URL / FLEXIVI_API_KEY missing" }).where(eq(integrations.key, "FLEXIVI"));
  } else {
    const h = await fv.health();
    await db.update(integrations).set({ mode: fv.mode === "LIVE" ? (h.ok ? "LIVE" : "NOT_CONFIGURED") : "MOCK", lastCheck: now, ...(h.ok ? { lastOk: now, lastError: null } : { lastError: h.error ?? "failed" }) }).where(eq(integrations.key, "FLEXIVI"));
  }
  await audit({ actorId: u.id, actorType: "USER", action: "flexivi.test" });
  revalidatePath("/flexivi");
}

// ── personality ──────────────────────────────────────────
export async function savePersonality(form: FormData) {
  const u = await requireUser(["CEO"]);
  const arr = (k: string) => lines(form.get(k)).slice(0, 30);
  const clamp = (k: string, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number(form.get(k) ?? lo)));
  await db.update(aiSettings).set({
    assistantName: String(form.get("assistantName")).slice(0, 60), style: String(form.get("style")).slice(0, 2000),
    formality: clamp("formality", 1, 5), emojiLevel: clamp("emojiLevel", 0, 3), maxSentences: clamp("maxSentences", 1, 8),
    salesApproach: String(form.get("salesApproach")).slice(0, 2000), escalationRules: String(form.get("escalationRules")).slice(0, 2000),
    preferredPhrases: arr("preferredPhrases"), prohibitedPhrases: arr("prohibitedPhrases"),
  }).where(eq(aiSettings.id, "draft"));
  await audit({ actorId: u.id, actorType: "USER", action: "personality.draft" });
  redirect("/personality?saved=1");
}

export async function publishPersonality() {
  const u = await requireUser(["CEO"]);
  const [d] = await db.select().from(aiSettings).where(eq(aiSettings.id, "draft"));
  const { id: _id, updatedAt: _u, publishedAt: _p, ...rest } = d;
  await db.update(aiSettings).set({ ...rest, publishedAt: new Date() }).where(eq(aiSettings.id, "published"));
  await audit({ actorId: u.id, actorType: "USER", action: "personality.publish" });
  redirect("/personality?published=1");
}

// ── knowledge ────────────────────────────────────────────
export async function addKnowledge(form: FormData) {
  const u = await requireUser(ACCESS.knowledge);
  const dept = String(form.get("departmentId") || "") || null;
  await db.insert(knowledgeEntries).values({
    title: String(form.get("title")).slice(0, 200), content: String(form.get("content")).slice(0, 10000), departmentId: dept,
    internalOnly: form.get("internalOnly") === "on", approved: false,
    validUntil: form.get("validUntil") ? new Date(String(form.get("validUntil"))) : null,
  });
  await audit({ actorId: u.id, actorType: "USER", action: "knowledge.add" });
  revalidatePath("/knowledge");
}
export async function approveKnowledge(id: string, approved: boolean) {
  const u = await requireUser(ACCESS.knowledge);
  await db.update(knowledgeEntries).set({ approved }).where(eq(knowledgeEntries.id, id));
  await audit({ actorId: u.id, actorType: "USER", action: approved ? "knowledge.approve" : "knowledge.unapprove", entityId: id });
  revalidatePath("/knowledge");
}

// ── team ─────────────────────────────────────────────────
const userSchema = z.object({
  name: z.string().min(2).max(100), email: z.email(), password: z.string().min(10).max(200),
  role: z.enum(["CEO", "DEPT_MANAGER", "SALES_AGENT", "CONTENT_MANAGER", "SYSADMIN"]), departmentId: z.string().optional(),
});
export async function createUser(_: unknown, form: FormData) {
  const u = await requireUser(ACCESS.team);
  const p = userSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "راجع البيانات: كلمة السر 10 حروف على الأقل والإيميل صحيح." };
  if (p.data.role === "CEO" && u.role !== "CEO") return { error: "مسموح للمدير التنفيذي بس." };
  const [exists] = await db.select().from(users).where(eq(users.email, p.data.email.toLowerCase()));
  if (exists) return { error: "الإيميل ده متسجل." };
  await db.insert(users).values({ name: p.data.name, email: p.data.email.toLowerCase(), role: p.data.role, departmentId: p.data.departmentId || null, passwordHash: await hashPassword(p.data.password) });
  await audit({ actorId: u.id, actorType: "USER", action: "user.create", details: { email: p.data.email, role: p.data.role } });
  revalidatePath("/team");
  return { ok: true };
}
export async function toggleUser(id: string, active: boolean) {
  const u = await requireUser(ACCESS.team);
  if (id === u.id) return;
  await db.update(users).set({ active }).where(eq(users.id, id));
  await audit({ actorId: u.id, actorType: "USER", action: active ? "user.enable" : "user.disable", entityId: id });
  revalidatePath("/team");
}
export async function changePassword(_: unknown, form: FormData) {
  const u = await requireUser();
  const pw = String(form.get("password") ?? "");
  if (pw.length < 10) return { error: "10 حروف على الأقل." };
  await db.update(users).set({ passwordHash: await hashPassword(pw) }).where(eq(users.id, u.id));
  await audit({ actorId: u.id, actorType: "USER", action: "user.password" });
  return { ok: true };
}

export async function stagesList() { return db.select().from(pipelineStages).orderBy(pipelineStages.order); }
