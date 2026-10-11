import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customers, leads, conversations, documentDeliveries, packages, followUpReminders, pipelineStages, departments, channelIdentities } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ACCESS, scopedDepartment } from "@/lib/rbac";
import { PageHeader, Badge, CHANNEL_LABEL, MODE_LABEL, fmtDate, SimBadge } from "@/components/ui";
import { saveCustomerNotes, updateLeadValue } from "../../actions";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(ACCESS.crm);
  const [c] = await db.select().from(customers).where(eq(customers.id, id));
  if (!c) notFound();
  const scoped = scopedDepartment(user);
  if (scoped && c.departmentId && c.departmentId !== scoped) notFound();
  const [ls, convs, dels, rems, ids] = await Promise.all([
    db.select({ l: leads, s: pipelineStages, d: departments }).from(leads).innerJoin(pipelineStages, eq(leads.stageId, pipelineStages.id)).innerJoin(departments, eq(leads.departmentId, departments.id)).where(eq(leads.customerId, id)).orderBy(desc(leads.createdAt)),
    db.select().from(conversations).where(eq(conversations.customerId, id)).orderBy(desc(conversations.lastMessageAt)),
    db.select({ d: documentDeliveries, p: packages }).from(documentDeliveries).innerJoin(packages, eq(documentDeliveries.packageId, packages.id)).where(eq(documentDeliveries.customerId, id)).orderBy(desc(documentDeliveries.createdAt)),
    db.select().from(followUpReminders).where(eq(followUpReminders.customerId, id)).orderBy(followUpReminders.dueAt),
    db.select().from(channelIdentities).where(eq(channelIdentities.customerId, id)),
  ]);

  return (
    <>
      <PageHeader title={c.name ?? c.phone ?? "عميل"} subtitle={[c.phone, c.email].filter(Boolean).join(" · ") || undefined} actions={c.isSimulated ? <SimBadge /> : undefined} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="card p-5">
            <h2 className="mb-3 font-medium">الفرص (Leads)</h2>
            {ls.length === 0 && <p className="text-sm text-muted">مفيش.</p>}
            {ls.map(({ l, s, d }) => (
              <div key={l.id} className="mb-3 rounded-xl border border-line p-4 text-sm last:mb-0">
                <div className="flex flex-wrap items-center gap-2"><Badge tone="teal">{d.nameAr}</Badge><Badge>{s.name}</Badge><span className="ms-auto text-muted">الدرجة <span className="num">{l.score}</span></span></div>
                <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {[["الخدمة", l.service], ["الوجهة", l.destination], ["الميعاد", l.travelDate], ["الأفراد", l.travelers], ["الميزانية", l.budget], ["نوع الفيزا", l.visaCategory]].map(([k, v]) => (
                    <div key={String(k)}><dt className="text-xs text-muted">{k}</dt><dd>{v ?? "—"}</dd></div>
                  ))}
                </dl>
                {l.summary && <p className="mt-3 rounded-lg bg-canvas p-2 text-muted">{l.summary}</p>}
                <form action={updateLeadValue.bind(null, l.id)} className="mt-3 flex flex-wrap items-end gap-2">
                  <div><label className="label">قيمة العرض (يسجلها الموظف)</label><input name="value" type="number" step="0.01" defaultValue={l.value ?? ""} className="input w-40" dir="ltr" /></div>
                  <select name="currency" defaultValue={l.valueCurrency ?? "EGP"} className="input w-24"><option>EGP</option><option>USD</option><option>EUR</option><option>SAR</option></select>
                  <button className="btn-ghost">حفظ</button>
                </form>
              </div>
            ))}
          </section>
          <section className="card p-5">
            <h2 className="mb-3 font-medium">المحادثات</h2>
            <ul className="divide-y divide-line text-sm">
              {convs.map((v) => (
                <li key={v.id} className="flex items-center gap-2 py-2">
                  <Badge>{CHANNEL_LABEL[v.channel]}</Badge><Badge tone={MODE_LABEL[v.mode].tone}>{MODE_LABEL[v.mode].label}</Badge>
                  <span className="text-muted">{v.status === "OPEN" ? "مفتوحة" : "مغلقة"}</span>
                  <Link href={`/inbox/${v.id}`} className="ms-auto text-brand underline">{fmtDate(v.lastMessageAt)}</Link>
                </li>
              ))}
            </ul>
          </section>
          <section className="card p-5">
            <h2 className="mb-3 font-medium">البرامج اللي اتبعتت</h2>
            {dels.length === 0 ? <p className="text-sm text-muted">مفيش.</p> : (
              <ul className="space-y-2 text-sm">{dels.map(({ d, p }) => (
                <li key={d.id} className="flex flex-wrap items-center gap-2"><Link href={`/packages/${p.id}`} className="underline">{p.name}</Link><Badge>{CHANNEL_LABEL[d.channel]}</Badge>
                  <Badge tone={d.status === "FAILED" ? "red" : d.status === "SIMULATED" ? "violet" : "green"}>{d.status}</Badge><span className="ms-auto text-muted">{fmtDate(d.createdAt)}</span></li>
              ))}</ul>
            )}
          </section>
        </div>
        <div className="space-y-4">
          <section className="card p-5 text-sm">
            <h2 className="mb-3 font-medium">القنوات</h2>
            {ids.map((i) => <p key={i.id}>{CHANNEL_LABEL[i.channel]} <span className="text-muted" dir="ltr">{i.handle ?? i.externalId}</span></p>)}
            <p className="mt-3 text-muted">اهتمامات: {c.interests.join("، ") || "—"} · ميزانية: {c.budget ?? "—"}</p>
          </section>
          <form action={saveCustomerNotes.bind(null, c.id)} className="card space-y-3 p-5">
            <h2 className="font-medium">ملاحظات ومتابعة</h2>
            <textarea name="notes" rows={5} defaultValue={c.notes ?? ""} className="input" />
            <div><label className="label">تذكير متابعة</label><input name="reminder" className="input" placeholder="مثلاً: كلّمه بخصوص عرض المالديف" /></div>
            <input name="dueAt" type="datetime-local" className="input" />
            <button className="btn-primary w-full">حفظ</button>
            {rems.length > 0 && <ul className="space-y-1 text-sm">{rems.map((r) => <li key={r.id} className={r.doneAt ? "text-muted line-through" : ""}>{fmtDate(r.dueAt)} — {r.note}</li>)}</ul>}
          </form>
        </div>
      </div>
    </>
  );
}
