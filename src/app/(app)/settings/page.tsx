import { requireUser } from "@/lib/auth";
import { ACCESS } from "@/lib/rbac";
import { PageHeader, Empty } from "@/components/ui";

export default async function Page() {
  await requireUser(ACCESS.settings);
  return (<><PageHeader title="الإعدادات" /><Empty title="لسه متبنيش">إعدادات عامة، الاحتفاظ بالبيانات، ومراحل الـ Pipeline. لحد كده الإعدادات الأساسية في ملف البيئة على السيرفر (شوف docs/DEPLOYMENT.md).</Empty></>);
}
