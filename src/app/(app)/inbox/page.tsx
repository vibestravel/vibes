import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { conversations, customers, departments, messages, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ACCESS, scopedDepartment } from "@/lib/rbac";
import { PageHeader, Badge, Empty, CHANNEL_LABEL, MODE_LABEL, PRIORITY_LABEL, fmtDate, SimBadge } from "@/components/ui";

export default async function InboxPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requireUser(ACCESS.inbox);
  const dept = scopedDepartment(user);
  const conds = [eq(conversations.status, sp.status === "CLOSED" ? "CLOSED" : "OPEN")];
  if (sp.mode && ["AI", "HUMAN", "PAUSED"].includes(sp.mode)) conds.push(eq(conversations.mode, sp.mode as "AI"));
  if (sp.channel) conds.push(eq(conversations.channel, sp.channel as "WHATSAPP"));
  if (sp.sim !== "1") conds.push(eq(conversations.isSimulated, false));
  if (dept) conds.push(eq(conversations.departmentId, dept));
  if (user.role === "SALES_AGENT") conds.push(eq(conversations.assignedToId, user.id));

  const rows = await db.select({ c: conversations, cust: customers, dept: departments, agent: users })
    .from(conversations).innerJoin(customers, eq(conversations.customerId, customers.id))
    .leftJoin(departments, eq(conversations.departmentId, departments.id)).leftJoin(users, eq(conversations.assignedToId, users.id))
    .where(and(...conds)).orderBy(desc(conversations.lastMessageAt)).limit(100);
  const ids = rows.map((r) => r.c.id);
  const lastMsgs = ids.length ? await db.selectDistinctOn([messages.conversationId], { cid: messages.conversationId, text: messages.text, author: messages.author })
    .from(messages).where(inArray(messages.conversationId, ids)).orderBy(messages.conversationId, desc(messages.createdAt)) : [];
  const last = new Map(lastMsgs.map((m) => [m.cid, m]));
  const f = (k: string, v?: string) => { const p = new URLSearchParams(sp); if (v) p.set(k, v); else p.delete(k); return `/inbox?${p}`; };

  return (
    <>
      <PageHeader title="الصندوق الموحد" subtitle="واتساب وإنستجرام وماسنجر في مكان واحد. أي محادثة تقدر تستلمها من المساعد في أي وقت." />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {[["", "الكل"], ["AI", "مع المساعد"], ["HUMAN", "مع موظف"], ["PAUSED", "متوقفة"]].map(([v, l]) => (
          <Link key={v} href={f("mode", v)} className={`rounded-full px-3 py-1.5 ${(sp.mode ?? "") === v ? "bg-ink text-white" : "bg-white ring-1 ring-line"}`}>{l}</Link>
        ))}
        <span className="mx-2 border-s border-line" />
        {[["", "كل القنوات"], ["WHATSAPP", "واتساب"], ["INSTAGRAM_DM", "إنستجرام"], ["MESSENGER", "ماسنجر"]].map(([v, l]) => (
          <Link key={v} href={f("channel", v)} className={`rounded-full px-3 py-1.5 ${(sp.channel ?? "") === v ? "bg-ink text-white" : "bg-white ring-1 ring-line"}`}>{l}</Link>
        ))}
        <Link href={f("sim", sp.sim === "1" ? undefined : "1")} className="ms-auto text-xs text-muted underline">{sp.sim === "1" ? "إخفاء المحاكاة" : "إظهار المحاكاة"}</Link>
      </div>
      {rows.length === 0 ? (
        <Empty title="مفيش محادثات هنا لسه">المحادثات هتظهر هنا أول ما المنصات تتربط. لحد كده تقدر تجرب المساعد من <Link className="underline" href="/assistant">المحاكي</Link>.</Empty>
      ) : (
        <div className="card divide-y divide-line">
          {rows.map(({ c, cust, dept: d, agent }) => {
            const m = last.get(c.id);
            return (
              <Link key={c.id} href={`/inbox/${c.id}`} className="flex flex-wrap items-center gap-3 p-4 hover:bg-canvas">
                <div className="grid size-10 place-items-center rounded-full bg-teal-50 text-sm font-semibold text-brand">{(cust.name ?? "؟").slice(0, 1)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{cust.name ?? cust.phone ?? "عميل"}</span>
                    <Badge>{CHANNEL_LABEL[c.channel]}</Badge>
                    <Badge tone={MODE_LABEL[c.mode].tone}>{MODE_LABEL[c.mode].label}</Badge>
                    {c.priority !== "NORMAL" && <Badge tone={PRIORITY_LABEL[c.priority].tone}>{PRIORITY_LABEL[c.priority].label}</Badge>}
                    {c.isSimulated && <SimBadge />}
                  </div>
                  <p className="mt-1 truncate text-sm text-muted">{m ? `${m.author === "CUSTOMER" ? "" : m.author === "AI" ? "المساعد: " : "الموظف: "}${m.text}` : "—"}</p>
                </div>
                <div className="text-end text-xs text-muted">
                  <p>{fmtDate(c.lastMessageAt)}</p>
                  <p>{d?.nameAr ?? "بدون قسم"}{agent ? ` · ${agent.name}` : ""}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
