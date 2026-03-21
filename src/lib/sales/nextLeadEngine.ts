import type { Lead } from "@/lib/types";
import { computeDailyRank } from "./dailyRankingEngine";

/**
 * Pure function — given a list of leads, returns the single best lead to
 * contact next (excluding an optional current lead ID).
 *
 * Ties broken by: difficulty easy > medium > hard, then has_contact.
 */
export function getNextLead(leads: Lead[], excludeId?: number): Lead | null {
  const DIFF_ORDER: Record<string, number> = { easy: 3, medium: 2, hard: 1 };

  const candidates = leads
    .filter((l) => l.sequence_stage !== "done")
    .filter((l) => l.id !== excludeId);

  if (candidates.length === 0) return null;

  const scored = candidates.map((l) => ({
    lead: l,
    rank: computeDailyRank(l),
    diffScore: DIFF_ORDER[l.difficulty_level ?? "medium"] ?? 2,
    hasContact: l.phone || l.email ? 1 : 0,
  }));

  scored.sort((a, b) => {
    if (b.rank !== a.rank) return b.rank - a.rank;
    if (b.diffScore !== a.diffScore) return b.diffScore - a.diffScore;
    return b.hasContact - a.hasContact;
  });

  return scored[0]?.lead ?? null;
}
