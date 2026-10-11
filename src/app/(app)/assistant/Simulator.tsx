"use client";
import { useState, useTransition } from "react";
import { Thread } from "@/components/Thread";
import { Badge } from "@/components/ui";
import { simulatorSend } from "../actions";

type State = Awaited<ReturnType<typeof simulatorSend>>;
const SAMPLES = ["عندكم عروض شهر عسل؟", "فيه مواعيد ألمانيا قريب؟", "3ayez omra november", "Hi, do you have Nile cruise packages?", "عندي شكوى من الرحلة اللي فاتت"];

export function Simulator({ aiLive, flexivi }: { aiLive: boolean; flexivi: string }) {
  const [state, setState] = useState<State>(null);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const send = (t: string) => {
    if (!t.trim()) return;
    setText(""); setErr(null);
    start(async () => {
      try { setState(await simulatorSend(state?.id ?? null, t)); } catch (e) { setErr((e as Error).message); }
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <section className="card flex h-[calc(100vh-12rem)] min-h-[480px] flex-col">
        <header className="flex flex-wrap items-center gap-2 border-b border-line p-4 text-sm">
          {aiLive ? <Badge tone="teal">Claude متصل</Badge> : <Badge tone="amber">محرك تجريبي — مش AI حقيقي</Badge>}
          <Badge tone={flexivi === "live" ? "green" : "violet"}>FlexiVi: {flexivi === "live" ? "مباشر" : "بيانات تجريبية"}</Badge>
          {state?.mode && state.mode !== "AI" && <Badge tone="red">اتحولت لموظف: {state.handoffReason}</Badge>}
          <button onClick={() => setState(null)} className="btn-ghost ms-auto py-1">محادثة جديدة</button>
        </header>
        {state?.messages?.length ? <Thread messages={state.messages} /> : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-muted">ابدأ بأي رسالة، أو جرّب واحدة من دول:</p>
            <div className="flex max-w-lg flex-wrap justify-center gap-2">
              {SAMPLES.map((s) => <button key={s} onClick={() => send(s)} className="rounded-full bg-canvas px-3 py-1.5 text-sm ring-1 ring-line hover:bg-white">{s}</button>)}
            </div>
          </div>
        )}
        {err && <p className="bg-red-50 px-4 py-2 text-sm text-red-700">{err}</p>}
        <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="flex gap-2 border-t border-line p-3">
          <input value={text} onChange={(e) => setText(e.target.value)} className="input" placeholder="اكتب كأنك عميل…" disabled={pending || state?.mode === "HUMAN"} />
          <button className="btn-primary" disabled={pending}>{pending ? "…" : "إرسال"}</button>
        </form>
      </section>

      <aside className="space-y-4">
        <div className="card p-4 text-sm">
          <h2 className="mb-2 font-medium">الليد في الـ CRM</h2>
          {state?.lead ? (
            <ul className="space-y-1 text-muted">
              <li>الوجهة: {state.lead.destination ?? "—"}</li><li>الميعاد: {state.lead.travelDate ?? "—"}</li>
              <li>الميزانية: {state.lead.budget ?? "—"}</li><li>الموبايل: <span dir="ltr">{state.customer.phone ?? "—"}</span></li>
              <li>الدرجة: <span className="num">{state.lead.score}</span>/100</li>
            </ul>
          ) : <p className="text-muted">لسه متسجلش ليد.</p>}
        </div>
        <div className="card max-h-[50vh] overflow-y-auto p-4 text-sm">
          <h2 className="mb-2 font-medium">اللي المساعد عمله</h2>
          {!state?.runs?.length && <p className="text-muted">هنا هيظهر كل أداة استخدمها المساعد والنتيجة اللي رجعت، عشان تتأكد إنه مبيخترعش.</p>}
          {state?.runs?.slice().reverse().map((r) => (
            <div key={r.id} className="mb-3 border-b border-line pb-3 last:border-0">
              <p className="text-xs text-muted">{r.engine === "demo" ? "تجريبي" : "Claude"} · <span className="num">{r.latencyMs}ms</span>{r.error ? ` · خطأ: ${r.error}` : ""}</p>
              {(r.toolCalls as { name: string; input: unknown; output: unknown }[] | null)?.map((c, i) => (
                <details key={i} className="mt-1">
                  <summary className="cursor-pointer font-mono text-xs text-brand" dir="ltr">{c.name}</summary>
                  <pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-canvas p-2 text-[11px]" dir="ltr">{JSON.stringify({ input: c.input, output: c.output }, null, 2)}</pre>
                </details>
              ))}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
