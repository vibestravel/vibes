import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/ai/settings";
import { PageHeader, Badge, fmtDate } from "@/components/ui";
import { savePersonality, publishPersonality } from "../actions";

export default async function PersonalityPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  await requireUser(["CEO"]);
  const [d, p] = await Promise.all([getSettings("draft"), getSettings("published")]);
  const changed = JSON.stringify({ ...d, id: 0, updatedAt: 0, publishedAt: 0 }) !== JSON.stringify({ ...p, id: 0, updatedAt: 0, publishedAt: 0 });
  return (
    <>
      <PageHeader title="استوديو شخصية المساعد" subtitle="عدّل المسودة، جرّبها في المحاكي، وبعدين انشرها للعملاء الحقيقيين."
        actions={<>
          <Link href="/assistant" className="btn-ghost">جرّب في المحاكي</Link>
          <form action={publishPersonality}><button className="btn-primary" disabled={!changed}>نشر للعملاء</button></form>
        </>} />
      {sp.saved && <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">المسودة اتحفظت. المحاكي بيستخدمها دلوقتي، والعملاء لسه على النسخة المنشورة.</p>}
      {sp.published && <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">اتنشرت. كل الردود الجديدة هتستخدم الإعدادات دي.</p>}
      <p className="mb-4 text-sm text-muted">آخر نشر: {fmtDate(p.publishedAt)} {changed && <Badge tone="amber">فيه تعديلات مش منشورة</Badge>}</p>
      <form action={savePersonality} className="card grid gap-4 p-5 sm:grid-cols-2">
        <div><label className="label">اسم المساعد</label><input name="assistantName" defaultValue={d.assistantName} className="input" required /></div>
        <div className="grid grid-cols-3 gap-2">
          <div><label className="label">الرسمية (1-5)</label><input name="formality" type="number" min={1} max={5} defaultValue={d.formality} className="input" /></div>
          <div><label className="label">الإيموجي (0-3)</label><input name="emojiLevel" type="number" min={0} max={3} defaultValue={d.emojiLevel} className="input" /></div>
          <div><label className="label">أقصى جمل</label><input name="maxSentences" type="number" min={1} max={8} defaultValue={d.maxSentences} className="input" /></div>
        </div>
        <T l="أسلوب الكلام (العامية المصرية والنبرة)" n="style" d={d.style} />
        <T l="طريقة البيع" n="salesApproach" d={d.salesApproach} />
        <T l="قواعد التحويل لموظف" n="escalationRules" d={d.escalationRules} />
        <T l="عبارات مفضلة (سطر لكل عبارة)" n="preferredPhrases" d={d.preferredPhrases.join("\n")} half />
        <T l="عبارات ممنوعة (سطر لكل عبارة)" n="prohibitedPhrases" d={d.prohibitedPhrases.join("\n")} half />
        <p className="text-xs text-muted sm:col-span-2">قواعد الصدق والأمان (ممنوع اختراع أسعار أو مواعيد، الشفافية إنه مساعد ذكي، الحماية من التلاعب) ثابتة في النظام ومينفعش تتلغي من هنا.</p>
        <div><button className="btn-primary">حفظ المسودة</button></div>
      </form>
    </>
  );
}
function T({ l, n, d, half }: { l: string; n: string; d: string; half?: boolean }) {
  return <div className={half ? "" : "sm:col-span-2"}><label className="label">{l}</label><textarea name={n} defaultValue={d} rows={4} className="input" /></div>;
}
