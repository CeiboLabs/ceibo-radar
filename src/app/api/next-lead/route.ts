import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getNextLead } from "@/lib/sales/nextLeadEngine";
import type { Lead } from "@/lib/types";

export async function GET(req: NextRequest) {
  const excludeId = req.nextUrl.searchParams.get("exclude_id");

  const { data: leads } = await supabase
    .from("leads")
    .select("*")
    .neq("sequence_stage", "done");

  const next = getNextLead(
    (leads ?? []) as unknown as Lead[],
    excludeId ? Number(excludeId) : undefined
  );
  return NextResponse.json({ lead: next ?? null });
}
