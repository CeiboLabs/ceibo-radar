import type { Lead } from "@/lib/types";

export interface NextAction {
  action: "contact" | "followup" | "close" | "review" | "none";
  label: string;
  urgency: "high" | "medium" | "low";
  icon: string;
  color: string; // Tailwind text color class
}

/** Pure function — derives the recommended next action from lead state. */
export function getNextAction(lead: Lead): NextAction {
  if (lead.sequence_stage === "done") {
    return { action: "none", label: "Cerrado", urgency: "low", icon: "✓", color: "text-gray-500" };
  }

  const now = Date.now();
  const followupMs = lead.next_followup_at ? new Date(lead.next_followup_at).getTime() : null;
  const isOverdue = followupMs !== null && followupMs < now;
  const isDueToday =
    followupMs !== null &&
    followupMs >= now &&
    followupMs - now < 24 * 60 * 60 * 1000;

  if (isOverdue) {
    return { action: "followup", label: "Seguimiento vencido", urgency: "high", icon: "⚠️", color: "text-red-400" };
  }

  if (isDueToday) {
    return { action: "followup", label: "Seguimiento hoy", urgency: "high", icon: "🔔", color: "text-orange-400" };
  }

  if (lead.status === "interested") {
    return { action: "close", label: "Avanzar propuesta", urgency: "high", icon: "💼", color: "text-emerald-400" };
  }

  if (lead.status === "contacted") {
    return { action: "followup", label: "Hacer seguimiento", urgency: "medium", icon: "↩️", color: "text-yellow-400" };
  }

  // not_contacted
  if (lead.is_hot) {
    return { action: "contact", label: "Contactar ahora", urgency: "high", icon: "🔥", color: "text-red-400" };
  }
  return { action: "contact", label: "Primer contacto", urgency: "medium", icon: "📞", color: "text-blue-400" };
}
