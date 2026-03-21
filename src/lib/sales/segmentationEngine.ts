import type { Lead } from "@/lib/types";
import type { DifficultyLevel } from "./difficultyEngine";

export type SegmentTag =
  | "alto_potencial"   // High score/priority — strong lead
  | "alto_valor"       // High estimated contract value
  | "cierre_rapido"    // Easy difficulty + has contact + not contacted → quick win
  | "presencia_debil"  // No website or poor website (our core pitch)
  | "solo_instagram";  // Instagram-only business (specific pain point)

export const SEGMENT_LABELS: Record<SegmentTag, string> = {
  alto_potencial:  "Alto potencial",
  alto_valor:      "Alto valor",
  cierre_rapido:   "Cierre rápido",
  presencia_debil: "Presencia débil",
  solo_instagram:  "Solo Instagram",
};

export const SEGMENT_COLORS: Record<SegmentTag, string> = {
  alto_potencial:  "bg-red-950/60 border-red-800 text-red-300",
  alto_valor:      "bg-emerald-950/60 border-emerald-800 text-emerald-300",
  cierre_rapido:   "bg-ceibo-950 border-ceibo-800 text-ceibo-300",
  presencia_debil: "bg-orange-950/60 border-orange-800 text-orange-300",
  solo_instagram:  "bg-purple-950/60 border-purple-800 text-purple-300",
};

/** Pure function — assigns automatic segment tags to a lead. */
export function computeSegments(
  lead: Partial<Lead>,
  difficulty?: DifficultyLevel | null
): SegmentTag[] {
  const tags: SegmentTag[] = [];

  if (lead.lead_priority === "high" || (lead.lead_score ?? 0) >= 65) {
    tags.push("alto_potencial");
  }

  if (lead.estimated_value === "high" || lead.ai_premium_tier === "$$$") {
    tags.push("alto_valor");
  }

  if (
    difficulty === "easy" &&
    (lead.phone || lead.email) &&
    lead.status === "not_contacted"
  ) {
    tags.push("cierre_rapido");
  }

  if (!lead.has_website || lead.website_quality === "poor") {
    tags.push("presencia_debil");
  }

  if (lead.platform === "instagram" && !lead.has_website) {
    tags.push("solo_instagram");
  }

  return tags;
}
