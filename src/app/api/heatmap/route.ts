import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data: leads } = await supabase
    .from("leads")
    .select("search_location, location_region, has_website, website_quality, is_hot, lead_score, category");

  const all = leads ?? [];

  // ── By location ────────────────────────────────────────────────────────────
  const locMap = new Map<string, {
    location: string; region: string | null;
    total: number; no_website: number; poor_website: number;
    hot_leads: number; score_sum: number; score_count: number;
  }>();

  for (const l of all) {
    if (!l.search_location) continue;
    if (!locMap.has(l.search_location)) {
      locMap.set(l.search_location, {
        location: l.search_location, region: l.location_region ?? null,
        total: 0, no_website: 0, poor_website: 0,
        hot_leads: 0, score_sum: 0, score_count: 0,
      });
    }
    const entry = locMap.get(l.search_location)!;
    entry.total++;
    if (!l.has_website) entry.no_website++;
    if (l.website_quality === "poor") entry.poor_website++;
    if (l.is_hot) entry.hot_leads++;
    if (l.lead_score != null) { entry.score_sum += l.lead_score; entry.score_count++; }
  }

  const byLocation = Array.from(locMap.values())
    .map((e) => ({ ...e, avg_score: e.score_count > 0 ? Math.round(e.score_sum / e.score_count) : 0, score_sum: undefined, score_count: undefined }))
    .sort((a, b) => (b.no_website + b.poor_website) - (a.no_website + a.poor_website))
    .slice(0, 15);

  // ── By category ────────────────────────────────────────────────────────────
  const catMap = new Map<string, {
    category: string;
    total: number; no_website: number; poor_website: number;
    hot_leads: number; score_sum: number; score_count: number;
  }>();

  for (const l of all) {
    if (!l.category) continue;
    if (!catMap.has(l.category)) {
      catMap.set(l.category, {
        category: l.category,
        total: 0, no_website: 0, poor_website: 0,
        hot_leads: 0, score_sum: 0, score_count: 0,
      });
    }
    const entry = catMap.get(l.category)!;
    entry.total++;
    if (!l.has_website) entry.no_website++;
    if (l.website_quality === "poor") entry.poor_website++;
    if (l.is_hot) entry.hot_leads++;
    if (l.lead_score != null) { entry.score_sum += l.lead_score; entry.score_count++; }
  }

  const byCategory = Array.from(catMap.values())
    .map((e) => ({ ...e, avg_score: e.score_count > 0 ? Math.round(e.score_sum / e.score_count) : 0, score_sum: undefined, score_count: undefined }))
    .sort((a, b) => (b.no_website + b.poor_website) - (a.no_website + a.poor_website))
    .slice(0, 15);

  return NextResponse.json({ by_location: byLocation, by_category: byCategory });
}
