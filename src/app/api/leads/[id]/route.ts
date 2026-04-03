import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { logEvent } from "@/lib/lead-events";
import { scorelead } from "@/lib/lead-score";
import { isHotLead } from "@/lib/sales/hotLeadDetector";
import { computeDifficulty } from "@/lib/sales/difficultyEngine";
import type { Lead } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { data, error } = await supabase.from("leads").select("*").eq("id", id).single();
  if (error || !data) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { status, notes, tags, sequence_stage, next_followup_at, is_favorite, recalculate } = body;

  // Fetch current state for event diffing
  const { data: before, error: fetchErr } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchErr || !before) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const update: Record<string, unknown> = {};

  if (status !== undefined) {
    update.status = status;
    if (status === "contacted" || status === "interested" || status === "proposal_sent") {
      update.last_contacted_at = new Date().toISOString();
    }
  }
  if (notes !== undefined)          update.notes = notes;
  if (tags !== undefined)           update.tags = JSON.stringify(tags);
  if (sequence_stage !== undefined) update.sequence_stage = sequence_stage;
  if (next_followup_at !== undefined) update.next_followup_at = next_followup_at ?? null;
  if (is_favorite !== undefined)    update.is_favorite = Boolean(is_favorite);

  if (recalculate === true) {
    const scoreResult = scorelead({
      has_website: Boolean(before.has_website),
      website_quality: before.website_quality ?? null,
      phone: before.phone ?? null,
      email: before.email ?? null,
      location: before.location ?? null,
      description: before.description ?? null,
      platform: before.platform,
      category: before.category ?? null,
    });
    update.lead_score = scoreResult.score;
    update.lead_priority = scoreResult.priority;
    update.lead_score_breakdown = JSON.stringify(scoreResult.breakdown);
    update.is_hot = isHotLead({
      ...before,
      lead_score: scoreResult.score,
      lead_priority: scoreResult.priority,
    });
    update.difficulty_level = computeDifficulty(before);
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error: updateErr } = await supabase.from("leads").update(update).eq("id", id);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // ── Event logging ────────────────────────────────────────────────────────────
  const leadId = Number(id);
  const prev = before as Lead;

  if (status !== undefined && status !== prev.status) {
    const labels: Record<string, string> = {
      not_contacted: "Sin contactar",
      contacted: "Contactado",
      interested: "Interesado",
      proposal_sent: "Propuesta enviada",
      closed_won: "Cerrado",
    };
    logEvent(leadId, "status_changed", `Estado cambiado a "${labels[status] ?? status}"`);
  }
  if (notes !== undefined && notes?.trim() && notes !== prev.notes) {
    logEvent(leadId, "note_added", "Nota actualizada");
  }
  if (tags !== undefined) {
    const prevTags: string[] = (() => { try { return JSON.parse(prev.tags ?? "[]"); } catch { return []; } })();
    const nextTags: string[] = tags;
    for (const t of nextTags) if (!prevTags.includes(t)) logEvent(leadId, "tag_added", `Tag "${t}" agregado`);
    for (const t of prevTags) if (!nextTags.includes(t)) logEvent(leadId, "tag_removed", `Tag "${t}" eliminado`);
  }
  if (is_favorite !== undefined && Boolean(is_favorite) !== Boolean(prev.is_favorite)) {
    logEvent(leadId, is_favorite ? "favorited" : "unfavorited",
      is_favorite ? "Marcado como favorito ⭐" : "Removido de favoritos");
  }
  if (recalculate === true) {
    logEvent(leadId, "score_recalculated", "Score recalculado");
  }
  // ─────────────────────────────────────────────────────────────────────────────

  const { data: updated } = await supabase.from("leads").select("*").eq("id", id).single();
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
