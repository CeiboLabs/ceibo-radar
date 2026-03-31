import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { enabled, name, schedule, last_run_at, leads_found_last } = await req.json();

  const update: Record<string, unknown> = {};
  if (enabled !== undefined)          update.enabled = Boolean(enabled);
  if (name !== undefined)             update.name = name;
  if (schedule !== undefined)         update.schedule = schedule;
  if (last_run_at !== undefined)      update.last_run_at = last_run_at;
  if (leads_found_last !== undefined) update.leads_found_last = leads_found_last;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("scraping_jobs")
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
  const { error } = await supabase.from("scraping_jobs").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
