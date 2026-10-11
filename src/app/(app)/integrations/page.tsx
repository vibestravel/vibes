import { requireUser } from "@/lib/auth";
import { ACCESS } from "@/lib/rbac";
import { aiConfigured } from "@/lib/ai/engine";
import { flexiviMode } from "@/lib/flexivi";
import { channelConfigured } from "@/lib/channels";
import { PageHeader, Badge } from "@/components/ui";

export default async function IntegrationsPage() {
  await requireUser(ACCESS.integrations);
  const items = [
    { name: "Claude (Anthropic)", ok: aiConfigured(), env: "ANTHROPIC_API_KEY", note: "محرك الردود واستخراج البرامج." },
    { name: "FlexiVi", ok: flexiviMode() === "live", partial: flexiviMode() === "mock" ? "تجريبي" : undefined, env: "FLEXIVI_MODE, FLEXIVI_BASE_URL, FLEXIVI_API_KEY", note: "مواعيد السفارات ومتطلبات الفيزا." },
    { name: "WhatsApp Cloud API", ok: channelConfigured("WHATSAPP"), env: "WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, META_APP_SECRET", note: "المرحلة 4. Webhook: /api/webhooks/meta" },
    { name: "Messenger + Instagram", ok: channelConfigured("MESSENGER"), env: "META_PAGE_ACCESS_TOKEN, META_APP_SECRET, META_VERIFY_TOKEN", note: "المرحلة 4. Webhook: /api/webhooks/meta" },
    { name: "Zoho CRM", ok: false, env: "—", note: "مُخطط للمستقبل. الـ CRM الداخلي هو المصدر الأساسي حاليًا." },
  ];
  return (
    <>
      <PageHeader title="الربط مع المنصات" subtitle="المفاتيح بتتحط في ملف البيئة على السيرفر بس (مش في الشات ولا في الداشبورد). الحالة هنا بتقول هل المفتاح موجود؛ الاتصال الفعلي بيتأكد باختبار حقيقي." />
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((i) => (
          <div key={i.name} className="card p-5 text-sm">
            <div className="flex items-center justify-between"><h2 className="font-medium">{i.name}</h2>
              {i.ok ? <Badge tone="green">المفتاح موجود</Badge> : i.partial ? <Badge tone="violet">{i.partial}</Badge> : <Badge tone="gray">غير متصل</Badge>}</div>
            <p className="mt-2 text-muted">{i.note}</p>
            <p className="mt-2 font-mono text-xs text-muted" dir="ltr">{i.env}</p>
          </div>
        ))}
      </div>
      <p className="mt-6 text-sm text-muted">ملحوظة: وجود المفتاح مش معناه إن الربط شغال. كل قناة بتتعلّم "متصلة" بس بعد أول رسالة حقيقية تتبعت وتوصل.</p>
    </>
  );
}
