import "server-only";
import { MockFlexiVi } from "./mock";
import { LiveFlexiVi } from "./live";
import type { FlexiViClient } from "./types";

export * from "./types";

export function flexiviMode(): "mock" | "live" | "not_configured" {
  const m = (process.env.FLEXIVI_MODE ?? "mock").toLowerCase();
  if (m === "live") return process.env.FLEXIVI_BASE_URL && process.env.FLEXIVI_API_KEY ? "live" : "not_configured";
  return "mock";
}

export function getFlexiVi(): FlexiViClient | null {
  const m = flexiviMode();
  if (m === "live") return new LiveFlexiVi({ baseUrl: process.env.FLEXIVI_BASE_URL!, apiKey: process.env.FLEXIVI_API_KEY!, hmacSecret: process.env.FLEXIVI_HMAC_SECRET || undefined });
  if (m === "mock") return new MockFlexiVi();
  return null;
}

/** Availability older than this is treated as not live and must not be presented as current. */
export function availabilityMaxAgeMin() {
  return Number(process.env.FLEXIVI_AVAILABILITY_MAX_AGE_MIN ?? 30);
}

export function isFresh(verifiedAt: string, maxAgeMin = availabilityMaxAgeMin()) {
  const t = Date.parse(verifiedAt);
  return Number.isFinite(t) && Date.now() - t <= maxAgeMin * 60_000;
}
