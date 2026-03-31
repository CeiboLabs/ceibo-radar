import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  // Run count queries and partial selects in parallel
  const [
    { count: total },
    { count: noWebsite },
    { count: poorWebsite },
    { count: weakWebsite },
    { count: goodWebsite },
    { count: campaignCount },
    { data: partialLeads },
    { data: topLeads },
  ] = await Promise.all([
    supabase.from("leads").select("*", { count: "exact", head: true }),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("has_website", false),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("website_quality", "poor"),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("website_quality", "needs_improvement"),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("website_quality", "good"),
    supabase.from("campaigns").select("*", { count: "exact", head: true }),
    supabase.from("leads").select("status, lead_priority, platform, search_location, category"),
    supabase
      .from("leads")
      .select("id, name, lead_score, lead_priority, has_website, website_quality, status")
      .not("lead_score", "is", null)
      .order("lead_score", { ascending: false })
      .limit(5),
  ]);

  // Group in JS
  const leads = partialLeads ?? [];

  const byStatus = groupCount(leads, "status");
  const byPriority = groupCount(leads.filter((l) => l.lead_priority), "lead_priority");
  const byPlatform = groupCount(leads, "platform");

  const byLocation = Object.entries(groupCount(leads, "search_location") as Record<string, number>)
    .map(([search_location, count]) => ({ search_location, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const byCategory = Object.entries(
    groupCount(leads.filter((l) => l.category), "category") as Record<string, number>
  )
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return NextResponse.json({
    total: total ?? 0,
    noWebsite: noWebsite ?? 0,
    poorWebsite: poorWebsite ?? 0,
    weakWebsite: weakWebsite ?? 0,
    goodWebsite: goodWebsite ?? 0,
    opportunities: (noWebsite ?? 0) + (poorWebsite ?? 0) + (weakWebsite ?? 0),
    byStatus,
    byPriority,
    byPlatform,
    byLocation,
    byCategory,
    topLeads: topLeads ?? [],
    campaignCount: campaignCount ?? 0,
  });
}

function groupCount(
  arr: Record<string, unknown>[],
  key: string
): { [k: string]: number } | { [k: string]: unknown; count: number }[] {
  const map: Record<string, number> = {};
  for (const item of arr) {
    const val = String(item[key] ?? "");
    map[val] = (map[val] ?? 0) + 1;
  }
  return Object.entries(map).map(([k, count]) => ({ [key]: k, count })) as never;
}
