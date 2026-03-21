import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { buildWhatsAppAction, buildEmailAction } from "@/lib/contact-actions";
import type { Lead, ContactLog } from "@/lib/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { channel } = await req.json();

  if (channel !== "whatsapp" && channel !== "email") {
    return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
  }

  const db = getDb();
  const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(id) as Lead | undefined;

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const action =
    channel === "whatsapp" ? buildWhatsAppAction(lead) : buildEmailAction(lead);

  if (!action) {
    return NextResponse.json({ error: "No contact info for this channel" }, { status: 400 });
  }

  db.prepare(
    "INSERT INTO contact_log (lead_id, channel, message_preview) VALUES (?, ?, ?)"
  ).run(lead.id, channel, action.message_preview);

  if (lead.status === "not_contacted") {
    db.prepare(
      "UPDATE leads SET status = 'contacted', updated_at = datetime('now') WHERE id = ?"
    ).run(lead.id);
  }

  const updatedLead = db.prepare("SELECT * FROM leads WHERE id = ?").get(id) as Lead;
  const logs = db
    .prepare("SELECT * FROM contact_log WHERE lead_id = ? ORDER BY created_at DESC")
    .all(lead.id) as ContactLog[];

  return NextResponse.json({ url: action.url, updated_lead: updatedLead, logs });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const logs = db
    .prepare("SELECT * FROM contact_log WHERE lead_id = ? ORDER BY created_at DESC")
    .all(id) as ContactLog[];

  return NextResponse.json({ logs });
}
