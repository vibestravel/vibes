// Conversation orchestration: store inbound → (if AI mode) generate reply → deliver.
// A per-conversation Postgres advisory lock prevents duplicate or simultaneous replies.
import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { conversations, messages, customers, channelIdentities, aiRuns, type Channel } from "@/db/schema";
import { getSettings, buildSystemPrompt } from "@/lib/ai/settings";
import { runClaude, aiConfigured, type HistoryItem } from "@/lib/ai/engine";
import { runDemo } from "@/lib/ai/demo-engine";
import { flexiviMode } from "@/lib/flexivi";
import { sendText } from "@/lib/channels";
import { audit } from "@/lib/audit";

const FALLBACK = "معلش، حصلت مشكلة صغيرة عندي. حد من فريق فايبس هيكمل معاك حالًا ❤️";

export async function findOrCreateConversation(a: { channel: Channel; externalUserId: string; name?: string | null; isSimulated?: boolean }) {
  const [ident] = await db.select().from(channelIdentities).where(and(eq(channelIdentities.channel, a.channel), eq(channelIdentities.externalId, a.externalUserId)));
  let customerId = ident?.customerId;
  if (!customerId) {
    const phone = a.channel === "WHATSAPP" ? a.externalUserId.replace(/[^\d+]/g, "") : null;
    const [existing] = phone ? await db.select().from(customers).where(eq(customers.phone, phone)) : [];
    customerId = existing?.id ?? (await db.insert(customers).values({ name: a.name ?? null, phone, isSimulated: !!a.isSimulated }).returning({ id: customers.id }))[0].id;
    await db.insert(channelIdentities).values({ customerId, channel: a.channel, externalId: a.externalUserId, handle: a.name ?? null }).onConflictDoNothing();
  }
  const [open] = await db.select().from(conversations)
    .where(and(eq(conversations.customerId, customerId), eq(conversations.channel, a.channel), eq(conversations.status, "OPEN")))
    .orderBy(desc(conversations.lastMessageAt)).limit(1);
  if (open) return open;
  const [c] = await db.insert(conversations).values({ customerId, channel: a.channel, isSimulated: !!a.isSimulated }).returning();
  return c;
}

/** Store a customer message. Returns false if it was a duplicate (same platform message id). */
export async function storeCustomerMessage(conversationId: string, text: string, externalId?: string) {
  const inserted = await db.insert(messages).values({ conversationId, author: "CUSTOMER", text: text.slice(0, 4000), externalId })
    .onConflictDoNothing({ target: messages.externalId }).returning({ id: messages.id });
  if (!inserted.length) return false;
  await db.update(conversations).set({ lastMessageAt: new Date() }).where(eq(conversations.id, conversationId));
  return true;
}

/** Generate and deliver an AI reply if the conversation is in AI mode. Safe to call concurrently. */
export async function replyIfAiMode(conversationId: string, recipient?: string) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${conversationId}))`);
    const [conv] = await tx.select().from(conversations).where(eq(conversations.id, conversationId));
    if (!conv || conv.mode !== "AI" || conv.status !== "OPEN") return null;

    const rows = await tx.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(desc(messages.createdAt)).limit(30);
    rows.reverse();
    if (rows.at(-1)?.author !== "CUSTOMER") return null; // already answered → no duplicate reply

    const history: HistoryItem[] = rows.map((m) => ({ author: m.author, text: m.text }));
    const ctx = { conversationId, customerId: conv.customerId, channel: conv.channel, isSimulated: conv.isSimulated };
    const useClaude = aiConfigured();

    if (!useClaude && !conv.isSimulated) {
      // No real AI configured: never auto-reply to real customers with the demo engine.
      await tx.update(conversations).set({ mode: "HUMAN", handoffReason: "AI غير مفعّل (مفيش مفتاح Anthropic)" }).where(eq(conversations.id, conversationId));
      return null;
    }

    const t0 = Date.now();
    let text = "", toolCalls: unknown[] = [], error: string | undefined, model: string | undefined;
    try {
      if (useClaude) {
        const settings = await getSettings(conv.isSimulated ? "draft" : "published");
        const system = buildSystemPrompt(settings, { channel: conv.channel, isSimulated: conv.isSimulated, flexiviMode: flexiviMode(), today: new Date().toISOString().slice(0, 10) });
        const r = await runClaude(system, history, ctx);
        ({ text, toolCalls, model } = r);
      } else {
        const r = await runDemo(history, ctx);
        ({ text, toolCalls, model } = r);
      }
    } catch (e) {
      error = (e as Error).message;
    }
    if (!text) {
      text = FALLBACK;
      await tx.update(conversations).set({ mode: "HUMAN", priority: "HIGH", handoffReason: `خطأ في المساعد: ${error ?? "رد فاضي"}` }).where(eq(conversations.id, conversationId));
    }
    await tx.insert(aiRuns).values({ conversationId, engine: useClaude ? "claude" : "demo", model, latencyMs: Date.now() - t0, toolCalls: toolCalls as object, error });

    const sent = recipient ? await sendText(conv.channel, recipient, text) : { status: conv.channel === "SIMULATOR" ? "SIMULATED" : "NOT_CONFIGURED" };
    const [msg] = await tx.insert(messages).values({
      conversationId, author: "AI", text,
      externalId: "externalId" in sent ? sent.externalId : undefined,
      meta: { engine: useClaude ? "claude" : "demo", delivery: sent.status, tools: (toolCalls as { name: string }[]).map((t) => t.name) },
    }).returning();
    await tx.update(conversations).set({ lastMessageAt: new Date() }).where(eq(conversations.id, conversationId));
    if (error) await audit({ actorType: "AI", action: "ai.error", entity: "conversation", entityId: conversationId, details: { error } });
    return msg;
  });
}

export async function sendHumanMessage(conversationId: string, userId: string, text: string) {
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId));
  if (!conv) throw new Error("not found");
  // sending as a human takes over the conversation so the AI stops immediately
  await db.update(conversations).set({ mode: "HUMAN", assignedToId: conv.assignedToId ?? userId, lastMessageAt: new Date() }).where(eq(conversations.id, conversationId));
  const [ident] = await db.select().from(channelIdentities).where(and(eq(channelIdentities.customerId, conv.customerId), eq(channelIdentities.channel, conv.channel)));
  const sent = ident ? await sendText(conv.channel, ident.externalId, text) : { status: "NOT_CONFIGURED" as const };
  await db.insert(messages).values({ conversationId, author: "HUMAN", userId, text, meta: { delivery: sent.status } });
  await audit({ actorId: userId, actorType: "USER", action: "message.send", entity: "conversation", entityId: conversationId, details: { delivery: sent.status } });
}

export async function getThread(conversationId: string) {
  return db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
    with: { customer: { with: { identities: true, leads: true } }, messages: { orderBy: asc(messages.createdAt), with: { user: true } }, department: true, assignedTo: true },
  });
}
