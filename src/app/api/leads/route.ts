import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { LeadStatus, Platform, WebsiteFilter, PriorityFilter } from "@/lib/types";

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);

  const websiteFilter = (searchParams.get("website_filter") ?? "all") as WebsiteFilter;
  const platform = searchParams.get("platform") as Platform | null;
  const status = searchParams.get("status") as LeadStatus | null;
  const priority = (searchParams.get("priority") ?? "all") as PriorityFilter;
  const favoritesOnly = searchParams.get("favorites") === "1";

  let query = "SELECT * FROM leads WHERE 1=1";
  const params: (string | number)[] = [];

  switch (websiteFilter) {
    case "no_website":
      query += " AND has_website = 0";
      break;
    case "poor":
      query += " AND website_quality = 'poor'";
      break;
    case "needs_improvement":
      query += " AND website_quality = 'needs_improvement'";
      break;
    case "good":
      query += " AND website_quality = 'good'";
      break;
  }

  if (priority !== "all") {
    query += " AND lead_priority = ?";
    params.push(priority);
  }

  if (platform) {
    query += " AND platform = ?";
    params.push(platform);
  }
  if (status) {
    query += " AND status = ?";
    params.push(status);
  }
  if (favoritesOnly) {
    query += " AND is_favorite = 1";
  }

  // Default: highest score first, then by creation date for ties
  query += " ORDER BY lead_score DESC NULLS LAST, created_at DESC";

  const leads = db.prepare(query).all(...params);
  return NextResponse.json(leads);
}
