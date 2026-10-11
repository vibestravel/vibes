import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, departments } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ACCESS, ROLE_LABELS } from "@/lib/rbac";
import { PageHeader, Badge } from "@/components/ui";
import { toggleUser } from "../actions";
import { NewUserForm, PasswordForm } from "./forms";

export default async function TeamPage() {
  const me = await requireUser(ACCESS.team);
  const [rows, depts] = await Promise.all([
    db.select({ u: users, d: departments }).from(users).leftJoin(departments, eq(users.departmentId, departments.id)).orderBy(users.createdAt),
    db.select().from(departments),
  ]);
  return (
    <>
      <PageHeader title="الفريق والصلاحيات" />
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead className="border-b border-line"><tr><th className="th">الاسم</th><th className="th">الدور</th><th className="th">القسم</th><th className="th">الحالة</th><th className="th"></th></tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map(({ u, d }) => (
                <tr key={u.id}>
                  <td className="td"><p className="font-medium">{u.name}</p><p className="text-xs text-muted" dir="ltr">{u.email}</p></td>
                  <td className="td">{ROLE_LABELS[u.role]}</td><td className="td">{d?.nameAr ?? "كل الأقسام"}</td>
                  <td className="td"><Badge tone={u.active ? "green" : "gray"}>{u.active ? "نشط" : "موقوف"}</Badge></td>
                  <td className="td">{u.id !== me.id && <form action={toggleUser.bind(null, u.id, !u.active)}><button className="btn-ghost py-1 text-xs">{u.active ? "إيقاف" : "تفعيل"}</button></form>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-4">
          <NewUserForm departments={depts.map((d) => ({ id: d.id, name: d.nameAr }))} roles={Object.entries(ROLE_LABELS).filter(([k]) => me.role === "CEO" || k !== "CEO")} />
          <PasswordForm />
        </div>
      </div>
    </>
  );
}
