import type { Tone } from "@/components/ui";
export const STATUS: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: "مسودة", tone: "gray" }, REVIEW: { label: "محتاج مراجعة", tone: "amber" }, APPROVED: { label: "معتمد", tone: "green" }, ARCHIVED: { label: "مؤرشف", tone: "gray" },
};
