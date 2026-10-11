import { requireUser } from "@/lib/auth";
import { ACCESS } from "@/lib/rbac";
import { aiConfigured } from "@/lib/ai/engine";
import { flexiviMode } from "@/lib/flexivi";
import { PageHeader } from "@/components/ui";
import { Simulator } from "./Simulator";

export default async function AssistantPage() {
  await requireUser(ACCESS.simulator);
  return (
    <>
      <PageHeader title="المساعد الذكي — محاكي المحادثة" subtitle="جرّب المساعد كأنك عميل. المحاكي بيستخدم الإعدادات المسودة من استوديو الشخصية، وكل حاجة هنا متعلّمة إنها محاكاة ومش بتدخل في الأرقام." />
      <Simulator aiLive={aiConfigured()} flexivi={flexiviMode()} />
    </>
  );
}
