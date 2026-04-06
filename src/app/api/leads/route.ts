import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { scorelead } from "@/lib/lead-score";
import { isHotLead } from "@/lib/sales/hotLeadDetector";
import { computeDifficulty } from "@/lib/sales/difficultyEngine";
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
  const keyword = searchParams.get("keyword");

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
  if (keyword) query = query.eq("keyword", keyword);
  const after = searchParams.get("after");
  if (after) query = query.gte("created_at", after);
  const sessionId = searchParams.get("session");
  if (sessionId) query = query.eq("search_session_id", sessionId);

  const { data: leads, error } = await query
    .order("lead_score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[leads] Supabase error:", JSON.stringify(error));
    return NextResponse.json({ error: error.message, details: error }, { status: 500 });
  }
  return NextResponse.json(leads ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    name: string;
    phone?: string;
    email?: string;
    category?: string;
    location?: string;
    website_url?: string;
    description?: string;
    platform?: Platform;
    notes?: string;
  };

  const { name, phone, email, category, location, website_url, description, notes } = body;
  const platform: Platform = body.platform ?? "google_maps";

  if (!name?.trim()) {
    return NextResponse.json({ error: "El campo 'name' es requerido" }, { status: 400 });
  }

  const has_website = Boolean(website_url);

  const scoreResult = scorelead({
    has_website,
    phone,
    email,
    location,
    description,
    platform,
    category,
  });

  const partialLead = {
    name,
    phone: phone ?? null,
    email: email ?? null,
    category: category ?? null,
    location: location ?? null,
    website_url: website_url ?? null,
    description: description ?? null,
    platform,
    notes: notes ?? null,
    has_website,
    lead_score: scoreResult.score,
    lead_priority: scoreResult.priority,
    lead_score_breakdown: JSON.stringify(scoreResult.breakdown),
    keyword: category ?? "manual",
    search_location: location ?? "Manual",
    status: "not_contacted" as LeadStatus,
  };

  const is_hot = isHotLead({ ...partialLead, lead_score: scoreResult.score, lead_priority: scoreResult.priority });
  const difficulty_level = computeDifficulty({ ...partialLead });

  const { data, error } = await supabase
    .from("leads")
    .insert({ ...partialLead, is_hot, difficulty_level })
    .select()
    .single();

  if (error) {
    console.error("[leads POST] Supabase error:", JSON.stringify(error));
    return NextResponse.json({ error: error.message, details: error }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
