// Serves an approved package document via a signed, expiring link (sent to customers or opened by staff).
import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { verifyDocToken } from "@/lib/channels";
import { storageDir } from "@/lib/packages/ingest";

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const id = await verifyDocToken(token);
  if (!id) return new Response("Link expired", { status: 410 });
  const [doc] = await db.select().from(documents).where(eq(documents.id, id));
  if (!doc) return new Response("Not found", { status: 404 });
  const full = path.resolve(storageDir(), doc.storagePath);
  if (!full.startsWith(storageDir() + path.sep)) return new Response("Forbidden", { status: 403 });
  const buf = await readFile(full);
  return new Response(new Uint8Array(buf), {
    headers: { "Content-Type": doc.mimeType, "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
