import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  // Get campaigns with lead count
  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select("*, campaign_leads(count)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Normalize lead_count from nested count object
  const normalized = (campaigns ?? []).map((c) => ({
    ...c,
    lead_count: (c.campaign_leads as unknown as { count: number }[])?.[0]?.count ?? 0,
    campaign_leads: undefined,
  }));

  return NextResponse.json(normalized);
}

export async function POST(req: NextRequest) {
  const { name, description, notes } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("campaigns")
    .insert({ name: name.trim(), description: description ?? null, notes: notes ?? null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
