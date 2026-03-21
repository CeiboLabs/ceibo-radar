import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const campaigns = db.prepare(`
    SELECT c.*, COUNT(cl.lead_id) as lead_count
    FROM campaigns c
    LEFT JOIN campaign_leads cl ON cl.campaign_id = c.id
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `).all();
  return NextResponse.json(campaigns);
}

export async function POST(req: NextRequest) {
  const { name, description, notes } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const db = getDb();
  const result = db.prepare(
    "INSERT INTO campaigns (name, description, notes) VALUES (?, ?, ?)"
  ).run(name.trim(), description ?? null, notes ?? null);

  const created = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(result.lastInsertRowid);
  return NextResponse.json(created, { status: 201 });
}
