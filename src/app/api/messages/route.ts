import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generateMessages } from "@/lib/messages";
import type { Lead } from "@/lib/types";

export async function POST(req: NextRequest) {
  const { leadId } = await req.json();

  if (!leadId) {
    return NextResponse.json({ error: "leadId required" }, { status: 400 });
  }

  const db = getDb();
  const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(leadId) as Lead | undefined;

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  try {
    const messages = await generateMessages(lead);
    return NextResponse.json(messages);
  } catch (err) {
    console.error("[Messages API] Error:", err);
    return NextResponse.json(
      { error: "Failed to generate messages" },
      { status: 500 }
    );
  }
}
