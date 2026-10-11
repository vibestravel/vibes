// ⚠️ DEMO DATA — NOT REAL. Used only until the real FlexiVi API is connected.
// Every response is tagged source:"MOCK". The AI engine refuses to show MOCK data to real customers.
import type { FlexiViClient, Envelope } from "./types";
import { FlexiViError } from "./types";

const now = () => new Date().toISOString();
const daysFromNow = (d: number) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
const wrap = <T,>(data: T): Envelope<T> => ({ data, source: "MOCK", verifiedAt: now(), fetchedAt: now() });

const DESTS = [
  { code: "DE", nameAr: "ألمانيا (تجريبي)", nameEn: "Germany (demo)", categories: ["TOURISM", "BUSINESS"] },
  { code: "FR", nameAr: "فرنسا (تجريبي)", nameEn: "France (demo)", categories: ["TOURISM", "BUSINESS"] },
  { code: "IT", nameAr: "إيطاليا (تجريبي)", nameEn: "Italy (demo)", categories: ["TOURISM"] },
];

export class MockFlexiVi implements FlexiViClient {
  readonly mode = "MOCK" as const;
  async health() { return { ok: true, latencyMs: 1 }; }
  async listDestinations() { return wrap(DESTS); }
  async listCategories(code: string) {
    const d = DESTS.find((x) => x.code === code.toUpperCase());
    if (!d) throw new FlexiViError("destination not supported", "NOT_FOUND");
    return wrap(d.categories.map((c) => ({ code: c, nameAr: c === "TOURISM" ? "سياحة" : "بيزنس", nameEn: c })));
  }
  async listCenters(code: string) {
    return wrap([{ id: `${code}-CAI`, destinationCode: code, name: `DEMO center ${code}`, city: "Cairo", address: "DEMO address — not real" }]);
  }
  async getRequirements(q: { destination: string; category: string; nationality: string; residence: string }) {
    return wrap({
      destinationCode: q.destination, category: q.category, nationality: q.nationality, residence: q.residence,
      requirements: [
        { id: "r1", titleAr: "[تجريبي] جواز سفر ساري", titleEn: "[DEMO] Valid passport", mandatory: true },
        { id: "r2", titleAr: "[تجريبي] كشف حساب بنكي", titleEn: "[DEMO] Bank statement", mandatory: true },
      ],
      effectiveFrom: daysFromNow(-30), sourceName: "DEMO", sourceUrl: undefined,
    });
  }
  async getAvailability(q: { destination: string; category: string }) {
    return wrap([{
      destinationCode: q.destination, category: q.category, centerId: `${q.destination}-CAI`,
      earliestDate: daysFromNow(12), slots: [{ date: daysFromNow(12), slotsLeft: 3 }, { date: daysFromNow(15), slotsLeft: 5 }],
    }]);
  }
  async getFees(q: { destination: string; category: string }) {
    return wrap({ destinationCode: q.destination, category: q.category, officialFee: null, serviceFee: null, centerFee: null, processingDays: null });
  }
}
