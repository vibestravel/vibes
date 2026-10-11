// Outbound delivery to customer channels via official Meta APIs.
// Nothing is reported as SENT unless the platform API accepted it.
import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { db } from "@/db";
import { documentDeliveries, type Channel, packages } from "@/db/schema";
import { audit } from "@/lib/audit";

const GRAPH = () => `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v21.0"}`;

export function channelConfigured(ch: Channel) {
  if (ch === "SIMULATOR") return true;
  if (ch === "WHATSAPP") return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
  return Boolean(process.env.META_PAGE_ACCESS_TOKEN);
}

type SendResult = { status: "SENT" | "SIMULATED" | "NOT_CONFIGURED" | "FAILED"; externalId?: string; error?: string };

async function postJson(url: string, token: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || `HTTP ${res.status}`);
  return json;
}

/** recipient = platform user id (PSID / IGSID) or WhatsApp phone (wa_id). */
export async function sendText(ch: Channel, recipient: string, text: string): Promise<SendResult> {
  if (ch === "SIMULATOR") return { status: "SIMULATED" };
  if (!channelConfigured(ch)) return { status: "NOT_CONFIGURED" };
  try {
    if (ch === "WHATSAPP") {
      const r = await postJson(`${GRAPH()}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, process.env.WHATSAPP_TOKEN!, {
        messaging_product: "whatsapp", to: recipient, type: "text", text: { body: text },
      });
      return { status: "SENT", externalId: r?.messages?.[0]?.id };
    }
    if (ch === "MESSENGER" || ch === "INSTAGRAM_DM") {
      const r = await postJson(`${GRAPH()}/me/messages`, process.env.META_PAGE_ACCESS_TOKEN!, {
        recipient: { id: recipient }, messaging_type: "RESPONSE", message: { text },
      });
      return { status: "SENT", externalId: r?.message_id };
    }
    return { status: "NOT_CONFIGURED", error: "comment replies are Phase 4" };
  } catch (e) {
    return { status: "FAILED", error: (e as Error).message };
  }
}

// ── secure document links ───────────────────────────────
const key = () => new TextEncoder().encode(process.env.SESSION_SECRET!);
export async function signedDocUrl(documentId: string, days = 7) {
  const t = await new SignJWT({ doc: documentId }).setProtectedHeader({ alg: "HS256" }).setExpirationTime(`${days}d`).sign(key());
  return `${process.env.APP_URL || "http://localhost:3000"}/api/files/${t}`;
}
export async function verifyDocToken(token: string): Promise<string | null> {
  try { const { payload } = await jwtVerify(token, key()); return String(payload.doc); } catch { return null; }
}

export async function deliverPackage(a: {
  pkg: typeof packages.$inferSelect; conversationId: string; customerId: string; channel: Channel; isSimulated: boolean;
  recipient?: string;
}) {
  const url = await signedDocUrl(a.pkg.sourceDocumentId!);
  let status: "SIMULATED" | "SENT" | "LINK_SENT" | "FAILED" = "SIMULATED";
  let error: string | undefined;

  if (!a.isSimulated) {
    if (!a.recipient || !channelConfigured(a.channel)) { status = "FAILED"; error = "channel not configured"; }
    else {
      try {
        if (a.channel === "WHATSAPP") {
          await postJson(`${GRAPH()}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, process.env.WHATSAPP_TOKEN!, {
            messaging_product: "whatsapp", to: a.recipient, type: "document", document: { link: url, filename: `${a.pkg.name}.pdf` },
          });
          status = "SENT";
        } else {
          const r = await sendText(a.channel, a.recipient, `${a.pkg.name}\n${url}`);
          status = r.status === "SENT" ? "LINK_SENT" : "FAILED"; error = r.error;
        }
      } catch (e) { status = "FAILED"; error = (e as Error).message; }
    }
  }
  await db.insert(documentDeliveries).values({ packageId: a.pkg.id, customerId: a.customerId, conversationId: a.conversationId, channel: a.channel, status, error });
  await audit({ actorType: "AI", action: "package.deliver", entity: "package", entityId: a.pkg.id, details: { status, error } });
  return { ok: status !== "FAILED", status, link: a.isSimulated ? url : undefined, error,
    instruction: status === "FAILED" ? "Delivery failed: tell the customer a colleague will send it, and hand off." : undefined };
}
