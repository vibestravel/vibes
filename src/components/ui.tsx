import clsx from "clsx";
import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

const TONES = {
  gray: "bg-slate-100 text-slate-700", green: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-800",
  red: "bg-red-50 text-red-700", teal: "bg-teal-50 text-teal-800", blue: "bg-sky-50 text-sky-800", violet: "bg-violet-50 text-violet-700",
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ tone = "gray", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={clsx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", TONES[tone], className)}>{children}</span>;
}

export function Stat({ label, value, hint, unavailable }: { label: string; value?: ReactNode; hint?: string; unavailable?: string }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-muted">{label}</p>
      {unavailable ? <p className="mt-2 text-sm text-amber-700">{unavailable}</p> : <p className="num mt-2 text-start text-3xl font-semibold">{value}</p>}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-2 max-w-md text-sm text-muted">{children}</div>}
    </div>
  );
}

export function SimBadge() { return <Badge tone="violet">محاكاة</Badge>; }

export const CHANNEL_LABEL: Record<string, string> = {
  WHATSAPP: "واتساب", INSTAGRAM_DM: "إنستجرام", INSTAGRAM_COMMENT: "كومنت إنستجرام", MESSENGER: "ماسنجر",
  FACEBOOK_COMMENT: "كومنت فيسبوك", SIMULATOR: "المحاكي",
};
export const MODE_LABEL: Record<string, { label: string; tone: Tone }> = {
  AI: { label: "المساعد الذكي", tone: "teal" }, HUMAN: { label: "موظف", tone: "amber" }, PAUSED: { label: "متوقف مؤقتًا", tone: "gray" },
};
export const PRIORITY_LABEL: Record<string, { label: string; tone: Tone }> = {
  LOW: { label: "منخفضة", tone: "gray" }, NORMAL: { label: "عادية", tone: "blue" }, HIGH: { label: "عالية", tone: "amber" }, URGENT: { label: "عاجلة", tone: "red" },
};

export function fmtDate(d: Date | string | null | undefined, withTime = true) {
  if (!d) return "—";
  return new Date(d).toLocaleString("ar-EG", { timeZone: "Africa/Cairo", day: "numeric", month: "short", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) });
}
