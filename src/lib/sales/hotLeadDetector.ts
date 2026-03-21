import type { Lead } from "@/lib/types";

/**
 * Pure function — no side effects.
 * Returns true when a lead is worth immediate outreach:
 *   - High priority OR score ≥ 60
 *   - No website or poor website (digital gap we can fill)
 *   - Has at least one contact channel
 *   - Not closed (sequence_stage !== "done")
 */
export function isHotLead(lead: Partial<Lead>): boolean {
  if (lead.sequence_stage === "done") return false;

  const highValue =
    lead.lead_priority === "high" || (lead.lead_score ?? 0) >= 60;

  const digitalGap =
    !lead.has_website ||
    lead.website_quality === "poor" ||
    lead.website_quality === "needs_improvement";

  const hasContact = Boolean(lead.phone || lead.email);

  return highValue && digitalGap && hasContact;
}
