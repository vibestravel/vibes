import { requireUser, logout } from "@/lib/auth";
import { ACCESS, ROLE_LABELS, can } from "@/lib/rbac";
import { Sidebar } from "@/components/Sidebar";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const allowed = (Object.keys(ACCESS) as (keyof typeof ACCESS)[]).filter((s) => can(user.role, s));
  async function doLogout() { "use server"; await logout(); redirect("/login"); }
  return (
    <div className="min-h-screen">
      <Sidebar allowed={allowed} user={{ name: user.name, roleLabel: ROLE_LABELS[user.role] }} logout={doLogout} />
      <main className="lg:ms-64"><div className="mx-auto max-w-7xl p-4 sm:p-8">{children}</div></main>
    </div>
  );
}
