import type { Lead, EnrichmentData } from "@/lib/types";

export type DifficultyLevel = "easy" | "medium" | "hard";

/**
 * Pure function — computes how hard it will be to close this lead.
 *
 * 🟢 Easy  — obvious digital gap, active small business, easy pitch
 * 🟡 Medium — some digital presence, mixed signals
 * 🔴 Hard  — established digital maturity, larger business, complex sale
 */
export function computeDifficulty(
  lead: Partial<Lead>,
  enrichment?: EnrichmentData | null
): DifficultyLevel {
  let easy = 0;
  let hard = 0;

  // ── Website ──────────────────────────────────────────────────────────────────
  if (!lead.has_website)                             easy += 3; // biggest signal
  else if (lead.website_quality === "poor")          easy += 2;
  else if (lead.website_quality === "needs_improvement") easy += 1;
  else if (lead.website_quality === "good")          hard += 2;

  // ── Enrichment signals ───────────────────────────────────────────────────────
  if (enrichment) {
    if (enrichment.digital_maturity === "none")      easy += 2;
    else if (enrichment.digital_maturity === "basic") easy += 1;
    else if (enrichment.digital_maturity === "established") hard += 2;

    if (enrichment.activity_level === "active")      easy += 1; // easier to reach
    else if (enrichment.activity_level === "low_activity") hard += 1;

    if (enrichment.business_size === "small")        easy += 1; // single decision-maker
    else if (enrichment.business_size === "medium")  hard += 1;

    if (enrichment.sells_online)                     hard += 1; // already digital-aware
  }

  if (easy >= 4) return "easy";
  if (hard >= 3) return "hard";
  return "medium";
}

export const DIFFICULTY_CONFIG: Record<DifficultyLevel, {
  emoji: string; label: string; textCls: string; bgCls: string; borderCls: string;
}> = {
  easy:   { emoji: "🟢", label: "Fácil",   textCls: "text-emerald-400", bgCls: "bg-emerald-950/40", borderCls: "border-emerald-800" },
  medium: { emoji: "🟡", label: "Medio",   textCls: "text-yellow-400",  bgCls: "bg-yellow-950/40",  borderCls: "border-yellow-800"  },
  hard:   { emoji: "🔴", label: "Difícil", textCls: "text-red-400",     bgCls: "bg-red-950/40",     borderCls: "border-red-800"     },
};
