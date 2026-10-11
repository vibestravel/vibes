// Meta webhook helpers (signature check + payload parsing). Pure functions → unit tested.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Channel } from "@/db/schema";

export function verifySignature(raw: string, header: string | null, secret: string | undefined) {
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(raw).digest("hex"));
  const got = Buffer.from(header.slice(7));
  return expected.length === got.length && timingSafeEqual(expected, got);
}

type Inbound = { channel: Channel; from: string; name?: string; text: string; id: string };

export function parseMetaPayload(body: any /* eslint-disable-line */): Inbound[] {
  const out: Inbound[] = [];
  if (body?.object === "whatsapp_business_account") {
    for (const e of body.entry ?? []) for (const ch of e.changes ?? []) {
      const v = ch.value ?? {};
      const names = new Map((v.contacts ?? []).map((c: any) => [c.wa_id, c.profile?.name]));
      for (const m of v.messages ?? []) {
        const text = m.type === "text" ? m.text?.body : m.type === "button" ? m.button?.text : m.type === "interactive" ? (m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title) : `[${m.type}]`;
        if (text) out.push({ channel: "WHATSAPP", from: m.from, name: names.get(m.from) as string | undefined, text, id: m.id });
      }
    }
  } else if (body?.object === "page" || body?.object === "instagram") {
    for (const e of body.entry ?? []) for (const ev of e.messaging ?? []) {
      if (ev.message?.is_echo || !ev.message?.mid) continue;
      out.push({ channel: body.object === "page" ? "MESSENGER" : "INSTAGRAM_DM", from: ev.sender.id, text: ev.message.text ?? "[attachment]", id: ev.message.mid });
    }
  }
  return out;
}

