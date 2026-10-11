// Lead scoring. Points are configurable here; total is capped at 100.
export const SCORE_RULES = {
  destination: 15,
  travelDate: 15,
  travelers: 10,
  budget: 15,
  phone: 20,
  name: 5,
  readyToBook: 20,
} as const;

export function scoreLead(l: {
  destination?: string | null; travelDate?: string | null; travelers?: number | null; budget?: string | null;
  phone?: string | null; name?: string | null; readyToBook?: boolean;
}) {
  let s = 0;
  for (const [k, pts] of Object.entries(SCORE_RULES)) if ((l as Record<string, unknown>)[k]) s += pts;
  return Math.min(100, s);
}
