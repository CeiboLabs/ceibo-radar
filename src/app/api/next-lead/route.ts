import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getNextLead } from "@/lib/sales/nextLeadEngine";
import type { Lead } from "@/lib/types";

export async function GET(req: NextRequest) {
  const excludeId = req.nextUrl.searchParams.get("exclude_id");
  const db = getDb();

  const leads = db
    .prepare(
      "SELECT * FROM leads WHERE sequence_stage IS NULL OR sequence_stage != 'done'"
    )
    .all() as Lead[];

  const next = getNextLead(leads, excludeId ? Number(excludeId) : undefined);
  return NextResponse.json({ lead: next ?? null });
}
