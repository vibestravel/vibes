// OPTIONAL demo content for local testing ONLY. Never run against production.
// Everything here is clearly labelled [عينة تجريبية] and is not a real offer.
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, like } from "drizzle-orm";
import * as s from "../src/db/schema";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("refusing to seed demo data in production");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema: s });
  const [d] = await db.select().from(s.departments).where(eq(s.departments.key, "OUTBOUND"));
  await db.delete(s.packages).where(like(s.packages.name, "[عينة تجريبية]%"));
  await db.insert(s.packages).values({
    departmentId: d.id, name: "[عينة تجريبية] المالديف شهر عسل", destination: "المالديف", country: "Maldives",
    travelDates: "ديسمبر 2026", nights: 5, days: 6, mealPlan: "DEMO", status: "APPROVED", extractedBy: "manual",
    prices: [{ label: "DEMO — ليس سعرًا حقيقيًا", occupancy: "double", amount: 0, currency: "EGP" }],
    approvedAt: new Date(),
  });
  await db.insert(s.knowledgeEntries).values({ title: "[عينة تجريبية] مواعيد العمل", content: "DEMO — اكتب مواعيد العمل الحقيقية من قاعدة المعرفة.", approved: true }).onConflictDoNothing();
  await pool.end();
  console.log("Demo content inserted (clearly labelled).");
}
main().catch((e) => { console.error(e); process.exit(1); });
