import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { knowledgeEntries, departments } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ACCESS } from "@/lib/rbac";
import { PageHeader, Badge, fmtDate } from "@/components/ui";
import { addKnowledge, approveKnowledge } from "../actions";

export default async function KnowledgePage() {
  await requireUser(ACCESS.knowledge);
  const [rows, depts] = await Promise.all([
    db.select({ k: knowledgeEntries, d: departments }).from(knowledgeEntries).leftJoin(departments, eq(knowledgeEntries.departmentId, departments.id)).orderBy(desc(knowledgeEntries.updatedAt)),
    db.select().from(departments),
  ]);
  return (
    <>
      <PageHeader title="قاعدة المعرفة" subtitle="معلومات الشركة والأسئلة الشائعة. المساعد بيستخدم المعتمد بس، والمحتوى الداخلي مبيوصلش للعملاء أبدًا. رفع الملفات والإصدارات في المرحلة 2." />
      <form action={addKnowledge} className="card mb-4 grid gap-3 p-5 sm:grid-cols-2">
        <div><label className="label">العنوان</label><input name="title" required className="input" /></div>
        <div><label className="label">القسم</label><select name="departmentId" className="input"><option value="">عام</option>{depts.map((d) => <option key={d.id} value={d.id}>{d.nameAr}</option>)}</select></div>
        <div className="sm:col-span-2"><label className="label">المحتوى</label><textarea name="content" required rows={4} className="input" /></div>
        <div><label className="label">ساري لحد (اختياري)</label><input name="validUntil" type="date" className="input" /></div>
        <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" name="internalOnly" /> داخلي — ممنوع يتقال للعملاء</label>
        <div><button className="btn-primary">إضافة (هتحتاج اعتماد)</button></div>
      </form>
      <div className="card divide-y divide-line">
        {rows.map(({ k, d }) => (
          <div key={k.id} className="p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{k.title}</span><Badge>{d?.nameAr ?? "عام"}</Badge>
              {k.internalOnly && <Badge tone="red">داخلي</Badge>}
              <Badge tone={k.approved ? "green" : "amber"}>{k.approved ? "معتمد" : "مستني اعتماد"}</Badge>
              <span className="ms-auto text-xs text-muted">{fmtDate(k.updatedAt)}</span>
              <form action={approveKnowledge.bind(null, k.id, !k.approved)}><button className="btn-ghost py-1 text-xs">{k.approved ? "إلغاء الاعتماد" : "اعتماد"}</button></form>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-muted">{k.content}</p>
          </div>
        ))}
        {!rows.length && <p className="p-6 text-center text-sm text-muted">مفيش محتوى لسه.</p>}
      </div>
    </>
  );
}
