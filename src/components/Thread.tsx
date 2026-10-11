"use client";
import { useEffect, useRef } from "react";
import clsx from "clsx";

export type Msg = { id: string; author: string; text: string; at: string; by?: string | null; meta?: Record<string, unknown> | null };

export function Thread({ messages }: { messages: Msg[] }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [messages.length]);
  return (
    <div className="flex-1 space-y-3 overflow-y-auto bg-canvas/60 p-4">
      {messages.map((m) => {
        const mine = m.author !== "CUSTOMER";
        const delivery = m.meta?.delivery as string | undefined;
        return (
          <div key={m.id} className={clsx("flex", mine ? "justify-end" : "justify-start")}>
            <div className={clsx("max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
              m.author === "CUSTOMER" && "bg-white", m.author === "AI" && "bg-teal-700 text-white", m.author === "HUMAN" && "bg-ink text-white", m.author === "SYSTEM" && "bg-amber-50 text-amber-900")}>
              <p className="whitespace-pre-wrap">{m.text}</p>
              <p className={clsx("mt-1 text-[11px]", m.author === "CUSTOMER" ? "text-muted" : "text-white/60")}>
                {m.author === "AI" ? (m.meta?.engine === "demo" ? "محرك تجريبي (مش AI حقيقي)" : "المساعد الذكي") : m.author === "HUMAN" ? m.by ?? "موظف" : ""}
                {delivery && delivery !== "SENT" && delivery !== "SIMULATED" ? ` · لم يُرسل (${delivery})` : ""}
                {" · "}{new Date(m.at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Cairo" })}
              </p>
            </div>
          </div>
        );
      })}
      <div ref={end} />
    </div>
  );
}
