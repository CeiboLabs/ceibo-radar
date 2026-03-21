import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { logEvent } from "@/lib/lead-events";
import type { Lead } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(id);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  return NextResponse.json(lead);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { status, notes, tags, sequence_stage, next_followup_at, is_favorite } = body;

  const db = getDb();

  // Fetch current state before update (for event diffing)
  const before = db.prepare("SELECT * FROM leads WHERE id = ?").get(id) as Lead | undefined;
  if (!before) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (status !== undefined) {
    fields.push("status = ?");
    values.push(status);
  }
  if (notes !== undefined) {
    fields.push("notes = ?");
    values.push(notes);
  }
  if (tags !== undefined) {
    fields.push("tags = ?");
    values.push(JSON.stringify(tags));
  }
  if (sequence_stage !== undefined) {
    fields.push("sequence_stage = ?");
    values.push(sequence_stage);
  }
  if (next_followup_at !== undefined) {
    fields.push("next_followup_at = ?");
    values.push(next_followup_at);
  }
  if (is_favorite !== undefined) {
    fields.push("is_favorite = ?");
    values.push(is_favorite ? 1 : 0);
  }

  if (fields.length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE leads SET ${fields.join(", ")} WHERE id = ?`).run(...values);

  // ── Event logging ───────────────────────────────────────────────────────────
  const leadId = Number(id);

  if (status !== undefined && status !== before.status) {
    const statusLabels: Record<string, string> = {
      not_contacted: "Sin contactar",
      contacted: "Contactado",
      interested: "Interesado",
    };
    logEvent(
      leadId,
      "status_changed",
      `Estado cambiado a "${statusLabels[status] ?? status}"`
    );
  }

  if (notes !== undefined && notes.trim() && notes !== before.notes) {
    logEvent(leadId, "note_added", "Nota actualizada");
  }

  if (tags !== undefined) {
    const prevTags: string[] = (() => {
      try { return JSON.parse(before.tags ?? "[]"); } catch { return []; }
    })();
    const nextTags: string[] = tags;
    for (const t of nextTags) {
      if (!prevTags.includes(t)) logEvent(leadId, "tag_added", `Tag "${t}" agregado`);
    }
    for (const t of prevTags) {
      if (!nextTags.includes(t)) logEvent(leadId, "tag_removed", `Tag "${t}" eliminado`);
    }
  }

  if (is_favorite !== undefined && Boolean(is_favorite) !== Boolean(before.is_favorite)) {
    logEvent(
      leadId,
      is_favorite ? "favorited" : "unfavorited",
      is_favorite ? "Marcado como favorito ⭐" : "Removido de favoritos"
    );
  }
  // ── end event logging ───────────────────────────────────────────────────────

  const updated = db.prepare("SELECT * FROM leads WHERE id = ?").get(id);
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  db.prepare("DELETE FROM leads WHERE id = ?").run(id);
  return NextResponse.json({ success: true });
}
