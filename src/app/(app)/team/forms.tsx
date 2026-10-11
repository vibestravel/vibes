"use client";
import { useActionState } from "react";
import { createUser, changePassword } from "../actions";

export function NewUserForm({ departments, roles }: { departments: { id: string; name: string }[]; roles: [string, string][] }) {
  const [s, action, pending] = useActionState(createUser, null);
  return (
    <form action={action} className="card space-y-3 p-5">
      <h2 className="font-medium">إضافة موظف</h2>
      <input name="name" placeholder="الاسم" required className="input" />
      <input name="email" type="email" placeholder="الإيميل" required className="input" dir="ltr" />
      <input name="password" type="password" placeholder="كلمة سر مؤقتة (10 حروف+)" required minLength={10} className="input" dir="ltr" />
      <select name="role" className="input">{roles.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      <select name="departmentId" className="input"><option value="">كل الأقسام</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
      {s?.error && <p className="text-sm text-red-700">{s.error}</p>}{s?.ok && <p className="text-sm text-emerald-700">اتضاف.</p>}
      <button className="btn-primary w-full" disabled={pending}>إضافة</button>
    </form>
  );
}
export function PasswordForm() {
  const [s, action, pending] = useActionState(changePassword, null);
  return (
    <form action={action} className="card space-y-3 p-5">
      <h2 className="font-medium">تغيير كلمة السر بتاعتي</h2>
      <input name="password" type="password" minLength={10} required className="input" dir="ltr" />
      {s?.error && <p className="text-sm text-red-700">{s.error}</p>}{s?.ok && <p className="text-sm text-emerald-700">اتغيرت.</p>}
      <button className="btn-ghost w-full" disabled={pending}>حفظ</button>
    </form>
  );
}
