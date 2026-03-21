import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// GET /api/leads/[id]/campaigns — campaigns this lead belongs to
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const rows = db.prepare(`
    SELECT c.* FROM campaigns c
    JOIN campaign_leads cl ON cl.campaign_id = c.id
    WHERE cl.lead_id = ?
    ORDER BY c.name
  `).all(id);
  return NextResponse.json(rows);
}
