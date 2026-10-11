// Base data: departments, pipeline stages, AI settings, integration rows, first CEO account.
// Idempotent — safe to run more than once. Creates NO customers, packages or prices.
import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import * as s from "../src/db/schema";
import { DEFAULT_SETTINGS } from "../src/lib/ai/settings";

const DEPARTMENTS = [
  ["OUTBOUND", "السياحة الخارجية", "Outbound Tourism"],
  ["VISA", "قسم الفيزا", "Visa Department"],
  ["RELIGIOUS", "السياحة الدينية", "Religious Tourism"],
  ["BTU", "سفر الشركات", "Business Travel Unit"],
  ["DMC", "السياحة الوافدة", "DMC / Inbound"],
  ["RESERVATIONS", "حجوزات الطيران والفنادق", "Flight & Hotel Reservations"],
];
const STAGES = [
  ["NEW", "عميل جديد"], ["AI_QUALIFICATION", "تأهيل بالذكاء الاصطناعي"], ["QUALIFIED", "مؤهل"], ["ASSIGNED", "متحوّل لموظف"],
  ["QUOTATION_SENT", "تم إرسال عرض سعر"], ["FOLLOW_UP", "متابعة"], ["WON", "تم البيع"], ["LOST", "مفقود"],
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema: s });

  for (const [key, nameAr, nameEn] of DEPARTMENTS) await db.insert(s.departments).values({ key, nameAr, nameEn }).onConflictDoNothing();
  for (const [i, [key, name]] of STAGES.entries())
    await db.insert(s.pipelineStages).values({ key, name, order: i, isWon: key === "WON", isLost: key === "LOST" }).onConflictDoNothing();
  for (const id of ["draft", "published"]) await db.insert(s.aiSettings).values({ id, ...DEFAULT_SETTINGS, publishedAt: id === "published" ? new Date() : null }).onConflictDoNothing();
  for (const key of ["ANTHROPIC", "FLEXIVI", "META", "WHATSAPP", "ZOHO"]) await db.insert(s.integrations).values({ key }).onConflictDoNothing();

  const email = (process.env.SEED_ADMIN_EMAIL || "m.farid@vibestraveleg.com").toLowerCase();
  const [exists] = await db.select().from(s.users).where(eq(s.users.email, email));
  if (!exists) {
    const password = process.env.SEED_ADMIN_PASSWORD || randomBytes(9).toString("base64url");
    await db.insert(s.users).values({ email, name: process.env.SEED_ADMIN_NAME || "Mohamed Farid", role: "CEO", passwordHash: await bcrypt.hash(password, 12) });
    console.log(`\nCEO account created:\n  email:    ${email}\n  password: ${process.env.SEED_ADMIN_PASSWORD ? "(from SEED_ADMIN_PASSWORD)" : password}\nChange it after first login.\n`);
  }
  await pool.end();
  console.log("Seed complete.");
}
main().catch((e) => { console.error(e); process.exit(1); });
