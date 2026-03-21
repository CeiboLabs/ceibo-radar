import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { enabled, name, schedule, last_run_at, leads_found_last } = await req.json();
  const db = getDb();
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (enabled !== undefined) { fields.push("enabled = ?"); values.push(enabled ? 1 : 0); }
  if (name !== undefined) { fields.push("name = ?"); values.push(name); }
  if (schedule !== undefined) { fields.push("schedule = ?"); values.push(schedule); }
  if (last_run_at !== undefined) { fields.push("last_run_at = ?"); values.push(last_run_at); }
  if (leads_found_last !== undefined) { fields.push("leads_found_last = ?"); values.push(leads_found_last); }

  if (fields.length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  values.push(id);
  db.prepare(`UPDATE scraping_jobs SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return NextResponse.json(db.prepare("SELECT * FROM scraping_jobs WHERE id = ?").get(id));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  getDb().prepare("DELETE FROM scraping_jobs WHERE id = ?").run(id);
  return NextResponse.json({ success: true });
}
