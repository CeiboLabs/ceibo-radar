import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Get campaigns this lead belongs to via join
  const { data, error } = await supabase
    .from("campaign_leads")
    .select("campaigns(*)")
    .eq("lead_id", id)
    .order("campaigns(name)" as never);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const campaigns = (data ?? []).map((r: Record<string, unknown>) => r.campaigns).filter(Boolean);
  return NextResponse.json(campaigns);
}
