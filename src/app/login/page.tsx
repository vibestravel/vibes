"use client";
import { useActionState } from "react";
import { loginAction } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-ink p-12 text-white lg:flex">
        <div className="text-lg font-semibold tracking-wide" dir="ltr">VIBES <span className="text-brand-2">AI</span></div>
        <div>
          <h1 className="text-4xl font-semibold leading-tight">فريق السفر الذكي<br />بتاع فايبس</h1>
          <p className="mt-4 max-w-md text-slate-300">كل المحادثات، العملاء، البرامج ومواعيد الفيزا في مكان واحد.</p>
        </div>
        <p className="text-xs text-slate-500" dir="ltr">Vibes Travel Egypt · Internal platform</p>
      </section>
      <section className="flex items-center justify-center p-6">
        <form action={action} className="w-full max-w-sm space-y-4">
          <h2 className="text-2xl font-semibold">تسجيل الدخول</h2>
          <div><label className="label">الإيميل</label><input name="email" type="email" required className="input" dir="ltr" autoComplete="username" /></div>
          <div><label className="label">كلمة السر</label><input name="password" type="password" required className="input" dir="ltr" autoComplete="current-password" /></div>
          {state?.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
          <button className="btn-primary w-full" disabled={pending}>{pending ? "جاري الدخول…" : "دخول"}</button>
        </form>
      </section>
    </main>
  );
}
