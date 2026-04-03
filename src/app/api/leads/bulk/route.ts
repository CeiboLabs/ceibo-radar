import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { scorelead } from "@/lib/lead-score";
import { isHotLead } from "@/lib/sales/hotLeadDetector";
import { computeDifficulty } from "@/lib/sales/difficultyEngine";
import type { Lead } from "@/lib/types";

// POST body: { ids: number[], action: "status" | "delete" | "recalculate", value?: string }
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    ids: number[];
    action: "status" | "delete" | "recalculate";
    value?: string;
  };

  const { ids, action, value } = body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
  }

  if (action === "status") {
    if (!value) {
      return NextResponse.json({ error: "value is required for status action" }, { status: 400 });
    }
    const { error } = await supabase
      .from("leads")
      .update({ status: value })
      .in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ updated: ids.length });
  }

  if (action === "delete") {
    const { error } = await supabase.from("leads").delete().in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ deleted: ids.length });
  }

  if (action === "recalculate") {
    const { data: leads, error: fetchError } = await supabase
      .from("leads")
      .select("*")
      .in("id", ids);

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

    const updates = (leads ?? []).map((lead: Lead) => {
      const scoreResult = scorelead({
        has_website: Boolean(lead.has_website),
        website_quality: lead.website_quality ?? null,
        phone: lead.phone ?? null,
        email: lead.email ?? null,
        location: lead.location ?? null,
        description: lead.description ?? null,
        platform: lead.platform,
        category: lead.category ?? null,
      });

      const updatedLead = {
        ...lead,
        lead_score: scoreResult.score,
        lead_priority: scoreResult.priority,
      };

      return {
        id: lead.id,
        lead_score: scoreResult.score,
        lead_priority: scoreResult.priority,
        lead_score_breakdown: JSON.stringify(scoreResult.breakdown),
        is_hot: isHotLead(updatedLead),
        difficulty_level: computeDifficulty(lead),
      };
    });

    const results = await Promise.allSettled(
      updates.map(({ id, ...fields }) =>
        supabase.from("leads").update(fields).eq("id", id)
      )
    );

    const failed = results.filter((r) => r.status === "rejected").length;
    return NextResponse.json({ recalculated: updates.length - failed, failed });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
