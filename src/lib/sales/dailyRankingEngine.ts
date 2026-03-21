import type { Lead } from "@/lib/types";

/**
 * Pure function — returns a composite daily rank score (higher = more urgent to act on today).
 * Range: roughly 0–120.
 */
export function computeDailyRank(lead: Lead): number {
  let score = 0;

  // Base lead score (0-100), weighted 40 %
  score += (lead.lead_score ?? 0) * 0.4;

  // Priority bonus
  if (lead.lead_priority === "high") score += 20;
  else if (lead.lead_priority === "medium") score += 10;

  // Hot lead bonus
  if (lead.is_hot) score += 15;

  // Favorites float up slightly
  if (lead.is_favorite) score += 5;

  // Overdue / due-today followups float way up
  const now = Date.now();
  if (lead.next_followup_at) {
    const followupMs = new Date(lead.next_followup_at).getTime();
    const diffDays = (followupMs - now) / (1000 * 60 * 60 * 24);
    if (diffDays < 0) score += 20;       // overdue
    else if (diffDays < 1) score += 15;  // due today
    else if (diffDays < 3) score += 8;   // due in 3 days
  }

  // Interested leads are closest to closing
  if (lead.status === "interested") score += 10;
  else if (lead.status === "contacted") score += 5;

  // AI premium tier hints
  if (lead.ai_premium_tier === "$$$") score += 8;
  else if (lead.ai_premium_tier === "$$") score += 4;

  // Estimated value
  if (lead.estimated_value === "high") score += 6;
  else if (lead.estimated_value === "medium") score += 3;

  return Math.round(score);
}
