"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  LayoutDashboard, Inbox, Bot, Users, Package, Stamp, BookOpen, Workflow, BarChart3, UsersRound, Plug, Sparkles, Settings, LogOut, Menu,
} from "lucide-react";
import { useState } from "react";

const ITEMS = [
  { href: "/", label: "الداشبورد", icon: LayoutDashboard, section: "dashboard" },
  { href: "/inbox", label: "الصندوق الموحد", icon: Inbox, section: "inbox" },
  { href: "/assistant", label: "المساعد الذكي", icon: Bot, section: "simulator" },
  { href: "/crm", label: "العملاء والـ CRM", icon: Users, section: "crm" },
  { href: "/packages", label: "برامج السفر", icon: Package, section: "packages" },
  { href: "/flexivi", label: "مركز الفيزا FlexiVi", icon: Stamp, section: "flexivi" },
  { href: "/knowledge", label: "قاعدة المعرفة", icon: BookOpen, section: "knowledge" },
  { href: "/automations", label: "الأتمتة", icon: Workflow, section: "automations" },
  { href: "/analytics", label: "التحليلات", icon: BarChart3, section: "analytics" },
  { href: "/team", label: "الفريق", icon: UsersRound, section: "team" },
  { href: "/integrations", label: "الربط مع المنصات", icon: Plug, section: "integrations" },
  { href: "/personality", label: "استوديو شخصية المساعد", icon: Sparkles, section: "personality" },
  { href: "/settings", label: "الإعدادات", icon: Settings, section: "settings" },
];

export function Sidebar({ allowed, user, logout }: { allowed: string[]; user: { name: string; roleLabel: string }; logout: () => Promise<void> }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2">
      {ITEMS.filter((i) => allowed.includes(i.section)).map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link key={href} href={href} onClick={() => setOpen(false)}
            className={clsx("flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition", active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white")}>
            <Icon size={17} strokeWidth={1.8} />{label}
          </Link>
        );
      })}
    </nav>
  );
  const body = (
    <div className="flex h-full flex-col bg-ink">
      <div className="px-6 pb-4 pt-6">
        <div className="text-lg font-semibold tracking-wide text-white" dir="ltr">VIBES <span className="text-brand-2">AI</span></div>
        <p className="text-xs text-slate-500">فريق السفر الذكي</p>
      </div>
      {nav}
      <div className="border-t border-white/10 p-4">
        <p className="text-sm text-white">{user.name}</p>
        <p className="text-xs text-slate-500">{user.roleLabel}</p>
        <form action={logout}><button className="mt-3 flex items-center gap-2 text-xs text-slate-400 hover:text-white"><LogOut size={14} />خروج</button></form>
      </div>
    </div>
  );
  return (
    <>
      <aside className="fixed inset-y-0 start-0 hidden w-64 lg:block">{body}</aside>
      <div className="sticky top-0 z-30 flex items-center justify-between bg-ink px-4 py-3 lg:hidden">
        <span className="font-semibold text-white" dir="ltr">VIBES <span className="text-brand-2">AI</span></span>
        <button onClick={() => setOpen(true)} className="text-white" aria-label="القائمة"><Menu /></button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside className="absolute inset-y-0 start-0 w-72" onClick={(e) => e.stopPropagation()}>{body}</aside>
        </div>
      )}
    </>
  );
}
