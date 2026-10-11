import { desc, eq, like } from "drizzle-orm";
import { db } from "@/db";
import { integrations, auditLogs } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ACCESS } from "@/lib/rbac";
import { getFlexiVi, flexiviMode, isFresh, availabilityMaxAgeMin } from "@/lib/flexivi";
import { PageHeader, Badge, fmtDate } from "@/components/ui";
import { testFlexiVi } from "../actions";

export default async function FlexiViPage() {
  await requireUser(ACCESS.flexivi);
  const mode = flexiviMode();
  const [status] = await db.select().from(integrations).where(eq(integrations.key, "FLEXIVI"));
  const errors = await db.select().from(auditLogs).where(like(auditLogs.action, "flexivi.%")).orderBy(desc(auditLogs.createdAt)).limit(10);
  const fv = getFlexiVi();

  let monitor: { dest: string; cat: string; earliest: string | null; verifiedAt: string; fresh: boolean; source: string }[] = [];
  let monitorError: string | null = null;
  if (fv) {
    try {
      const ds = await fv.listDestinations();
      for (const d of ds.data.slice(0, 12)) for (const c of d.categories.slice(0, 2)) {
        const a = await fv.getAvailability({ destination: d.code, category: c });
        monitor.push({ dest: d.nameAr, cat: c, earliest: a.data[0]?.earliestDate ?? null, verifiedAt: a.verifiedAt, fresh: isFresh(a.verifiedAt), source: a.source });
      }
    } catch (e) { monitorError = (e as Error).message; monitor = []; }
  }

  return (
    <>
      <PageHeader title="مركز الفيزا — FlexiVi" subtitle="FlexiVi هو المصدر الوحيد لمواعيد السفارات ومتطلبات الفيزا. المساعد بيقرا منه بس، ومبيحجزش ولا بيدفع."
        actions={<form action={testFlexiVi}><button className="btn-primary">اختبار الاتصال</button></form>} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 text-sm">
          <h2 className="mb-3 font-medium">حالة الربط</h2>
          <p className="mb-2">{mode === "live" ? <Badge tone="green">مباشر LIVE</Badge> : mode === "mock" ? <Badge tone="violet">بيانات تجريبية MOCK</Badge> : <Badge tone="red">غير مُعد</Badge>}</p>
          <dl className="space-y-1 text-muted">
            <div>آخر اختبار: {fmtDate(status?.lastCheck)}</div>
            <div>آخر نجاح: {fmtDate(status?.lastOk)}</div>
            <div>آخر خطأ: {status?.lastError ?? "—"}</div>
            <div>أقصى عمر لبيانات المواعيد: <span className="num">{availabilityMaxAgeMin()}</span> دقيقة</div>
          </dl>
          {mode !== "live" && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-amber-900">مش هنعتبر الربط شغال غير لما مكالمة حقيقية بمفتاح FlexiVi تنجح. لحد كده، المساعد بيقول للعملاء الحقيقيين إنه مش قادر يأكد المواعيد، ويحولهم لمتخصص الفيزا.</p>}
        </div>
        <div className="card p-5 text-sm lg:col-span-2">
          <h2 className="mb-3 font-medium">الأدوات اللي المساعد بيستخدمها (على السيرفر بس)</h2>
          <ul className="grid gap-2 sm:grid-cols-2" dir="ltr">
            {["get_visa_destinations()", "get_visa_requirements()", "get_appointment_availability()", "get_visa_fees()", "get_application_centers()"].map((t) => <li key={t} className="rounded-lg bg-canvas px-3 py-2 font-mono text-xs">{t}</li>)}
          </ul>
          <p className="mt-3 text-muted">المفاتيح محفوظة في متغيرات البيئة على السيرفر، ومبتوصلش للمتصفح ولا للعميل أبدًا. مواصفات الـ API المطلوبة من فريق FlexiVi في <span dir="ltr" className="font-mono">docs/FLEXIVI_API_SPEC.md</span>.</p>
        </div>
      </div>

      <div className="card mt-4 overflow-x-auto">
        <h2 className="p-5 pb-0 font-medium">متابعة السفارات</h2>
        {monitorError && <p className="p-5 text-sm text-red-700">تعذر الاتصال: {monitorError}</p>}
        <table className="mt-3 w-full min-w-[600px]">
          <thead className="border-y border-line"><tr><th className="th">الوجهة</th><th className="th">النوع</th><th className="th">أقرب ميعاد</th><th className="th">آخر تحقق</th><th className="th">الحالة</th></tr></thead>
          <tbody className="divide-y divide-line">
            {monitor.map((m, i) => (
              <tr key={i}><td className="td">{m.dest}</td><td className="td">{m.cat}</td><td className="td num">{m.earliest ?? "مفيش"}</td><td className="td">{fmtDate(m.verifiedAt)}</td>
                <td className="td">{m.source === "MOCK" ? <Badge tone="violet">تجريبي</Badge> : m.fresh ? <Badge tone="green">حديث</Badge> : <Badge tone="amber">قديم — مش بيتعرض</Badge>}</td></tr>
            ))}
            {!monitor.length && !monitorError && <tr><td className="td text-muted" colSpan={5}>مفيش بيانات.</td></tr>}
          </tbody>
        </table>
        <p className="p-5 text-xs text-muted">تنبيهات المواعيد الجديدة للعملاء هتتفعل في المرحلة 3، وبس للعملاء اللي وافقوا والمنصة بتسمح.</p>
      </div>

      <div className="card mt-4 p-5 text-sm">
        <h2 className="mb-3 font-medium">سجل الأخطاء والعمليات</h2>
        {errors.length === 0 ? <p className="text-muted">مفيش.</p> : <ul className="space-y-1">{errors.map((e) => <li key={e.id} className="flex gap-2"><span className="text-muted">{fmtDate(e.createdAt)}</span><span dir="ltr" className="font-mono text-xs">{e.action} {JSON.stringify(e.details ?? {})}</span></li>)}</ul>}
      </div>
    </>
  );
}
