// Webhook for WhatsApp Cloud API, Messenger and Instagram DMs (Phase 4).
// Every POST is verified with X-Hub-Signature-256 (HMAC of the raw body with META_APP_SECRET).
import { after } from "next/server";
import { findOrCreateConversation, storeCustomerMessage, replyIfAiMode } from "@/lib/conversations";
import { audit } from "@/lib/audit";
import { verifySignature, parseMetaPayload } from "@/lib/meta";

export async function GET(req: Request) {
  const u = new URL(req.url);
  if (u.searchParams.get("hub.mode") === "subscribe" && process.env.META_VERIFY_TOKEN && u.searchParams.get("hub.verify_token") === process.env.META_VERIFY_TOKEN)
    return new Response(u.searchParams.get("hub.challenge") ?? "", { status: 200 });
  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"), process.env.META_APP_SECRET)) {
    await audit({ actorType: "SYSTEM", action: "webhook.bad_signature" });
    return new Response("Invalid signature", { status: 401 });
  }
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return new Response("Bad JSON", { status: 400 }); }
  const items = parseMetaPayload(body);
  // Respond fast; process after the response so Meta does not retry.
  after(async () => {
    for (const m of items) {
      try {
        const conv = await findOrCreateConversation({ channel: m.channel, externalUserId: m.from, name: m.name });
        const isNew = await storeCustomerMessage(conv.id, m.text, `${m.channel}:${m.id}`);
        if (isNew) await replyIfAiMode(conv.id, m.from);
      } catch (e) {
        await audit({ actorType: "SYSTEM", action: "webhook.error", details: { error: (e as Error).message } });
      }
    }
  });
  return new Response("OK", { status: 200 });
}
