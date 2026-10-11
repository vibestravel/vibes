import { requireUser } from "@/lib/auth";
import { ACCESS } from "@/lib/rbac";
import { PageHeader, Empty } from "@/components/ui";

export default async function Page() {
  await requireUser(ACCESS.automations);
  return (<><PageHeader title="الأتمتة والمتابعة الذكية" /><Empty title="لسه متبنيش">المرحلة 5: اقتراحات متابعة للعملاء اللي طلبوا أسعار أو استلموا برامج أو وقفوا رد، بقوالب معتمدة من Meta أو بموافقة موظف، ومن غير أي رسايل ترويجية غير مسموحة.</Empty></>);
}
