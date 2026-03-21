import type { Lead } from "@/lib/types";
import { computeDailyRank } from "./dailyRankingEngine";
import { getNextAction, type NextAction } from "./nextActionEngine";

export interface DailyLead extends Lead {
  daily_rank: number;
  next_action: NextAction;
}

export interface DailySection {
  id: string;
  title: string;
  leads: DailyLead[];
}

/**
 * Pure function — groups and sorts leads into priority sections for the daily work list.
 * Excludes closed leads (sequence_stage === "done").
 */
export function buildDailyList(leads: Lead[]): DailySection[] {
  const now = Date.now();

  const enriched: DailyLead[] = leads
    .filter((l) => l.sequence_stage !== "done")
    .map((l) => ({
      ...l,
      daily_rank: computeDailyRank(l),
      next_action: getNextAction(l),
    }));

  // ── Section 1: Urgent ────────────────────────────────────────────────────────
  // Overdue followups + interested leads (about to close)
  const urgent = enriched.filter((l) => {
    if (l.next_followup_at && new Date(l.next_followup_at).getTime() < now) return true;
    if (l.status === "interested") return true;
    return false;
  }).sort((a, b) => b.daily_rank - a.daily_rank);

  const urgentIds = new Set(urgent.map((l) => l.id));

  // ── Section 2: Followups due today / next 3 days ─────────────────────────────
  const followups = enriched.filter((l) => {
    if (urgentIds.has(l.id)) return false;
    if (l.status === "contacted") return true;
    if (l.next_followup_at) {
      const diffDays =
        (new Date(l.next_followup_at).getTime() - now) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 3;
    }
    return false;
  }).sort((a, b) => b.daily_rank - a.daily_rank);

  const followupIds = new Set(followups.map((l) => l.id));

  // ── Section 3: Hot new leads (not contacted) ─────────────────────────────────
  const newHot = enriched.filter((l) => {
    if (urgentIds.has(l.id) || followupIds.has(l.id)) return false;
    return l.is_hot && l.status === "not_contacted";
  }).sort((a, b) => b.daily_rank - a.daily_rank);

  const hotIds = new Set(newHot.map((l) => l.id));

  // ── Section 4: Top ranked (remaining, best 10) ───────────────────────────────
  const topRanked = enriched
    .filter(
      (l) =>
        !urgentIds.has(l.id) &&
        !followupIds.has(l.id) &&
        !hotIds.has(l.id)
    )
    .sort((a, b) => b.daily_rank - a.daily_rank)
    .slice(0, 10);

  const sections: DailySection[] = [];
  if (urgent.length)    sections.push({ id: "urgent",     title: "⚠️ Urgente",          leads: urgent });
  if (followups.length) sections.push({ id: "followups",  title: "↩️ Seguimientos",     leads: followups });
  if (newHot.length)    sections.push({ id: "new_hot",    title: "🔥 Hot Leads",         leads: newHot });
  if (topRanked.length) sections.push({ id: "top_ranked", title: "⭐ Top del Día",       leads: topRanked });

  return sections;
}
