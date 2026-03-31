import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { buildDailyList } from "@/lib/sales/dailyListEngine";
import type { Lead } from "@/lib/types";

export async function GET() {
  const { data: leads } = await supabase
    .from("leads")
    .select("*")
    .neq("sequence_stage", "done")
    .order("lead_score", { ascending: false, nullsFirst: false });

  const sections = buildDailyList((leads ?? []) as unknown as Lead[]);
  return NextResponse.json({ sections, generated_at: new Date().toISOString() });
}
