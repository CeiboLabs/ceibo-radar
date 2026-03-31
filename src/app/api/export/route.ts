import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const noWebsiteOnly = searchParams.get("no_website") === "true";

  let query = supabase.from("leads").select(
    "id, name, platform, profile_url, phone, email, location, description, has_website, website_url, status, notes, keyword, search_location, created_at"
  ).order("created_at", { ascending: false });

  if (noWebsiteOnly) query = query.eq("has_website", false);

  const { data: leads } = await query;

  const headers = [
    "id", "name", "platform", "profile_url", "phone", "email",
    "location", "description", "has_website", "website_url",
    "status", "notes", "keyword", "search_location", "created_at",
  ];

  const csvRows = [
    headers.join(","),
    ...(leads ?? []).map((lead) =>
      headers
        .map((h) => {
          const val = (lead as Record<string, unknown>)[h];
          if (val === null || val === undefined) return "";
          const str = String(val);
          return str.includes(",") || str.includes('"') || str.includes("\n")
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        })
        .join(",")
    ),
  ];

  return new NextResponse(csvRows.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="ceibo-radar-${Date.now()}.csv"`,
    },
  });
}
