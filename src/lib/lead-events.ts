import { getDb } from "./db";

export type EventType =
  | "status_changed"
  | "note_added"
  | "tag_added"
  | "tag_removed"
  | "ai_analyzed"
  | "favorited"
  | "unfavorited";

export function logEvent(
  leadId: number,
  eventType: EventType,
  description: string
): void {
  try {
    const db = getDb();
    db.prepare(
      "INSERT INTO lead_events (lead_id, event_type, description) VALUES (?, ?, ?)"
    ).run(leadId, eventType, description);
  } catch {
    // Non-fatal — never break the main action because of event logging
  }
}
