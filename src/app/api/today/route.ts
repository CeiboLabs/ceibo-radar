import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { buildDailyList } from "@/lib/sales/dailyListEngine";
import type { Lead } from "@/lib/types";

export async function GET() {
  const db = getDb();
  // Exclude permanently closed leads
  const leads = db
    .prepare(
      "SELECT * FROM leads WHERE sequence_stage IS NULL OR sequence_stage != 'done' ORDER BY lead_score DESC NULLS LAST"
    )
    .all() as Lead[];

  const sections = buildDailyList(leads);
  return NextResponse.json({ sections, generated_at: new Date().toISOString() });
}
