// ⚠️ DEMO ENGINE — rule-based, NOT real AI.
// Runs only inside the simulator when ANTHROPIC_API_KEY is not set, so the full flow
// (package search → document → CRM lead → handoff) can be demonstrated. It uses the
// same server tools as the real engine, so nothing it shows is invented.
import { executeTool, type ToolContext } from "./tools";
import type { EngineResult, HistoryItem } from "./engine";

const has = (t: string, re: RegExp) => re.test(t.toLowerCase());
const DESTS: [RegExp, string, string][] = [
  [/ألمانيا|المانيا|germany/, "DE", "ألمانيا"], [/فرنسا|france/, "FR", "فرنسا"], [/ايطاليا|إيطاليا|italy/, "IT", "إيطاليا"],
];
const MONTH_RE = /(يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر|january|february|march|april|may|june|july|august|september|october|november|december)/i;

export async function runDemo(history: HistoryItem[], ctx: ToolContext): Promise<EngineResult> {
  const calls: EngineResult["toolCalls"] = [];
  const call = async (name: string, input: unknown) => { const output = await executeTool(name, input, ctx); calls.push({ name, input, output }); return output as any; };
  const customer = history.filter((h) => h.author === "CUSTOMER").map((h) => h.text);
  const last = customer.at(-1) ?? "";
  const all = customer.join(" \n ");
  const en = /^[\x00-\x7F\s]+$/.test(last) && !/\d[a-z]|[a-z]\d/i.test(last);
  const reply = (ar: string, e: string) => ({ text: en ? e : ar, toolCalls: calls, model: "demo" });

  const phone = all.match(/(\+?20)?0?1[0125]\d{8}/)?.[0];
  if (phone && last.includes(phone.slice(-8))) {
    await call("update_lead", { department: guessDept(all), phone });
    if (last.replace(/\D/g, "").length >= 10 && last.replace(/[\d\s+]/g, "").length < 15)
      return reply("تمام، سجلت رقمك ❤️ تحب أساعدك في حاجة تانية ولا أحولك لحد من الفريق يكمل معاك؟", "Got your number, thanks! Anything else, or shall I connect you with the team?");
  }

  if (has(last, /شكوى|مشكلة|زعلان|استرداد|refund|complain|خصم|discount|عايز احجز|عاوز احجز|احجز|ادفع|book now|pay/)) {
    await call("update_lead", { department: guessDept(all), ready_to_book: has(last, /احجز|ادفع|book|pay/), summary: last.slice(0, 200) });
    await call("handoff_to_human", { reason: has(last, /شكوى|مشكلة|زعلان|complain/) ? "complaint" : has(last, /خصم|discount/) ? "price_negotiation" : "booking_or_payment", note: last.slice(0, 300), priority: "HIGH" });
    return reply("تمام ❤️ هحوّلك دلوقتي لحد من الفريق يكمل معاك على طول.", "Sure! I'm connecting you with a team member who'll continue with you shortly.");
  }

  if (has(all, /فيزا|فيزه|visa|سفارة|سفاره|مواعيد|ميعاد|appointment/)) {
    const d = DESTS.find(([re]) => re.test(all.toLowerCase()));
    const cat = has(all, /بيزنس|business|عمل/) ? "BUSINESS" : has(all, /سياح|tourism|tourist/) ? "TOURISM" : null;
    if (!d) return reply("أكيد أقدر أساعدك ❤️ الفيزا لأنهي دولة؟", "Happy to help! Which country is the visa for?");
    if (!cat) return reply(`تمام، ${d[2]}. بتقدم من مصر؟ والفيزا سياحة ولا بيزنس؟`, "Got it. Are you applying from Egypt, and is it tourism or business?");
    await call("update_lead", { department: "VISA", service: "visa", destination: d[2], visa_category: cat });
    const r = await call("get_appointment_availability", { destination: d[1], category: cat });
    if (!r.available) return reply("للأسف مش قادر أأكدلك المواعيد المتاحة دلوقتي. تحب أحولك لمتخصص الفيزا يراجعها معاك؟", "I can't confirm live availability right now. Shall I connect you with a visa specialist?");
    const a = r.data?.[0];
    const t = new Date(r.last_verified_at).toLocaleString("ar-EG", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", day: "numeric", month: "long" });
    const demo = r.is_demo_data ? "⚠️ دي بيانات تجريبية للتجربة بس، مش مواعيد حقيقية.\n" : "";
    if (!a?.earliestDate) return reply(`${demo}مفيش مواعيد متاحة حاليًا حسب آخر تحديث (${t}). تحب أبلغ متخصص الفيزا يتابعلك؟`, `${demo}No slots right now (last checked ${t}).`);
    return reply(`${demo}أقرب ميعاد متاح لفيزا ${d[2]} ${cat === "TOURISM" ? "سياحة" : "بيزنس"} هو ${a.earliestDate} (آخر تحديث ${t}). المواعيد بتتغير بسرعة، تحب نبدأ في الإجراءات؟`,
      `${demo}Earliest slot: ${a.earliestDate} (last verified ${t}). Availability changes quickly — shall we start?`);
  }

  const dept = guessDept(all);
  if (dept === "OUTBOUND" || dept === "RELIGIOUS") {
    const month = all.match(MONTH_RE)?.[0];
    const nights = Number(all.match(/(\d+)\s*(ليالي|ليلة|ليله|nights?)/i)?.[1]) || undefined;
    const budget = all.match(/(\d[\d,.]{2,})\s*(جنيه|ج|egp|دولار|\$|usd)?/i)?.[0];
    const destWord = dept === "RELIGIOUS" ? "عمرة" : pickDestination(customer);
    if (!month) return reply(dept === "RELIGIOUS" ? "أهلاً بحضرتك ❤️ حابب تسافر شهر كام إن شاء الله؟" : "أكيد طبعًا ❤️ بتفكروا تسافروا في شهر كام؟", "Of course! Which month are you thinking of travelling?");
    if (!destWord) return reply("حلو جدًا 😍 عندكوا وجهة معينة في بالكم ولا تحب أرشحلكم؟", "Lovely! Do you have a destination in mind?");
    if (!nights && dept === "OUTBOUND") return reply("اختيار تحفة ❤️ تحبوا تقعدوا كام ليلة تقريبًا؟", "Great choice! Roughly how many nights?");
    if (!budget && dept === "OUTBOUND") return reply("تمام، وفيه ميزانية معينة حابين نكون في حدودها؟", "And is there a budget you'd like to stay within?");
    await call("update_lead", { department: dept, service: dept === "RELIGIOUS" ? "umrah" : "holiday", destination: destWord, travel_date: month, budget });
    const res = await call("search_packages", { query: destWord, month, nights, department: dept });
    if (!res.count) return reply("للأسف مش لاقي برنامج معتمد مطابق دلوقتي. تحب أحولك لحد من الفريق يجهزلك عرض مخصوص؟", "I couldn't find an approved package that matches. Shall I connect you with a consultant?");
    const p = res.packages[0];
    const price = (p.prices ?? []).map((x: any) => `${x.label}${x.occupancy ? ` (${x.occupancy})` : ""}: ${x.amount} ${x.currency}`).join(" • ");
    if (p.has_document) await call("send_package_document", { package_id: p.id });
    return reply(`عندنا "${p.name}"${p.nights ? ` ${p.nights} ليالي` : ""}${price ? `\nالأسعار: ${price}` : ""}${p.has_document ? "\nبعتلك البرنامج بالتفاصيل، بص عليه وقولي رأيك." : ""}`,
      `We have "${p.name}"${price ? ` — ${price}` : ""}.`);
  }

  return reply("أهلاً بيك ❤️ أقدر أساعدك في إيه؟ رحلة، عمرة، فيزا، ولا حجز طيران وفنادق؟", "Hi! How can I help — a holiday, Umrah, a visa, or flights and hotels?");
}

function guessDept(t: string) {
  const s = t.toLowerCase();
  if (/عمرة|عمره|حج|umrah|hajj/.test(s)) return "RELIGIOUS";
  if (/فيزا|visa|سفارة/.test(s)) return "VISA";
  if (/شركة|موظفين|corporate|conference|مؤتمر/.test(s)) return "BTU";
  if (/nile|luxor|aswan|egypt tour|cairo tour/.test(s)) return "DMC";
  if (/طيران|تذكرة|flight|ticket/.test(s)) return "RESERVATIONS";
  return "OUTBOUND";
}
function pickDestination(msgs: string[]) {
  const known = /(مالديف|المالديف|maldives|دبي|dubai|تركيا|اسطنبول|istanbul|turkey|باريس|paris|بالي|bali|تايلاند|thailand|زنجبار|zanzibar|جورجيا|georgia|ايطاليا|إيطاليا|italy|اسبانيا|spain|شرم|الغردقة|sharm|hurghada)/i;
  for (const m of msgs) { const k = m.match(known)?.[0]; if (k) return k; }
  return null;
}
