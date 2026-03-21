import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const jobs = db.prepare("SELECT * FROM scraping_jobs ORDER BY created_at DESC").all();
  return NextResponse.json(jobs);
}

export async function POST(req: NextRequest) {
  const { name, keyword, locations, platforms, max_scrolls, schedule } = await req.json();
  if (!name?.trim() || !keyword?.trim() || !locations?.length) {
    return NextResponse.json({ error: "name, keyword, and locations are required" }, { status: 400 });
  }
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO scraping_jobs (name, keyword, locations, platforms, max_scrolls, schedule)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    name.trim(),
    keyword.trim(),
    JSON.stringify(locations),
    JSON.stringify(platforms ?? ["google_maps"]),
    max_scrolls ?? 8,
    schedule ?? "manual"
  );
  const created = db.prepare("SELECT * FROM scraping_jobs WHERE id = ?").get(result.lastInsertRowid);
  return NextResponse.json(created, { status: 201 });
}
