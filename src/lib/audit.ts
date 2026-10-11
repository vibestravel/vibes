import { db } from "@/db";
import { auditLogs } from "@/db/schema";

export async function audit(entry: {
  actorId?: string | null;
  actorType: "USER" | "AI" | "SYSTEM";
  action: string;
  entity?: string;
  entityId?: string;
  details?: unknown;
}) {
  try {
    await db.insert(auditLogs).values({ ...entry, details: entry.details ?? null });
  } catch (e) {
    console.error("audit log failed", e);
  }
}
