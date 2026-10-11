import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { packages, departments, documents, documentDeliveries, customers } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ACCESS } from "@/lib/rbac";
import { PageHeader, Badge, fmtDate, CHANNEL_LABEL } from "@/components/ui";
import { savePackage, setPackageStatus } from "../../actions";
import { STATUS } from "@/lib/packages/status";
import { signedDocUrl } from "@/lib/channels";

const ERR: Record<string, string> = { prices: "صيغة الأسعار غلط. كل سطر: الوصف | نوع الغرفة | المبلغ | العملة", noprice: "مينفعش تعتمد برنامج من غير أسعار.", expired: "البرنامج منتهي الصلاحية." };

export default async function PackagePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params; const sp = await searchParams;
  await requireUser(ACCESS.packages);
  const [row] = await db.select({ p: packages, doc: documents }).from(packages).leftJoin(documents, eq(packages.sourceDocumentId, documents.id)).where(eq(packages.id, id));
  if (!row) notFound();
  const { p, doc } = row;
  const [depts, dels] = await Promise.all([
    db.select().from(departments),
    db.select({ d: documentDeliveries, c: customers }).from(documentDeliveries).innerJoin(customers, eq(documentDeliveries.customerId, customers.id)).where(eq(documentDeliveries.packageId, id)).orderBy(desc(documentDeliveries.createdAt)).limit(20),
  ]);
  const fileUrl = doc ? await signedDocUrl(doc.id, 1) : null;
  const v = (x: unknown) => (x == null ? "" : String(x));
  const date = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

  return (
    <>
      <PageHeader title={p.name} subtitle={`نسخة ${p.version} · ${p.extractedBy === "ai" ? "استخراج بالذكاء الاصطناعي — راجع كل رقم" : "إدخال يدوي"}`}
        actions={<>
          <Badge tone={STATUS[p.status].tone} className="self-center">{STATUS[p.status].label}</Badge>
          {p.status !== "APPROVED" && <form action={setPackageStatus.bind(null, p.id, "APPROVED")}><button className="btn-primary">اعتماد</button></form>}
          {p.status !== "ARCHIVED" && <form action={setPackageStatus.bind(null, p.id, "ARCHIVED")}><button className="btn-ghost">أرشفة</button></form>}
        </>} />
      {sp.err && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{ERR[sp.err]}</p>}
      {sp.saved && <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">اتحفظ. أي تعديل بيرجّع البرنامج لـ"محتاج مراجعة" لحد ما يتعتمد تاني.</p>}

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <form action={savePackage.bind(null, p.id)} className="card grid gap-4 p-5 sm:grid-cols-2">
          <F l="اسم البرنامج" n="name" d={p.name} full />
          <div><label className="label">القسم</label><select name="departmentId" defaultValue={p.departmentId} className="input">{depts.map((d) => <option key={d.id} value={d.id}>{d.nameAr}</option>)}</select></div>
          <F l="الوجهة" n="destination" d={v(p.destination)} /><F l="الدولة" n="country" d={v(p.country)} />
          <F l="مواعيد السفر" n="travelDates" d={v(p.travelDates)} /><F l="عدد الليالي" n="nights" d={v(p.nights)} t="number" /><F l="عدد الأيام" n="days" d={v(p.days)} t="number" />
          <F l="الوجبات" n="mealPlan" d={v(p.mealPlan)} /><F l="الطيران" n="flights" d={v(p.flights)} /><F l="الانتقالات" n="transport" d={v(p.transport)} />
          <F l="ساري من" n="validFrom" d={date(p.validFrom)} t="date" /><F l="ساري لحد" n="validUntil" d={date(p.validUntil)} t="date" />
          <A l="الأسعار — سطر لكل سعر: الوصف | نوع الغرفة | المبلغ | العملة" n="prices" d={(p.prices ?? []).map((x) => [x.label, x.occupancy ?? "", x.amount, x.currency].join(" | ")).join("\n")} ltr />
          <A l="الفنادق — سطر لكل فندق: الاسم | المدينة | النجوم" n="hotels" d={(p.hotels ?? []).map((h) => [h.name, h.city ?? "", h.stars ?? ""].join(" | ")).join("\n")} />
          <A l="يشمل (سطر لكل بند)" n="included" d={p.included.join("\n")} /><A l="لا يشمل (سطر لكل بند)" n="excluded" d={p.excluded.join("\n")} />
          <A l="سياسة الأطفال" n="childPolicy" d={v(p.childPolicy)} /><A l="سياسة الإلغاء" n="cancellationPolicy" d={v(p.cancellationPolicy)} />
          <div className="sm:col-span-2"><button className="btn-primary">حفظ التعديلات</button></div>
        </form>

        <aside className="space-y-4">
          {doc && (
            <div className="card p-4 text-sm">
              <h2 className="mb-2 font-medium">الملف الأصلي</h2>
              <p className="break-all">{doc.fileName}</p>
              <p className="mt-1 text-muted">{(doc.size / 1024 / 1024).toFixed(2)} MB · {fmtDate(doc.createdAt)}</p>
              {doc.extractionStatus === "NEEDS_OCR" && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-amber-900">الملف ممسوح ضوئيًا. OCR هيتضاف في المرحلة 2، لحد كده كمّل البيانات يدوي.</p>}
              {fileUrl && <a href={fileUrl} target="_blank" className="btn-ghost mt-3 w-full">فتح الملف</a>}
              {doc.text && <details className="mt-3"><summary className="cursor-pointer text-muted">النص المستخرج</summary><pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-canvas p-2 text-xs">{doc.text.slice(0, 20000)}</pre></details>}
            </div>
          )}
          <div className="card p-4 text-sm">
            <h2 className="mb-2 font-medium">سجل الإرسال للعملاء</h2>
            {dels.length === 0 ? <p className="text-muted">لسه ماتبعتش لحد.</p> : <ul className="space-y-1">{dels.map(({ d, c }) => <li key={d.id}>{c.name ?? c.phone ?? "عميل"} · {CHANNEL_LABEL[d.channel]} · <Badge tone={d.status === "FAILED" ? "red" : "gray"}>{d.status}</Badge></li>)}</ul>}
          </div>
        </aside>
      </div>
    </>
  );
}

function F({ l, n, d, t = "text", full }: { l: string; n: string; d: string; t?: string; full?: boolean }) {
  return <div className={full ? "sm:col-span-2" : ""}><label className="label">{l}</label><input name={n} type={t} defaultValue={d} className="input" required={n === "name"} /></div>;
}
function A({ l, n, d, ltr }: { l: string; n: string; d: string; ltr?: boolean }) {
  return <div className="sm:col-span-2"><label className="label">{l}</label><textarea name={n} defaultValue={d} rows={3} className="input" dir={ltr ? "auto" : undefined} /></div>;
}
