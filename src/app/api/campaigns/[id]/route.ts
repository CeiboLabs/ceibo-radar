import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [{ data: campaign, error }, { data: leads }] = await Promise.all([
    supabase.from("campaigns").select("*").eq("id", id).single(),
    supabase
      .from("leads")
      .select("leads!inner(*)")
      .eq("campaign_leads.campaign_id" as never, id)
      .order("lead_score", { ascending: false, nullsFirst: false }),
  ]);

  if (error || !campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fetch leads via campaign_leads join
  const { data: campaignLeads } = await supabase
    .from("campaign_leads")
    .select("leads(*)")
    .eq("campaign_id", id);

  const leadsData = ((campaignLeads ?? []) as { leads: { lead_score?: number } | null }[])
    .map((r) => r.leads)
    .filter(Boolean)
    .sort((a, b) => ((b?.lead_score ?? 0) - (a?.lead_score ?? 0)));

  return NextResponse.json({ campaign, leads: leadsData });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { name, description, status, notes } = await req.json();

  const update: Record<string, unknown> = {};
  if (name !== undefined)        update.name = name;
  if (description !== undefined) update.description = description;
  if (status !== undefined)      update.status = status;
  if (notes !== undefined)       update.notes = notes;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("campaigns")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error } = await supabase.from("campaigns").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
