// Dashboard metrics — computed only from tracked data. Nothing is estimated.
import "server-only";
import { and, avg, count, desc, eq, gte, lt, sql, isNotNull, sum } from "drizzle-orm";
import { db } from "@/db";
import { conversations, leads, departments, aiRuns, documentDeliveries, packages, messages, users, pipelineStages } from "@/db/schema";

export type Range = { from: Date; to: Date; key: string };

export function parseRange(sp: { range?: string; from?: string; to?: string }): Range {
  const tz = "Africa/Cairo";
  const startOfDay = (d: Date) => { const s = new Date(d.toLocaleString("en-US", { timeZone: tz })); const off = d.getTime() - s.getTime(); s.setHours(0, 0, 0, 0); return new Date(s.getTime() + off); };
  const now = new Date();
  const today = startOfDay(now);
  const day = 864e5;
  switch (sp.range) {
    case "yesterday": return { from: new Date(today.getTime() - day), to: today, key: "yesterday" };
    case "week": return { from: new Date(today.getTime() - 6 * day), to: now, key: "week" };
    case "month": return { from: new Date(today.getTime() - 29 * day), to: now, key: "month" };
    case "custom": {
      const f = sp.from ? new Date(sp.from) : today, t = sp.to ? new Date(new Date(sp.to).getTime() + day) : now;
      return { from: f, to: t, key: "custom" };
    }
    default: return { from: today, to: now, key: "today" };
  }
}

export async function dashboardMetrics(r: Range, opts: { includeSimulated: boolean; departmentId: string | null }) {
  const convIn = and(gte(conversations.createdAt, r.from), lt(conversations.createdAt, r.to),
    opts.includeSimulated ? undefined : eq(conversations.isSimulated, false),
    opts.departmentId ? eq(conversations.departmentId, opts.departmentId) : undefined);
  const leadIn = and(gte(leads.createdAt, r.from), lt(leads.createdAt, r.to),
    opts.includeSimulated ? undefined : eq(leads.isSimulated, false),
    opts.departmentId ? eq(leads.departmentId, opts.departmentId) : undefined);

  const [[inq], [newLeads], [qualified], [won], [handoffs], [aiLatency], [pipeline], byDept, byChannel, topDest, topVisa, topPackages, employee] = await Promise.all([
    db.select({ n: count() }).from(conversations).where(convIn),
    db.select({ n: count() }).from(leads).where(leadIn),
    db.select({ n: count() }).from(leads).where(and(leadIn, gte(leads.score, 60))),
    db.select({ n: count() }).from(leads).innerJoin(pipelineStages, eq(leads.stageId, pipelineStages.id)).where(and(leadIn, eq(pipelineStages.isWon, true))),
    db.select({ n: count() }).from(conversations).where(and(convIn, isNotNull(conversations.handoffReason))),
    db.select({ ms: avg(aiRuns.latencyMs), n: count() }).from(aiRuns).innerJoin(conversations, eq(aiRuns.conversationId, conversations.id))
      .where(and(gte(aiRuns.createdAt, r.from), lt(aiRuns.createdAt, r.to), opts.includeSimulated ? undefined : eq(conversations.isSimulated, false))),
    db.select({ total: sum(leads.value), n: count(leads.value) }).from(leads).where(and(leadIn, isNotNull(leads.value))),
    db.select({ name: departments.nameAr, n: count() }).from(leads).innerJoin(departments, eq(leads.departmentId, departments.id)).where(leadIn).groupBy(departments.nameAr).orderBy(desc(count())),
    db.select({ channel: conversations.channel, n: count() }).from(leads).innerJoin(conversations, eq(leads.conversationId, conversations.id)).where(leadIn).groupBy(conversations.channel).orderBy(desc(count())),
    db.select({ name: leads.destination, n: count() }).from(leads).where(and(leadIn, isNotNull(leads.destination))).groupBy(leads.destination).orderBy(desc(count())).limit(6),
    db.select({ name: leads.destination, n: count() }).from(leads).innerJoin(departments, eq(leads.departmentId, departments.id))
      .where(and(leadIn, eq(departments.key, "VISA"), isNotNull(leads.destination))).groupBy(leads.destination).orderBy(desc(count())).limit(6),
    db.select({ name: packages.name, n: count() }).from(documentDeliveries).innerJoin(packages, eq(documentDeliveries.packageId, packages.id))
      .where(and(gte(documentDeliveries.createdAt, r.from), lt(documentDeliveries.createdAt, r.to), opts.includeSimulated ? undefined : sql`${documentDeliveries.status} <> 'SIMULATED'`))
      .groupBy(packages.name).orderBy(desc(count())).limit(6),
    db.select({ name: users.name, n: count() }).from(messages).innerJoin(users, eq(messages.userId, users.id))
      .where(and(eq(messages.author, "HUMAN"), gte(messages.createdAt, r.from), lt(messages.createdAt, r.to))).groupBy(users.name).orderBy(desc(count())).limit(8),
  ]);

  return {
    inquiries: inq.n, newLeads: newLeads.n, qualified: qualified.n, won: won.n, handoffs: handoffs.n,
    aiAvgMs: aiLatency.n ? Math.round(Number(aiLatency.ms)) : null,
    conversionRate: newLeads.n && won.n ? Math.round((won.n / newLeads.n) * 1000) / 10 : null,
    pipelineValue: pipeline.n ? Number(pipeline.total) : null,
    byDept, byChannel, topDest, topVisa, topPackages, employee,
  };
}
