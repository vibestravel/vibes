import Link from "next/link";
import clsx from "clsx";
import { requireUser } from "@/lib/auth";
import { scopedDepartment } from "@/lib/rbac";
import { parseRange, dashboardMetrics } from "@/lib/metrics";
import { PageHeader, Stat, CHANNEL_LABEL } from "@/components/ui";
import { flexiviMode } from "@/lib/flexivi";
import { aiConfigured } from "@/lib/ai/engine";

const RANGES = [["today", "النهارده"], ["yesterday", "امبارح"], ["week", "الأسبوع ده"], ["month", "الشهر ده"]] as const;

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const range = parseRange(sp);
  const includeSimulated = sp.sim === "1";
  const m = await dashboardMetrics(range, { includeSimulated, departmentId: scopedDepartment(user) });
  const q = (extra: Record<string, string>) => new URLSearchParams({ ...sp, ...extra }).toString();

  return (
    <>
      <PageHeader title={`أهلاً ${user.name.split(" ")[0]}`} subtitle="أرقام حقيقية من المحادثات والعملاء المتسجلين. مفيش أي رقم تقديري." />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {RANGES.map(([k, l]) => (
          <Link key={k} href={`/?${q({ range: k })}`} className={clsx("rounded-full px-3 py-1.5 text-sm", range.key === k ? "bg-ink text-white" : "bg-white text-muted ring-1 ring-line")}>{l}</Link>
        ))}
        <form className="flex items-center gap-1 text-sm">
          <input type="hidden" name="range" value="custom" />
          {includeSimulated && <input type="hidden" name="sim" value="1" />}
          <input type="date" name="from" defaultValue={sp.from} className="input w-36 py-1" />
          <span className="text-muted">←</span>
          <input type="date" name="to" defaultValue={sp.to} className="input w-36 py-1" />
          <button className="btn-ghost py-1">تطبيق</button>
        </form>
        <Link href={`/?${q({ sim: includeSimulated ? "0" : "1" })}`} className="ms-auto text-xs text-muted underline">
          {includeSimulated ? "إخفاء محادثات المحاكاة" : "إظهار محادثات المحاكاة"}
        </Link>
      </div>

      {(!aiConfigured() || flexiviMode() !== "live") && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {!aiConfigured() && <p>• المساعد الذكي (Claude) مش متفعّل لسه — المحاكي شغال بمحرك تجريبي، والرسايل الحقيقية بتتحول لموظف.</p>}
          {flexiviMode() !== "live" && <p>• FlexiVi شغال ببيانات تجريبية بس، ومش بيتعرض منها حاجة للعملاء الحقيقيين.</p>}
          <Link href="/integrations" className="mt-1 inline-block font-medium underline">إعدادات الربط</Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="استفسارات العملاء" value={m.inquiries} />
        <Stat label="ليدز جديدة" value={m.newLeads} />
        <Stat label="ليدز مؤهلة" value={m.qualified} hint="درجة 60 أو أكتر" />
        <Stat label="تحويلات لموظف" value={m.handoffs} />
        <Stat label="متوسط وقت رد المساعد" value={m.aiAvgMs !== null ? `${(m.aiAvgMs / 1000).toFixed(1)} ث` : undefined} unavailable={m.aiAvgMs === null ? "مفيش ردود في الفترة دي" : undefined} />
        <Stat label="نسبة التحويل لبيع" value={m.conversionRate !== null ? `${m.conversionRate}%` : undefined} unavailable={m.conversionRate === null ? "مفيش مبيعات متسجلة (Won) لسه" : undefined} />
        <Stat label="قيمة الـ Pipeline" value={m.pipelineValue?.toLocaleString("en")} unavailable={m.pipelineValue === null ? "مفيش قيم عروض متسجلة" : undefined} hint="من قيم العروض اللي الموظفين سجلوها بس" />
        <Stat label="أداء المتابعة" unavailable="هيتفعّل في المرحلة 5" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Bars title="الليدز حسب القسم" rows={m.byDept.map((r) => ({ name: r.name, n: r.n }))} />
        <Bars title="الليدز حسب القناة" rows={m.byChannel.map((r) => ({ name: CHANNEL_LABEL[r.channel] ?? r.channel, n: r.n }))} />
        <Bars title="أكتر وجهات مطلوبة" rows={m.topDest.map((r) => ({ name: r.name ?? "—", n: r.n }))} />
        <Bars title="أكتر فيزا مطلوبة" rows={m.topVisa.map((r) => ({ name: r.name ?? "—", n: r.n }))} />
        <Bars title="أكتر برامج اتبعتت" rows={m.topPackages.map((r) => ({ name: r.name, n: r.n }))} />
        <Bars title="ردود الموظفين" rows={m.employee.map((r) => ({ name: r.name, n: r.n }))} />
      </div>
    </>
  );
}

function Bars({ title, rows }: { title: string; rows: { name: string; n: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="card p-5">
      <h3 className="mb-4 text-sm font-medium">{title}</h3>
      {rows.length === 0 ? <p className="text-sm text-muted">مفيش بيانات في الفترة دي.</p> : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.name}>
              <div className="mb-1 flex justify-between text-sm"><span className="truncate">{r.name}</span><span className="num text-muted">{r.n}</span></div>
              <div className="h-2 rounded-full bg-canvas"><div className="h-2 rounded-full bg-brand" style={{ width: `${(r.n / max) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
