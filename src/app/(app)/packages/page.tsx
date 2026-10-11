import Link from "next/link";
import { and, desc, eq, ilike, or, lt, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { packages, departments, documents } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ACCESS, scopedDepartment } from "@/lib/rbac";
import { PageHeader, Badge, Empty, fmtDate } from "@/components/ui";
import { STATUS } from "@/lib/packages/status";
import { aiConfigured } from "@/lib/ai/engine";
import { UploadForm } from "./UploadForm";


export default async function PackagesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requireUser(ACCESS.packages);
  const scoped = scopedDepartment(user);
  // expired approved packages are archived automatically so the AI never offers them
  await db.update(packages).set({ status: "ARCHIVED" }).where(and(eq(packages.status, "APPROVED"), isNotNull(packages.validUntil), lt(packages.validUntil, new Date())));
  const depts = await db.select().from(departments);
  const conds = [];
  if (scoped) conds.push(eq(packages.departmentId, scoped)); else if (sp.dept) conds.push(eq(packages.departmentId, sp.dept));
  if (sp.status) conds.push(eq(packages.status, sp.status as "APPROVED"));
  if (sp.q) conds.push(or(ilike(packages.name, `%${sp.q}%`), ilike(packages.destination, `%${sp.q}%`), ilike(packages.country, `%${sp.q}%`)));
  const rows = await db.select({ p: packages, d: departments, doc: documents }).from(packages)
    .innerJoin(departments, eq(packages.departmentId, departments.id)).leftJoin(documents, eq(packages.sourceDocumentId, documents.id))
    .where(and(...conds)).orderBy(desc(packages.updatedAt)).limit(200);

  return (
    <>
      <PageHeader title="مكتبة برامج السفر" subtitle="ارفع ملفات البرامج، راجع البيانات المستخرجة، واعتمدها. المساعد بيرشّح البرامج المعتمدة والسارية بس." />
      <UploadForm departments={depts.filter((d) => !scoped || d.id === scoped).map((d) => ({ id: d.id, name: d.nameAr }))} aiLive={aiConfigured()} />
      <form className="my-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="بحث بالاسم أو الوجهة" className="input max-w-xs" />
        {!scoped && <select name="dept" defaultValue={sp.dept ?? ""} className="input max-w-[200px]"><option value="">كل الأقسام</option>{depts.map((d) => <option key={d.id} value={d.id}>{d.nameAr}</option>)}</select>}
        <select name="status" defaultValue={sp.status ?? ""} className="input max-w-[180px]"><option value="">كل الحالات</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        <button className="btn-ghost">تطبيق</button>
      </form>
      {rows.length === 0 ? <Empty title="مفيش برامج لسه">ارفع أول ملف من فوق.</Empty> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="border-b border-line"><tr><th className="th">البرنامج</th><th className="th">القسم</th><th className="th">المدة</th><th className="th">الأسعار</th><th className="th">ساري لحد</th><th className="th">الحالة</th><th className="th">الملف</th></tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map(({ p, d, doc }) => (
                <tr key={p.id} className="hover:bg-canvas">
                  <td className="td"><Link href={`/packages/${p.id}`} className="font-medium hover:underline">{p.name}</Link><p className="text-xs text-muted">{[p.destination, p.travelDates].filter(Boolean).join(" · ")}</p></td>
                  <td className="td">{d.nameAr}</td>
                  <td className="td">{p.nights ? `${p.nights} ليالي` : "—"}</td>
                  <td className="td">{p.prices?.length ? <span className="num">{p.prices.length} سعر</span> : <Badge tone="red">مفيش أسعار</Badge>}</td>
                  <td className="td">{p.validUntil ? fmtDate(p.validUntil, false) : "—"}</td>
                  <td className="td"><Badge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Badge>{p.extractedBy === "ai" && <span className="ms-1 text-xs text-muted">استخراج AI</span>}</td>
                  <td className="td text-xs">{doc ? <span title={doc.fileName}>{doc.extractionStatus === "NEEDS_OCR" ? <Badge tone="amber">محتاج OCR</Badge> : doc.fileName.slice(0, 24)}</span> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
