import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { buildWhatsAppAction, buildEmailAction } from "@/lib/contact-actions";
import type { Lead, ContactLog } from "@/lib/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { channel } = await req.json();

  if (channel !== "whatsapp" && channel !== "email") {
    return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
  }

  const { data: lead, error } = await supabase.from("leads").select("*").eq("id", id).single();
  if (error || !lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const action =
    channel === "whatsapp" ? buildWhatsAppAction(lead as Lead) : buildEmailAction(lead as Lead);

  if (!action) {
    return NextResponse.json({ error: "No contact info for this channel" }, { status: 400 });
  }

  await supabase.from("contact_log").insert({
    lead_id: lead.id,
    channel,
    message_preview: action.message_preview,
  });

  if (lead.status === "not_contacted") {
    await supabase.from("leads").update({ status: "contacted" }).eq("id", lead.id);
  }

  const [{ data: updatedLead }, { data: logs }] = await Promise.all([
    supabase.from("leads").select("*").eq("id", id).single(),
    supabase.from("contact_log").select("*").eq("lead_id", lead.id).order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({ url: action.url, updated_lead: updatedLead, logs: logs ?? [] });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { data: logs } = await supabase
    .from("contact_log")
    .select("*")
    .eq("lead_id", id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ logs: (logs ?? []) as ContactLog[] });
}
