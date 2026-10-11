// Server-side client for the real FlexiVi API. Endpoints follow docs/FLEXIVI_API_SPEC.md and are
// NOT assumed to exist until the FlexiVi team confirms them and "Test connection" succeeds.
import "server-only";
import { createHmac } from "node:crypto";
import type { FlexiViClient, Envelope } from "./types";
import { FlexiViError } from "./types";

type Cfg = { baseUrl: string; apiKey: string; hmacSecret?: string; timeoutMs?: number };

// simple in-process token bucket: 5 req/s burst 10
let tokens = 10, last = Date.now();
function takeToken() {
  const n = Date.now(); tokens = Math.min(10, tokens + ((n - last) / 1000) * 5); last = n;
  if (tokens < 1) throw new FlexiViError("rate limited locally", "RATE_LIMIT");
  tokens -= 1;
}

export class LiveFlexiVi implements FlexiViClient {
  readonly mode = "LIVE" as const;
  constructor(private cfg: Cfg) {}

  private async get<T>(path: string, query: Record<string, string | undefined> = {}): Promise<Envelope<T>> {
    takeToken();
    const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v) as [string, string][]).toString();
    const fullPath = `/v1${path}${qs ? `?${qs}` : ""}`;
    const ts = Math.floor(Date.now() / 1000).toString();
    const headers: Record<string, string> = { Authorization: `Bearer ${this.cfg.apiKey}`, Accept: "application/json", "X-Vibes-Timestamp": ts };
    if (this.cfg.hmacSecret) headers["X-Vibes-Signature"] = createHmac("sha256", this.cfg.hmacSecret).update(`${ts}.GET.${fullPath}`).digest("hex");

    for (let attempt = 0; attempt < 2; attempt++) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), this.cfg.timeoutMs ?? 8000);
      try {
        const res = await fetch(this.cfg.baseUrl.replace(/\/$/, "") + fullPath, { headers, signal: ctrl.signal, cache: "no-store" });
        if (res.status === 401 || res.status === 403) throw new FlexiViError("auth failed", "AUTH");
        if (res.status === 404) throw new FlexiViError("not found", "NOT_FOUND");
        if (res.status === 429) throw new FlexiViError("rate limited", "RATE_LIMIT");
        if (res.status >= 500) { if (attempt === 0) continue; throw new FlexiViError(`server ${res.status}`, "UNAVAILABLE"); }
        const body = await res.json();
        if (!body || typeof body !== "object" || !("data" in body) || !body.verified_at) throw new FlexiViError("missing data/verified_at", "BAD_RESPONSE");
        return { data: body.data as T, source: "LIVE", verifiedAt: body.verified_at, fetchedAt: new Date().toISOString() };
      } catch (e) {
        if (e instanceof FlexiViError) throw e;
        if (attempt === 0) continue;
        throw new FlexiViError(e instanceof Error ? e.message : "network error", "UNAVAILABLE");
      } finally { clearTimeout(t); }
    }
    throw new FlexiViError("unreachable", "UNAVAILABLE");
  }

  async health() {
    const t = Date.now();
    try { await this.get("/health"); return { ok: true, latencyMs: Date.now() - t }; }
    catch (e) { return { ok: false, latencyMs: Date.now() - t, error: (e as Error).message }; }
  }
  listDestinations() { return this.get<import("./types").Destination[]>("/destinations"); }
  listCategories(code: string) { return this.get<import("./types").VisaCategory[]>(`/destinations/${encodeURIComponent(code)}/categories`); }
  listCenters(code: string, city?: string) { return this.get<import("./types").ApplicationCenter[]>(`/destinations/${encodeURIComponent(code)}/centers`, { city }); }
  getRequirements(q: { destination: string; category: string; nationality: string; residence: string }) {
    return this.get<import("./types").RequirementSet>("/requirements", q);
  }
  getAvailability(q: { destination: string; category: string; centerId?: string; city?: string }) {
    return this.get<import("./types").Availability[]>("/availability", { destination: q.destination, category: q.category, center_id: q.centerId, city: q.city });
  }
  getFees(q: { destination: string; category: string }) { return this.get<import("./types").Fees>("/fees", q); }
}
