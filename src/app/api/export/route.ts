import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const noWebsiteOnly = searchParams.get("no_website") === "true";

  let query = "SELECT * FROM leads WHERE 1=1";
  if (noWebsiteOnly) query += " AND has_website = 0";
  query += " ORDER BY created_at DESC";

  const leads = db.prepare(query).all() as Record<string, unknown>[];

  const headers = [
    "id", "name", "platform", "profile_url", "phone", "email",
    "location", "description", "has_website", "website_url",
    "status", "notes", "keyword", "search_location", "created_at"
  ];

  const csvRows = [
    headers.join(","),
    ...leads.map((lead) =>
      headers
        .map((h) => {
          const val = lead[h];
          if (val === null || val === undefined) return "";
          const str = String(val);
          return str.includes(",") || str.includes('"') || str.includes("\n")
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        })
        .join(",")
    ),
  ];

  const csv = csvRows.join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="ceibo-radar-${Date.now()}.csv"`,
    },
  });
}
