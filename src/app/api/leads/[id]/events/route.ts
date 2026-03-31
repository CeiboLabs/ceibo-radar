import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

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

  const [
    { data: events },
    { data: contacts },
    { data: lead },
  ] = await Promise.all([
    supabase
      .from("lead_events")
      .select("id, event_type, description, created_at")
      .eq("lead_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("contact_log")
      .select("id, channel, created_at")
      .eq("lead_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("leads")
      .select("created_at")
      .eq("id", id)
      .single(),
  ]);

  const contactEvents: TimelineEvent[] = (contacts ?? []).map((c) => ({
    id: `contact_${c.id}`,
    event_type: `contacted_${c.channel}`,
    description: `Contactado por ${c.channel === "whatsapp" ? "WhatsApp" : "Email"}`,
    created_at: c.created_at,
  }));

  const all: TimelineEvent[] = [
    ...(events ?? []).map((e) => ({ ...e, id: String(e.id) })),
    ...contactEvents,
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));

  if (lead) {
    all.push({ id: "created", event_type: "created", description: "Lead creado", created_at: lead.created_at });
  }

  return NextResponse.json(all);
}
