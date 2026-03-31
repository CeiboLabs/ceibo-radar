import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { leadIds } = (await req.json()) as { leadIds: number[] };
  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return NextResponse.json({ error: "leadIds required" }, { status: 400 });
  }

  const rows = leadIds.map((leadId) => ({ campaign_id: Number(id), lead_id: leadId }));
  const { error } = await supabase
    .from("campaign_leads")
    .upsert(rows, { onConflict: "campaign_id,lead_id", ignoreDuplicates: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, added: leadIds.length });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { leadId } = (await req.json()) as { leadId: number };

  const { error } = await supabase
    .from("campaign_leads")
    .delete()
    .eq("campaign_id", id)
    .eq("lead_id", leadId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
