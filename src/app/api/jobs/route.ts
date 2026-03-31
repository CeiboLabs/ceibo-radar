import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("scraping_jobs")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const { name, keyword, locations, platforms, max_scrolls, schedule } = await req.json();
  if (!name?.trim() || !keyword?.trim() || !locations?.length) {
    return NextResponse.json({ error: "name, keyword, and locations are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("scraping_jobs")
    .insert({
      name: name.trim(),
      keyword: keyword.trim(),
      locations: JSON.stringify(locations),
      platforms: JSON.stringify(platforms ?? ["google_maps"]),
      max_scrolls: max_scrolls ?? 8,
      schedule: schedule ?? "manual",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
