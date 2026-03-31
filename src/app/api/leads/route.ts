import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { LeadStatus, Platform, WebsiteFilter, PriorityFilter } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const websiteFilter = (searchParams.get("website_filter") ?? "all") as WebsiteFilter;
  const platform = searchParams.get("platform") as Platform | null;
  const status = searchParams.get("status") as LeadStatus | null;
  const priority = (searchParams.get("priority") ?? "all") as PriorityFilter;
  const favoritesOnly = searchParams.get("favorites") === "1";
  const hotOnly = searchParams.get("hot") === "1";
  const difficulty = searchParams.get("difficulty");
  const segment = searchParams.get("segment");
  const locationRegion = searchParams.get("region");

  let query = supabase.from("leads").select("*");

  switch (websiteFilter) {
    case "no_website":    query = query.eq("has_website", false); break;
    case "poor":          query = query.eq("website_quality", "poor"); break;
    case "needs_improvement": query = query.eq("website_quality", "needs_improvement"); break;
    case "good":          query = query.eq("website_quality", "good"); break;
  }

  if (priority !== "all")              query = query.eq("lead_priority", priority);
  if (platform)                        query = query.eq("platform", platform);
  if (status)                          query = query.eq("status", status);
  if (favoritesOnly)                   query = query.eq("is_favorite", true);
  if (hotOnly)                         query = query.eq("is_hot", true);
  if (difficulty && difficulty !== "all") query = query.eq("difficulty_level", difficulty);
  if (segment && segment !== "all")    query = query.ilike("segment_tags", `%"${segment}"%`);
  if (locationRegion && locationRegion !== "all") query = query.eq("location_region", locationRegion);

  const { data: leads, error } = await query
    .order("lead_score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[leads] Supabase error:", JSON.stringify(error));
    return NextResponse.json({ error: error.message, details: error }, { status: 500 });
  }
  return NextResponse.json(leads ?? []);
}
