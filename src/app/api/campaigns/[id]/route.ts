import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { Lead } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(id);
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const leads = db.prepare(`
    SELECT l.* FROM leads l
    JOIN campaign_leads cl ON cl.lead_id = l.id
    WHERE cl.campaign_id = ?
    ORDER BY l.lead_score DESC NULLS LAST
  `).all(id) as Lead[];

  return NextResponse.json({ campaign, leads });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { name, description, status, notes } = await req.json();
  const db = getDb();
  const fields: string[] = [];
  const values: (string | number)[] = [];

  if (name !== undefined) { fields.push("name = ?"); values.push(name); }
  if (description !== undefined) { fields.push("description = ?"); values.push(description); }
  if (status !== undefined) { fields.push("status = ?"); values.push(status); }
  if (notes !== undefined) { fields.push("notes = ?"); values.push(notes); }

  if (fields.length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE campaigns SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  const updated = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(id);
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  getDb().prepare("DELETE FROM campaigns WHERE id = ?").run(id);
  return NextResponse.json({ success: true });
}
