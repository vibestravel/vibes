// Contract between Vibes AI and FlexiVi. Mirrors docs/FLEXIVI_API_SPEC.md — keep both in sync.

export type DataSource = "LIVE" | "MOCK";

export interface Envelope<T> {
  data: T;
  source: DataSource;          // MOCK responses must never reach a real customer
  verifiedAt: string;          // ISO time FlexiVi last verified this data
  fetchedAt: string;           // ISO time Vibes AI received it
}

export interface Destination { code: string; nameAr: string; nameEn: string; categories: string[] }
export interface VisaCategory { code: string; nameAr: string; nameEn: string }
export interface ApplicationCenter {
  id: string; destinationCode: string; name: string; city: string; address: string; provider?: string;
}
export interface Requirement {
  id: string; titleAr: string; titleEn: string; mandatory: boolean; notes?: string;
}
export interface RequirementSet {
  destinationCode: string; category: string; nationality: string; residence: string;
  requirements: Requirement[]; effectiveFrom: string; sourceName?: string; sourceUrl?: string;
}
export interface Slot { date: string; slotsLeft?: number | null }
export interface Availability {
  destinationCode: string; category: string; centerId: string;
  earliestDate: string | null; slots: Slot[];
}
export interface Fees {
  destinationCode: string; category: string;
  officialFee: { amount: number; currency: string } | null;
  serviceFee: { amount: number; currency: string } | null;
  centerFee: { amount: number; currency: string } | null;
  processingDays: { min: number; max: number } | null;
}

export interface FlexiViClient {
  readonly mode: DataSource;
  health(): Promise<{ ok: boolean; latencyMs: number; error?: string }>;
  listDestinations(): Promise<Envelope<Destination[]>>;
  listCategories(destinationCode: string): Promise<Envelope<VisaCategory[]>>;
  listCenters(destinationCode: string, city?: string): Promise<Envelope<ApplicationCenter[]>>;
  getRequirements(q: { destination: string; category: string; nationality: string; residence: string }): Promise<Envelope<RequirementSet>>;
  getAvailability(q: { destination: string; category: string; centerId?: string; city?: string }): Promise<Envelope<Availability[]>>;
  getFees(q: { destination: string; category: string }): Promise<Envelope<Fees>>;
}

export class FlexiViError extends Error {
  constructor(message: string, public readonly code: "UNAVAILABLE" | "NOT_FOUND" | "AUTH" | "RATE_LIMIT" | "BAD_RESPONSE") {
    super(message);
  }
}
