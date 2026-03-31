import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateMessages } from "@/lib/messages";
import type { Lead } from "@/lib/types";

export async function POST(req: NextRequest) {
  const { leadId } = await req.json();
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

  const { data: lead, error } = await supabase.from("leads").select("*").eq("id", leadId).single();
  if (error || !lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  try {
    const messages = await generateMessages(lead as unknown as Lead);
    return NextResponse.json(messages);
  } catch (err) {
    console.error("[Messages API] Error:", err);
    return NextResponse.json({ error: "Failed to generate messages" }, { status: 500 });
  }
}
