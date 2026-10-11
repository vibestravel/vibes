import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ACCESS, scopedDepartment } from "@/lib/rbac";
import { getThread } from "@/lib/conversations";
import { Badge, CHANNEL_LABEL, MODE_LABEL, PRIORITY_LABEL, fmtDate, SimBadge } from "@/components/ui";
import { setMode, humanReply, closeConversation } from "../../actions";
import { Thread } from "@/components/Thread";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(ACCESS.inbox);
  const t = await getThread(id);
  if (!t) notFound();
  const dept = scopedDepartment(user);
  if (dept && t.departmentId !== dept) notFound();
  if (user.role === "SALES_AGENT" && t.assignedToId !== user.id) notFound();
  const lead = t.customer.leads.at(-1);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <section className="card flex h-[calc(100vh-6rem)] flex-col">
        <header className="flex flex-wrap items-center gap-2 border-b border-line p-4">
          <Link href="/inbox" className="text-sm text-muted">← الصندوق</Link>
          <h1 className="font-semibold">{t.customer.name ?? t.customer.phone ?? "عميل"}</h1>
          <Badge>{CHANNEL_LABEL[t.channel]}</Badge>
          <Badge tone={MODE_LABEL[t.mode].tone}>{MODE_LABEL[t.mode].label}</Badge>
          {t.isSimulated && <SimBadge />}
          <div className="ms-auto flex gap-2">
            {t.mode !== "HUMAN" && <form action={setMode.bind(null, t.id, "HUMAN")}><button className="btn-primary py-1.5">استلام المحادثة</button></form>}
            {t.mode !== "AI" && <form action={setMode.bind(null, t.id, "AI")}><button className="btn-ghost py-1.5">رجّعها للمساعد</button></form>}
            {t.mode !== "PAUSED" && <form action={setMode.bind(null, t.id, "PAUSED")}><button className="btn-ghost py-1.5">إيقاف مؤقت</button></form>}
          </div>
        </header>
        {t.handoffReason && <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">سبب التحويل: {t.handoffReason}</p>}
        <Thread messages={t.messages.map((m) => ({ id: m.id, author: m.author, text: m.text, at: m.createdAt.toISOString(), by: m.user?.name, meta: m.meta as Record<string, unknown> | null }))} />
        <form action={humanReply.bind(null, t.id)} className="flex gap-2 border-t border-line p-3">
          <textarea name="text" rows={2} className="input resize-none" placeholder="اكتب رد… (الإرسال بيستلم المحادثة من المساعد تلقائيًا)" />
          <button className="btn-primary self-end">إرسال</button>
        </form>
      </section>

      <aside className="space-y-4">
        <div className="card p-4 text-sm">
          <h2 className="mb-3 font-medium">العميل</h2>
          <dl className="space-y-2">
            <Row k="الاسم" v={t.customer.name} /><Row k="الموبايل" v={t.customer.phone} ltr /><Row k="الإيميل" v={t.customer.email} ltr />
            <Row k="القسم" v={t.department?.nameAr} /><Row k="الموظف" v={t.assignedTo?.name} />
            <Row k="الأولوية" v={PRIORITY_LABEL[t.priority].label} />
          </dl>
          <Link href={`/crm/${t.customerId}`} className="mt-3 inline-block text-brand underline">ملف العميل الكامل</Link>
        </div>
        <div className="card p-4 text-sm">
          <h2 className="mb-3 font-medium">الليد</h2>
          {lead ? (
            <dl className="space-y-2">
              <Row k="الخدمة" v={lead.service} /><Row k="الوجهة" v={lead.destination} /><Row k="الميعاد" v={lead.travelDate} />
              <Row k="الأفراد" v={lead.travelers?.toString()} /><Row k="الميزانية" v={lead.budget} /><Row k="الفيزا" v={lead.visaCategory} />
              <Row k="الدرجة" v={`${lead.score}/100`} />
            </dl>
          ) : <p className="text-muted">لسه مفيش ليد.</p>}
          {t.summary && <p className="mt-3 rounded-xl bg-canvas p-3 text-muted">{t.summary}</p>}
        </div>
        <form action={closeConversation.bind(null, t.id)}><button className="btn-ghost w-full">إغلاق المحادثة</button></form>
        <p className="text-center text-xs text-muted">بدأت {fmtDate(t.createdAt)}</p>
      </aside>
    </div>
  );
}

function Row({ k, v, ltr }: { k: string; v?: string | null; ltr?: boolean }) {
  return <div className="flex justify-between gap-4"><dt className="text-muted">{k}</dt><dd className="text-end" dir={ltr ? "ltr" : undefined}>{v || "—"}</dd></div>;
}
