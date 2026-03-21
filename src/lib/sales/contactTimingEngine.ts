import type { Lead } from "@/lib/types";

export interface ContactTiming {
  window: string;          // e.g. "9-12h"
  days: string;            // e.g. "Lun-Vie"
  recommendation: "contact_now" | "wait" | "followup_now";
  waitDays: number;        // 0 unless recommendation === "wait"
  reason: string;
}

// ── Category → optimal contact window ────────────────────────────────────────
function getWindowForCategory(category: string | null): { window: string; days: string } {
  if (!category) return { window: "9-12h", days: "Lun-Vie" };
  const c = category.toLowerCase();

  if (/restaurante|café|cafet|parrilla|pizza|sushi|comida|bar\b/.test(c))
    return { window: "10-12h", days: "Mar-Sáb" };
  if (/gym|gimnasio|fitness|pilates|yoga|crossfit|boxeo/.test(c))
    return { window: "8-10h o 17-20h", days: "Lun-Vie" };
  if (/peluquer|estetica|estética|manicure|belleza|spa|salon/.test(c))
    return { window: "10-13h", days: "Lun-Sáb" };
  if (/retail|tienda|ropa|moda|calzado|joyeria|boutique/.test(c))
    return { window: "10-12h", days: "Lun-Vie" };
  if (/abogad|contador|notari|juridic|asesor/.test(c))
    return { window: "9-11h", days: "Mar-Jue" };
  if (/hotel|hostel|alojamiento|turismo/.test(c))
    return { window: "10-12h", days: "Lun-Vie" };
  if (/clinica|medic|dental|salud|veterina/.test(c))
    return { window: "9-11h", days: "Mar-Vie" };

  return { window: "9-12h", days: "Lun-Vie" };
}

/** Pure function — derives when and how to contact this lead right now. */
export function getContactTiming(lead: Lead): ContactTiming {
  const windowInfo = getWindowForCategory(lead.category);
  const now = Date.now();

  // Scheduled followup
  if (lead.next_followup_at) {
    const followupMs = new Date(lead.next_followup_at).getTime();
    if (followupMs > now) {
      const waitDays = Math.ceil((followupMs - now) / (1000 * 60 * 60 * 24));
      return {
        ...windowInfo,
        recommendation: "wait",
        waitDays,
        reason: `Seguimiento programado en ${waitDays} día${waitDays === 1 ? "" : "s"}`,
      };
    }
    return {
      ...windowInfo,
      recommendation: "followup_now",
      waitDays: 0,
      reason: "Seguimiento vencido — contactar ahora",
    };
  }

  if (lead.status === "interested") {
    return {
      ...windowInfo,
      recommendation: "followup_now",
      waitDays: 0,
      reason: "Lead interesado — avanzar propuesta cuanto antes",
    };
  }

  if (lead.status === "contacted") {
    if (lead.last_contacted_at) {
      const daysSince =
        (now - new Date(lead.last_contacted_at).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 3) {
        const waitDays = Math.ceil(3 - daysSince);
        return {
          ...windowInfo,
          recommendation: "wait",
          waitDays,
          reason: `Contactado hace ${Math.floor(daysSince)}d — esperar ${waitDays} día${waitDays === 1 ? "" : "s"} más`,
        };
      }
    }
    return {
      ...windowInfo,
      recommendation: "followup_now",
      waitDays: 0,
      reason: "Sin respuesta — momento ideal para seguimiento",
    };
  }

  // not_contacted
  return {
    ...windowInfo,
    recommendation: "contact_now",
    waitDays: 0,
    reason: "Lead sin contactar — primer contacto disponible",
  };
}
