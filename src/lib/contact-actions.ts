import { generateWithTemplates } from "./messages/template-generator";
import { buildLeadContext } from "./messages/types";
import { classifyPhone } from "./phone-classifier";
import type { Lead } from "./types";

export interface ContactActionResult {
  url: string;
  message_preview: string;
}

export function buildWhatsAppAction(lead: Lead): ContactActionResult | null {
  if (!lead.phone) return null;

  const phoneInfo = classifyPhone(lead.phone);
  if (!phoneInfo.canWhatsapp || !phoneInfo.whatsappUrl) return null;

  const ctx = buildLeadContext(lead);
  const messages = generateWithTemplates(ctx);
  const message = messages.whatsapp;
  const url = `${phoneInfo.whatsappUrl}?text=${encodeURIComponent(message)}`;

  return { url, message_preview: message.slice(0, 120) };
}

export function buildEmailAction(lead: Lead): ContactActionResult | null {
  if (!lead.email) return null;

  const ctx = buildLeadContext(lead);
  const messages = generateWithTemplates(ctx);
  const { subject, body } = messages.email;

  const url = `mailto:${lead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return { url, message_preview: subject };
}
