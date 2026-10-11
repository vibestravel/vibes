// Server-side tools the AI may call. These are the ONLY way the AI touches data.
// Every tool validates input, scopes to the current conversation, and never returns internal-only content.
import "server-only";
import { z } from "zod";
import { and, eq, gte, ilike, isNull, or, sql, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  packages, leads, customers, conversations, departments, pipelineStages, knowledgeEntries, documentDeliveries,
} from "@/db/schema";
import { getFlexiVi, flexiviMode, isFresh, FlexiViError } from "@/lib/flexivi";
import { audit } from "@/lib/audit";
import { scoreLead } from "@/lib/leads";
import { deliverPackage } from "@/lib/channels";

export type ToolContext = { conversationId: string; customerId: string; channel: string; isSimulated: boolean };

export const DEPARTMENT_KEYS = ["OUTBOUND", "VISA", "RELIGIOUS", "BTU", "DMC", "RESERVATIONS"] as const;

const visaQ = { destination: z.string().min(2).max(40), category: z.string().min(2).max(40) };

export const TOOL_SCHEMAS = {
  search_packages: z.object({
    query: z.string().max(200).optional().describe("Free text: destination, city, theme (honeymoon, umrah...)"),
    department: z.enum(DEPARTMENT_KEYS).optional(),
    month: z.string().max(20).optional().describe("Travel month, e.g. 'December' or 'ديسمبر' or '2026-12'"),
    nights: z.number().int().min(1).max(60).optional(),
  }),
  send_package_document: z.object({ package_id: z.string().min(5).max(64) }),
  search_knowledge: z.object({ query: z.string().min(2).max(200) }),
  get_visa_destinations: z.object({}),
  get_visa_requirements: z.object({ ...visaQ, nationality: z.string().max(40).default("EG"), residence: z.string().max(40).default("EG") }),
  get_appointment_availability: z.object({ ...visaQ, city: z.string().max(40).optional() }),
  get_visa_fees: z.object(visaQ),
  get_application_centers: z.object({ destination: z.string().min(2).max(40), city: z.string().max(40).optional() }),
  update_lead: z.object({
    department: z.enum(DEPARTMENT_KEYS),
    service: z.string().max(120).optional(),
    destination: z.string().max(120).optional(),
    travel_date: z.string().max(80).optional(),
    travelers: z.number().int().min(1).max(500).optional(),
    budget: z.string().max(80).optional(),
    visa_category: z.string().max(40).optional(),
    name: z.string().max(120).optional(),
    phone: z.string().max(30).optional(),
    email: z.string().max(120).optional(),
    ready_to_book: z.boolean().optional(),
    summary: z.string().max(600).optional(),
  }),
  handoff_to_human: z.object({
    reason: z.enum(["complaint", "price_negotiation", "booking_or_payment", "refund", "unknown_answer", "customer_request", "visa_specialist", "other"]),
    note: z.string().max(400),
    department: z.enum(DEPARTMENT_KEYS).optional(),
    priority: z.enum(["NORMAL", "HIGH", "URGENT"]).default("HIGH"),
  }),
};
export type ToolName = keyof typeof TOOL_SCHEMAS;

export const TOOL_DESCRIPTIONS: Record<ToolName, string> = {
  search_packages: "Search APPROVED, currently valid Vibes travel packages. Only these may be recommended.",
  send_package_document: "Send the approved original package document (PDF/PPTX) to the customer on the current channel.",
  search_knowledge: "Search approved, customer-safe company knowledge (FAQ, policies, office info).",
  get_visa_destinations: "FlexiVi: list supported visa destinations and categories.",
  get_visa_requirements: "FlexiVi: verified document requirements for destination + category + nationality + residence.",
  get_appointment_availability: "FlexiVi: real appointment availability. Returns available=false when live data cannot be confirmed.",
  get_visa_fees: "FlexiVi: official, center and Vibes service fees plus processing time.",
  get_application_centers: "FlexiVi: embassy / visa application centers for a destination.",
  update_lead: "Create or update the CRM lead for this conversation with what the customer said. Call after each important new detail.",
  handoff_to_human: "Transfer the conversation to a human employee. AI stops replying afterwards.",
};

const MONTHS: Record<string, string[]> = {
  "01": ["jan", "يناير"], "02": ["feb", "فبراير"], "03": ["mar", "مارس"], "04": ["apr", "ابريل", "أبريل"],
  "05": ["may", "مايو"], "06": ["jun", "يونيو"], "07": ["jul", "يوليو"], "08": ["aug", "اغسطس", "أغسطس"],
  "09": ["sep", "سبتمبر"], "10": ["oct", "اكتوبر", "أكتوبر"], "11": ["nov", "نوفمبر"], "12": ["dec", "ديسمبر"],
};
function monthTerms(m?: string) {
  if (!m) return [];
  const low = m.toLowerCase();
  for (const [num, names] of Object.entries(MONTHS)) {
    if (low.includes(`-${num}`) || names.some((n) => low.includes(n))) return [...names, `-${num}-`];
  }
  return [low];
}

async function deptId(key?: string) {
  if (!key) return null;
  const [d] = await db.select().from(departments).where(eq(departments.key, key));
  return d?.id ?? null;
}

function visaUnavailable(reason: string) {
  return { available: false, reason, instruction: "Tell the customer you cannot confirm this right now and offer a visa specialist. Do NOT guess." };
}

export async function executeTool(name: string, rawInput: unknown, ctx: ToolContext): Promise<unknown> {
  if (!(name in TOOL_SCHEMAS)) return { error: `unknown tool ${name}` };
  const parsed = TOOL_SCHEMAS[name as ToolName].safeParse(rawInput ?? {});
  if (!parsed.success) return { error: "invalid input", issues: parsed.error.issues.map((i) => i.message) };
  const input = parsed.data as Record<string, any>;

  switch (name as ToolName) {
    case "search_packages": {
      const conds = [eq(packages.status, "APPROVED"), or(isNull(packages.validUntil), gte(packages.validUntil, new Date()))];
      if (input.department) { const d = await deptId(input.department); if (d) conds.push(eq(packages.departmentId, d)); }
      if (input.query) {
        const words = String(input.query).split(/\s+/).filter((w) => w.length > 1).slice(0, 5);
        if (words.length) conds.push(or(...words.flatMap((w) => [
          ilike(packages.name, `%${w}%`), ilike(packages.destination, `%${w}%`), ilike(packages.country, `%${w}%`),
        ])));
      }
      const mt = monthTerms(input.month);
      if (mt.length) conds.push(or(...mt.map((t) => ilike(packages.travelDates, `%${t}%`)), isNull(packages.travelDates)));
      if (input.nights) conds.push(or(isNull(packages.nights), sql`abs(${packages.nights} - ${input.nights}) <= 2`));
      const rows = await db.select().from(packages).where(and(...conds)).orderBy(desc(packages.approvedAt)).limit(5);
      return {
        count: rows.length,
        packages: rows.map((p) => ({
          id: p.id, name: p.name, destination: p.destination, country: p.country, travel_dates: p.travelDates,
          nights: p.nights, days: p.days, hotels: p.hotels, meal_plan: p.mealPlan, transport: p.transport, flights: p.flights,
          included: p.included, excluded: p.excluded, prices: p.prices, child_policy: p.childPolicy,
          cancellation: p.cancellationPolicy, valid_until: p.validUntil?.toISOString().slice(0, 10) ?? null,
          has_document: Boolean(p.sourceDocumentId),
        })),
        note: rows.length ? "Quote prices exactly as listed." : "No approved package matches. Say so honestly; offer a human consultant.",
      };
    }

    case "send_package_document": {
      const [p] = await db.select().from(packages).where(and(eq(packages.id, input.package_id), eq(packages.status, "APPROVED")));
      if (!p || (p.validUntil && p.validUntil < new Date())) return { ok: false, error: "package not approved or expired" };
      if (!p.sourceDocumentId) return { ok: false, error: "package has no document" };
      const r = await deliverPackage({ pkg: p, conversationId: ctx.conversationId, customerId: ctx.customerId, channel: ctx.channel as never, isSimulated: ctx.isSimulated });
      return r;
    }

    case "search_knowledge": {
      const q = `%${input.query}%`;
      const rows = await db.select({ title: knowledgeEntries.title, content: knowledgeEntries.content }).from(knowledgeEntries)
        .where(and(eq(knowledgeEntries.approved, true), eq(knowledgeEntries.internalOnly, false),
          or(isNull(knowledgeEntries.validUntil), gte(knowledgeEntries.validUntil, new Date())),
          or(ilike(knowledgeEntries.title, q), ilike(knowledgeEntries.content, q))))
        .limit(4);
      return { results: rows };
    }

    case "get_visa_destinations":
    case "get_visa_requirements":
    case "get_appointment_availability":
    case "get_visa_fees":
    case "get_application_centers": {
      const fv = getFlexiVi();
      if (!fv) return visaUnavailable("FlexiVi not configured");
      if (fv.mode === "MOCK" && !ctx.isSimulated) return visaUnavailable("FlexiVi live connection not active yet");
      try {
        const dest = input.destination ? String(input.destination).toUpperCase().slice(0, 2) : "";
        let env;
        if (name === "get_visa_destinations") env = await fv.listDestinations();
        else if (name === "get_visa_requirements") {
          env = await fv.getRequirements({ destination: dest, category: input.category.toUpperCase(), nationality: input.nationality, residence: input.residence });
          const d = env.data as { status?: string; requirements?: unknown[] };
          if (d.status === "UNDER_REVIEW" || !d.requirements?.length) return visaUnavailable("requirements incomplete or under review — escalate to a visa specialist");
        }
        else if (name === "get_appointment_availability") {
          env = await fv.getAvailability({ destination: dest, category: input.category.toUpperCase(), city: input.city });
          if (!isFresh(env.verifiedAt)) return visaUnavailable(`availability data is stale (last verified ${env.verifiedAt})`);
        } else if (name === "get_visa_fees") env = await fv.getFees({ destination: dest, category: input.category.toUpperCase() });
        else env = await fv.listCenters(dest, input.city);
        return {
          available: true,
          is_demo_data: env.source === "MOCK",
          demo_warning: env.source === "MOCK" ? "DEMO DATA — say clearly this is test data, not real." : undefined,
          last_verified_at: env.verifiedAt,
          data: env.data,
          reminder: name === "get_appointment_availability" ? "Mention last verified time and that availability can change." : undefined,
        };
      } catch (e) {
        await audit({ actorType: "SYSTEM", action: "flexivi.error", entity: "conversation", entityId: ctx.conversationId, details: { tool: name, error: (e as Error).message } });
        return visaUnavailable(e instanceof FlexiViError ? e.code : "error");
      }
    }

    case "update_lead": {
      const department = await deptId(input.department);
      if (!department) return { ok: false, error: "unknown department" };
      // customer fields
      const cust: Partial<typeof customers.$inferInsert> = {};
      if (input.name) cust.name = input.name;
      if (input.email) cust.email = input.email;
      if (input.budget) cust.budget = input.budget;
      if (input.phone) {
        const phone = input.phone.replace(/[^\d+]/g, "");
        const [other] = await db.select({ id: customers.id }).from(customers).where(eq(customers.phone, phone));
        if (!other || other.id === ctx.customerId) cust.phone = phone; // never merge records silently
      }
      if (Object.keys(cust).length) await db.update(customers).set({ ...cust, departmentId: department }).where(eq(customers.id, ctx.customerId));

      const [existing] = await db.select().from(leads).where(eq(leads.conversationId, ctx.conversationId)).orderBy(desc(leads.createdAt)).limit(1);
      const [cRow] = await db.select().from(customers).where(eq(customers.id, ctx.customerId));
      const fields = {
        departmentId: department,
        service: input.service ?? existing?.service ?? null,
        destination: input.destination ?? existing?.destination ?? null,
        travelDate: input.travel_date ?? existing?.travelDate ?? null,
        travelers: input.travelers ?? existing?.travelers ?? null,
        budget: input.budget ?? existing?.budget ?? null,
        visaCategory: input.visa_category ?? existing?.visaCategory ?? null,
        summary: input.summary ?? existing?.summary ?? null,
      };
      const readyToBook = input.ready_to_book ?? Boolean((existing?.details as any)?.readyToBook);
      const score = scoreLead({ ...fields, phone: cRow?.phone, name: cRow?.name, readyToBook });
      const stageKey = score >= 60 ? "QUALIFIED" : "AI_QUALIFICATION";
      const [stage] = await db.select().from(pipelineStages).where(eq(pipelineStages.key, stageKey));

      let leadId: string;
      if (existing) {
        const [cur] = await db.select().from(pipelineStages).where(eq(pipelineStages.id, existing.stageId));
        const keepStage = cur && cur.order > (stage?.order ?? 0); // never move a lead backwards
        await db.update(leads).set({ ...fields, score, details: { ...(existing.details as object), readyToBook }, stageId: keepStage ? existing.stageId : stage.id }).where(eq(leads.id, existing.id));
        leadId = existing.id;
      } else {
        const [row] = await db.insert(leads).values({
          ...fields, customerId: ctx.customerId, conversationId: ctx.conversationId, stageId: stage.id, score,
          details: { readyToBook }, isSimulated: ctx.isSimulated,
        }).returning({ id: leads.id });
        leadId = row.id;
      }
      await db.update(conversations).set({ departmentId: department, summary: fields.summary }).where(eq(conversations.id, ctx.conversationId));
      await audit({ actorType: "AI", action: existing ? "lead.update" : "lead.create", entity: "lead", entityId: leadId, details: { score } });
      return { ok: true, lead_id: leadId, score, stage: stageKey, note: readyToBook ? "Customer is ready: hand off to a human for booking." : undefined };
    }

    case "handoff_to_human": {
      const department = await deptId(input.department);
      await db.update(conversations).set({
        mode: "HUMAN", priority: input.priority, handoffReason: `${input.reason}: ${input.note}`,
        ...(department ? { departmentId: department } : {}),
      }).where(eq(conversations.id, ctx.conversationId));
      const [assigned] = await db.select().from(pipelineStages).where(eq(pipelineStages.key, "ASSIGNED"));
      const [lead] = await db.select().from(leads).where(eq(leads.conversationId, ctx.conversationId)).limit(1);
      if (lead && assigned) await db.update(leads).set({ stageId: assigned.id }).where(eq(leads.id, lead.id));
      await audit({ actorType: "AI", action: "conversation.handoff", entity: "conversation", entityId: ctx.conversationId, details: input });
      return { ok: true, instruction: "Tell the customer a team member will continue shortly. Do not continue selling." };
    }
  }
}

export function flexiviModeForPrompt() { return flexiviMode(); }
