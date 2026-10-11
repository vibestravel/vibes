import { requireUser } from "@/lib/auth";
import { ACCESS } from "@/lib/rbac";
import { PageHeader, Empty } from "@/components/ui";

export default async function Page() {
  await requireUser(ACCESS.analytics);
  return (<><PageHeader title="التحليلات" /><Empty title="لسه متبنيش">المرحلة 5: تقارير الأقسام، جودة ردود المساعد، و50 سيناريو اختبار بالعامية والإنجليزي والفرانكو. أرقام الإدارة الأساسية موجودة دلوقتي في الداشبورد.</Empty></>);
}
