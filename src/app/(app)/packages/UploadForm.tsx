"use client";
import { useActionState } from "react";
import { uploadPackages } from "../actions";

export function UploadForm({ departments, aiLive }: { departments: { id: string; name: string }[]; aiLive: boolean }) {
  const [state, action, pending] = useActionState(uploadPackages, null);
  return (
    <form action={action} className="card space-y-3 p-5">
      <div className="flex flex-wrap items-end gap-3">
        <div><label className="label">القسم</label>
          <select name="departmentId" required className="input w-56">{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
        <div className="flex-1"><label className="label">الملفات (PDF، PowerPoint، Word، Excel، صور) — لحد 30 ملف، 25 ميجا للملف</label>
          <input name="files" type="file" multiple required accept=".pdf,.pptx,.docx,.xlsx,.png,.jpg,.jpeg" className="input file:me-3 file:rounded-lg file:border-0 file:bg-canvas file:px-3 file:py-1" /></div>
        <button className="btn-primary" disabled={pending}>{pending ? "جاري الرفع والاستخراج…" : "رفع"}</button>
      </div>
      <p className="text-xs text-muted">{aiLive ? "Claude هيستخرج البيانات تلقائيًا، وكل برنامج هيستنى مراجعتك قبل الاعتماد." : "Claude مش متفعّل: الملف هيترفع ويتقري النص بتاعه، وإنت تكمّل البيانات يدوي قبل الاعتماد."}</p>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state?.results?.length ? (
        <ul className="space-y-1 text-sm">
          {state.results.map((r, i) => (
            <li key={i} className={r.ok ? "text-emerald-700" : "text-red-700"}>
              {r.file}: {r.ok ? `اترفع — ${r.packages} برنامج${r.status === "NEEDS_OCR" ? " (الملف ممسوح ضوئيًا ومحتاج OCR، كمّل البيانات يدوي)" : ""}` : r.error}
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
