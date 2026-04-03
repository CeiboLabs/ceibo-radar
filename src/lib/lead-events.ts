import { supabase } from "./supabase";

export type EventType =
  | "status_changed"
  | "note_added"
  | "tag_added"
  | "tag_removed"
  | "ai_analyzed"
  | "favorited"
  | "unfavorited"
  | "score_recalculated";

/** Fire-and-forget event logger — never throws */
export function logEvent(
  leadId: number,
  eventType: EventType,
  description: string
): void {
  supabase
    .from("lead_events")
    .insert({ lead_id: leadId, event_type: eventType, description })
    .then();
}
