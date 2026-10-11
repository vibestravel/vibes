import Link from "next/link";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { leads, customers, departments, pipelineStages, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ACCESS, scopedDepartment } from "@/lib/rbac";
import { PageHeader, Badge, Empty, SimBadge, fmtDate } from "@/components/ui";
import { moveLead } from "../actions";

export default async function CrmPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requireUser(ACCESS.crm);
  const scoped = scopedDepartment(user);
  const [stages, depts] = await Promise.all([
    db.select().from(pipelineStages).orderBy(pipelineStages.order),
    db.select().from(departments),
  ]);
  const deptFilter = scoped ?? sp.dept ?? null;
  const conds = [];
  if (deptFilter) conds.push(eq(leads.departmentId, deptFilter));
  if (sp.sim !== "1") conds.push(eq(leads.isSimulated, false));
  if (user.role === "SALES_AGENT") conds.push(eq(leads.assignedToId, user.id));
  if (sp.q) conds.push(or(ilike(customers.name, `%${sp.q}%`), ilike(customers.phone, `%${sp.q}%`), ilike(leads.destination, `%${sp.q}%`)));
  const rows = await db.select({ l: leads, c: customers, d: departments, a: users }).from(leads)
    .innerJoin(customers, eq(leads.customerId, customers.id)).innerJoin(departments, eq(leads.departmentId, departments.id))
    .leftJoin(users, eq(leads.assignedToId, users.id)).where(and(...conds)).orderBy(desc(leads.updatedAt)).limit(300);

  return (
    <>
      <PageHeader title="العملاء والـ CRM" subtitle="الليدز بتتسجل تلقائيًا من المحادثات. حرّك الليد بين المراحل من القائمة." />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="بحث بالاسم أو الموبايل أو الوجهة" className="input max-w-xs" />
        {!scoped && (
          <select name="dept" defaultValue={sp.dept ?? ""} className="input max-w-[200px]">
            <option value="">كل الأقسام</option>
            {depts.map((d) => <option key={d.id} value={d.id}>{d.nameAr}</option>)}
          </select>
        )}
        {sp.sim === "1" && <input type="hidden" name="sim" value="1" />}
        <button className="btn-ghost">تطبيق</button>
        <Link href={`/crm?${new URLSearchParams({ ...sp, sim: sp.sim === "1" ? "0" : "1" })}`} className="ms-auto self-center text-xs text-muted underline">{sp.sim === "1" ? "إخفاء المحاكاة" : "إظهار المحاكاة"}</Link>
      </form>

      {rows.length === 0 ? <Empty title="مفيش ليدز لسه">أول ما العملاء يكلموا المساعد، الليدز هتظهر هنا لوحدها.</Empty> : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {stages.map((s) => {
            const items = rows.filter((r) => r.l.stageId === s.id);
            return (
              <div key={s.id} className="w-72 shrink-0">
                <div className="mb-2 flex items-center justify-between px-1 text-sm"><span className="font-medium">{s.name}</span><span className="num text-muted">{items.length}</span></div>
                <div className="space-y-2">
                  {items.map(({ l, c, d, a }) => (
                    <div key={l.id} className="card p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/crm/${c.id}`} className="font-medium hover:underline">{c.name ?? c.phone ?? "عميل"}</Link>
                        <Badge tone={l.score >= 60 ? "green" : l.score >= 30 ? "amber" : "gray"}><span className="num">{l.score}</span></Badge>
                      </div>
                      <p className="mt-1 text-muted">{[l.destination, l.travelDate, l.travelers ? `${l.travelers} أفراد` : null].filter(Boolean).join(" · ") || "—"}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1"><Badge tone="teal">{d.nameAr}</Badge>{l.isSimulated && <SimBadge />}{a && <Badge>{a.name}</Badge>}</div>
                      <form action={async (f: FormData) => { "use server"; await moveLead(l.id, String(f.get("stage"))); }} className="mt-2 flex gap-1">
                        <select name="stage" defaultValue={s.id} className="input py-1 text-xs">{stages.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
                        <button className="btn-ghost px-2 py-1 text-xs">نقل</button>
                      </form>
                      <p className="mt-2 text-[11px] text-muted">آخر تحديث {fmtDate(l.updatedAt)}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
