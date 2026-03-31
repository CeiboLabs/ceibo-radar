import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data: all } = await supabase
    .from("leads")
    .select("id, name, platform, category, search_location, lead_score, lead_priority, has_website, website_quality, contact_reason, business_diagnosis, estimated_value, phone, email, status, opportunity_summary, created_at, is_hot");

  const leads = all ?? [];

  const topLeads = [...leads]
    .filter((l) => l.lead_score != null)
    .sort((a, b) => (b.lead_score ?? 0) - (a.lead_score ?? 0))
    .slice(0, 10);

  const activeNoWeb = leads
    .filter((l) => !l.has_website && (l.phone || l.email) && l.lead_score != null)
    .sort((a, b) => (b.lead_score ?? 0) - (a.lead_score ?? 0))
    .slice(0, 10);

  const freshOpportunities = leads
    .filter((l) => l.status === "not_contacted" && l.lead_priority === "high")
    .sort((a, b) => (b.lead_score ?? 0) - (a.lead_score ?? 0))
    .slice(0, 10);

  const catMap = new Map();
  for (const l of leads) {
    if (!l.category) continue;
    if (!catMap.has(l.category)) catMap.set(l.category, { total: 0, no_website: 0, weak_website: 0, score_sum: 0, score_count: 0 });
    const e = catMap.get(l.category);
    e.total++;
    if (!l.has_website) e.no_website++;
    if (l.website_quality === "poor" || l.website_quality === "needs_improvement") e.weak_website++;
    if (l.lead_score != null) { e.score_sum += l.lead_score; e.score_count++; }
  }
  const topNiches = Array.from(catMap.entries())
    .filter(([, e]) => e.total >= 2)
    .map(([category, e]) => ({ category, total: e.total, no_website: e.no_website, weak_website: e.weak_website, avg_score: e.score_count > 0 ? Math.round((e.score_sum / e.score_count) * 10) / 10 : 0 }))
    .sort((a, b) => (b.no_website + b.weak_website) - (a.no_website + a.weak_website))
    .slice(0, 12);

  const locMap = new Map();
  for (const l of leads) {
    if (!l.search_location) continue;
    if (!locMap.has(l.search_location)) locMap.set(l.search_location, { total: 0, no_website: 0, high_priority: 0, score_sum: 0, score_count: 0 });
    const e = locMap.get(l.search_location);
    e.total++;
    if (!l.has_website) e.no_website++;
    if (l.lead_priority === "high") e.high_priority++;
    if (l.lead_score != null) { e.score_sum += l.lead_score; e.score_count++; }
  }
  const topLocations = Array.from(locMap.entries())
    .map(([search_location, e]) => ({ search_location, total: e.total, no_website: e.no_website, high_priority: e.high_priority, avg_score: e.score_count > 0 ? Math.round((e.score_sum / e.score_count) * 10) / 10 : 0 }))
    .sort((a, b) => b.no_website - a.no_website)
    .slice(0, 8);

  const stats = {
    total: leads.length,
    no_website: leads.filter((l) => !l.has_website).length,
    high_priority: leads.filter((l) => l.lead_priority === "high").length,
    untouched_high: leads.filter((l) => l.status === "not_contacted" && l.lead_priority === "high").length,
    high_value: leads.filter((l) => l.estimated_value === "high").length,
  };

  return NextResponse.json({ stats, topLeads, activeNoWeb, freshOpportunities, topNiches, topLocations });
}
