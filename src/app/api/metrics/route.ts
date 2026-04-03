import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
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
    supabase.from("leads").select(
      "status, lead_priority, platform, search_location, category, is_hot, is_favorite, lead_score, last_contacted_at, created_at, estimated_value"
    ),
    supabase
      .from("leads")
      .select("id, name, lead_score, lead_priority, has_website, website_quality, status")
      .not("lead_score", "is", null)
      .order("lead_score", { ascending: false })
      .limit(5),
  ]);

  const leads = partialLeads ?? [];

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const thisWeek = leads.filter(l => new Date(l.created_at) >= weekAgo).length;
  const thisMonth = leads.filter(l => new Date(l.created_at) >= monthAgo).length;
  const hotLeads = leads.filter(l => l.is_hot).length;
  const favorites = leads.filter(l => l.is_favorite).length;
  // "contacted" = any stage beyond not_contacted
  const contacted = leads.filter(l => l.status !== "not_contacted").length;

  const scored = leads.filter(l => l.lead_score != null);
  const avgScore = scored.length
    ? Math.round(scored.reduce((s: number, l) => s + (l.lead_score ?? 0), 0) / scored.length)
    : null;

  // Leads per day (last 30 days) for sparkline
  const dailyCounts: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dailyCounts[d.toISOString().slice(0, 10)] = 0;
  }
  for (const l of leads) {
    const day = (l.created_at as string).slice(0, 10);
    if (day in dailyCounts) dailyCounts[day]++;
  }
  const dailySeries = Object.entries(dailyCounts).map(([date, count]) => ({ date, count }));

  const byStatus = groupCount(leads, "status");
  const byPriority = groupCount(leads.filter(l => l.lead_priority), "lead_priority");
  const byPlatform = groupCount(leads, "platform");
  const byValue = groupCount(leads, "estimated_value");

  const byLocation = (groupCount(leads, "search_location") as { search_location: string; count: number }[])
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Normalize category case before grouping
  const leadsWithCategory = leads
    .filter(l => l.category)
    .map(l => ({ ...l, category: (l.category as string).trim().toLowerCase().replace(/^./, c => c.toUpperCase()) }));
  const byCategory = (groupCount(leadsWithCategory, "category") as { category: string; count: number }[])
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return NextResponse.json({
    total: total ?? 0,
    thisWeek,
    thisMonth,
    hotLeads,
    favorites,
    contacted,
    avgScore,
    dailySeries,
    noWebsite: noWebsite ?? 0,
    poorWebsite: poorWebsite ?? 0,
    weakWebsite: weakWebsite ?? 0,
    goodWebsite: goodWebsite ?? 0,
    opportunities: (noWebsite ?? 0) + (poorWebsite ?? 0) + (weakWebsite ?? 0),
    byStatus,
    byPriority,
    byPlatform,
    byValue,
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
