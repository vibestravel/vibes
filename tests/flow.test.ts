// End-to-end flow tests against a real Postgres database (uses DATABASE_URL).
// Run: npm test   (tsx with the react-server condition so "server-only" modules load)
import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { conversations, messages, leads, customers, documentDeliveries } from "@/db/schema";
import { findOrCreateConversation, storeCustomerMessage, replyIfAiMode } from "@/lib/conversations";
import { executeTool } from "@/lib/ai/tools";
import { scoreLead } from "@/lib/leads";
import { isFresh } from "@/lib/flexivi";
import { verifySignature, parseMetaPayload } from "@/lib/meta";
import { extractText } from "@/lib/packages/extract";

delete process.env.ANTHROPIC_API_KEY; // tests run the demo engine deterministically
const created: string[] = [];
after(async () => {
  if (created.length) await db.delete(customers).where(inArray(customers.id, created));
  process.exit(0);
});

async function sim() {
  const c = await findOrCreateConversation({ channel: "SIMULATOR", externalUserId: `test-${crypto.randomUUID()}`, isSimulated: true });
  created.push(c.customerId);
  return c;
}
async function say(id: string, text: string) {
  await storeCustomerMessage(id, text);
  const m = await replyIfAiMode(id);
  return m?.text ?? "";
}

test("honeymoon flow: asks one question at a time, finds approved package, sends document, creates lead", async () => {
  const c = await sim();
  assert.match(await say(c.id, "عندكم عروض شهر عسل؟"), /شهر كام/);
  assert.match(await say(c.id, "ديسمبر"), /وجهة/);
  assert.match(await say(c.id, "مالديف"), /كام ليلة/);
  assert.match(await say(c.id, "5 ليالي"), /ميزانية/);
  const r = await say(c.id, "حوالي 150000 جنيه");
  assert.match(r, /عينة تجريبية/); // only the approved demo package can be quoted
  const [lead] = await db.select().from(leads).where(eq(leads.conversationId, c.id));
  assert.ok(lead, "lead created");
  assert.equal(lead.destination, "مالديف");
  assert.ok(lead.score >= 45);
  assert.equal(lead.isSimulated, true);
});

test("visa flow: asks category, then returns FlexiVi data clearly marked as demo", async () => {
  const c = await sim();
  assert.match(await say(c.id, "فيه مواعيد ألمانيا قريب؟"), /سياحة ولا بيزنس/);
  const r = await say(c.id, "سياحة");
  assert.match(r, /تجريبية/);
  assert.match(r, /آخر تحديث/);
});

test("FlexiVi mock data is NEVER shown to a real (non-simulated) customer", async () => {
  const out = (await executeTool("get_appointment_availability", { destination: "DE", category: "TOURISM" },
    { conversationId: "x", customerId: "x", channel: "WHATSAPP", isSimulated: false })) as { available: boolean };
  assert.equal(out.available, false);
});

test("real customer + no AI key → no auto reply, conversation handed to a human", async () => {
  const c = await findOrCreateConversation({ channel: "WHATSAPP", externalUserId: `2010${Date.now()}`.slice(0, 12), name: "Test" });
  created.push(c.customerId);
  await storeCustomerMessage(c.id, "hello", `WHATSAPP:test-${Date.now()}`);
  const m = await replyIfAiMode(c.id);
  assert.equal(m, null);
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, c.id));
  assert.equal(conv.mode, "HUMAN");
});

test("complaint → immediate handoff, AI stops replying", async () => {
  const c = await sim();
  await say(c.id, "عندي شكوى من الرحلة اللي فاتت");
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, c.id));
  assert.equal(conv.mode, "HUMAN");
  assert.match(conv.handoffReason ?? "", /complaint/);
  assert.equal(await say(c.id, "ألو؟"), "");
});

test("duplicate webhook delivery is stored once; concurrent calls produce one reply", async () => {
  const c = await sim();
  const ext = `SIMULATOR:dup-${Date.now()}`;
  assert.equal(await storeCustomerMessage(c.id, "مرحبا", ext), true);
  assert.equal(await storeCustomerMessage(c.id, "مرحبا", ext), false);
  await Promise.all([replyIfAiMode(c.id), replyIfAiMode(c.id), replyIfAiMode(c.id)]);
  const ai = (await db.select().from(messages).where(eq(messages.conversationId, c.id))).filter((m) => m.author === "AI");
  assert.equal(ai.length, 1);
});

test("unapproved package cannot be sent", async () => {
  const out = (await executeTool("send_package_document", { package_id: "does-not-exist" }, { conversationId: "x", customerId: "x", channel: "SIMULATOR", isSimulated: true })) as { ok: boolean };
  assert.equal(out.ok, false);
  assert.equal((await db.select().from(documentDeliveries).where(eq(documentDeliveries.packageId, "does-not-exist"))).length, 0);
});

test("tool input validation rejects bad input", async () => {
  const out = (await executeTool("update_lead", { department: "NOPE" }, { conversationId: "x", customerId: "x", channel: "SIMULATOR", isSimulated: true })) as { error?: string };
  assert.equal(out.error, "invalid input");
});

test("lead scoring", () => {
  assert.equal(scoreLead({}), 0);
  assert.equal(scoreLead({ destination: "x", travelDate: "y", travelers: 2, budget: "z", phone: "1", name: "n", readyToBook: true }), 100);
});

test("freshness check", () => {
  assert.equal(isFresh(new Date().toISOString(), 30), true);
  assert.equal(isFresh(new Date(Date.now() - 31 * 60_000).toISOString(), 30), false);
  assert.equal(isFresh("garbage", 30), false);
});

test("Meta webhook signature + payload parsing", () => {
  const raw = JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ value: { contacts: [{ wa_id: "201000000000", profile: { name: "Ali" } }], messages: [{ from: "201000000000", id: "wamid.1", type: "text", text: { body: "hi" } }] } }] }] });
  const sig = "sha256=" + createHmac("sha256", "s3cret").update(raw).digest("hex");
  assert.equal(verifySignature(raw, sig, "s3cret"), true);
  assert.equal(verifySignature(raw, sig, "wrong"), false);
  assert.equal(verifySignature(raw, null, "s3cret"), false);
  assert.deepEqual(parseMetaPayload(JSON.parse(raw)), [{ channel: "WHATSAPP", from: "201000000000", name: "Ali", text: "hi", id: "wamid.1" }]);
  const ig = parseMetaPayload({ object: "instagram", entry: [{ messaging: [{ sender: { id: "9" }, message: { mid: "m1", text: "سلام" } }, { sender: { id: "9" }, message: { mid: "m2", text: "echo", is_echo: true } }] }] });
  assert.equal(ig.length, 1);
  assert.equal(ig[0].channel, "INSTAGRAM_DM");
});

test("text extraction: xlsx and pptx", async () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Package", "Price"], ["Umrah November 15 nights", 45000]]), "Umrah");
  const x = await extractText(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }), "a.xlsx");
  assert.match(x.text, /Umrah November/);
  const zip = new JSZip();
  zip.file("ppt/slides/slide1.xml", "<p:sld><a:t>Maldives honeymoon</a:t><a:t>5 nights &amp; breakfast</a:t></p:sld>");
  const p = await extractText(await zip.generateAsync({ type: "nodebuffer" }), "b.pptx");
  assert.match(p.text, /Maldives honeymoon 5 nights & breakfast/);
});
