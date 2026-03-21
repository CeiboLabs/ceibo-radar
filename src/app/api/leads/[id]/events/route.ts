import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

interface TimelineEvent {
  id: string;
  event_type: string;
  description: string;
  created_at: string;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  // General lead events
  const events = db
    .prepare(
      "SELECT id, event_type, description, created_at FROM lead_events WHERE lead_id = ? ORDER BY created_at DESC"
    )
    .all(Number(id)) as { id: number; event_type: string; description: string; created_at: string }[];

  // Contact log entries — mapped to timeline events
  const contacts = db
    .prepare(
      "SELECT id, channel, created_at FROM contact_log WHERE lead_id = ? ORDER BY created_at DESC"
    )
    .all(Number(id)) as { id: number; channel: string; created_at: string }[];

  const contactEvents: TimelineEvent[] = contacts.map((c) => ({
    id: `contact_${c.id}`,
    event_type: `contacted_${c.channel}`,
    description: `Contactado por ${c.channel === "whatsapp" ? "WhatsApp" : "Email"}`,
    created_at: c.created_at,
  }));

  // Synthetic "created" event from the lead itself
  const lead = db
    .prepare("SELECT created_at FROM leads WHERE id = ?")
    .get(Number(id)) as { created_at: string } | undefined;

  const all: TimelineEvent[] = [
    ...events.map((e) => ({ ...e, id: String(e.id) })),
    ...contactEvents,
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));

  // Always append synthetic created event at the end (oldest)
  if (lead) {
    all.push({
      id: "created",
      event_type: "created",
      description: "Lead creado",
      created_at: lead.created_at,
    });
  }

  return NextResponse.json(all);
}
