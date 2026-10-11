"use server";
import { redirect } from "next/navigation";
import { login } from "@/lib/auth";
import { audit } from "@/lib/audit";

const attempts = new Map<string, { n: number; t: number }>();

export async function loginAction(_: unknown, form: FormData) {
  const email = String(form.get("email") ?? "").slice(0, 200);
  const password = String(form.get("password") ?? "").slice(0, 200);
  const a = attempts.get(email) ?? { n: 0, t: Date.now() };
  if (Date.now() - a.t > 15 * 60_000) { a.n = 0; a.t = Date.now(); }
  if (a.n >= 8) return { error: "محاولات كتير. جرّب تاني بعد ربع ساعة." };
  if (!(await login(email, password))) {
    a.n++; attempts.set(email, a);
    await audit({ actorType: "SYSTEM", action: "auth.failed", details: { email } });
    return { error: "الإيميل أو كلمة السر غلط." };
  }
  attempts.delete(email);
  redirect("/");
}
