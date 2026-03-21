import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// POST /api/campaigns/[id]/leads  — body: { leadIds: number[] }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { leadIds } = await req.json() as { leadIds: number[] };
  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return NextResponse.json({ error: "leadIds required" }, { status: 400 });
  }
  const db = getDb();
  const stmt = db.prepare(
    "INSERT OR IGNORE INTO campaign_leads (campaign_id, lead_id) VALUES (?, ?)"
  );
  for (const leadId of leadIds) {
    stmt.run(id, leadId);
  }
  return NextResponse.json({ success: true, added: leadIds.length });
}

// DELETE /api/campaigns/[id]/leads  — body: { leadId: number }
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { leadId } = await req.json() as { leadId: number };
  getDb().prepare(
    "DELETE FROM campaign_leads WHERE campaign_id = ? AND lead_id = ?"
  ).run(id, leadId);
  return NextResponse.json({ success: true });
}
