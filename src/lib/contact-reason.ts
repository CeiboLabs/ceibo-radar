import type { Platform, WebsiteQuality } from "./types";

interface ContactReasonInput {
  has_website: boolean;
  website_quality: WebsiteQuality | null;
  platform: Platform;
  description: string | null;
  phone: string | null;
  email: string | null;
  category: string | null;
}

/**
 * Generates a clear, sales-focused reason to contact this business.
 * Outputs a single sentence explaining WHY they need Ceibo Labs.
 * All logic is deterministic — based only on available data.
 */
export function generateContactReason(input: ContactReasonInput): string {
  const bioLen = input.description?.trim().length ?? 0;
  const hasContact = !!(input.phone || input.email);
  const isInstagramActive = input.platform === "instagram" && bioLen > 20;

  // ── No website cases ─────────────────────────────────────────────────────
  if (!input.has_website) {
    if (isInstagramActive && !hasContact) {
      return "Tiene Instagram activo pero no tiene sitio web ni canal de contacto — sus seguidores no tienen a dónde ir para comprar o consultarlos.";
    }
    if (isInstagramActive) {
      return "Tiene presencia activa en Instagram pero sin sitio web propio — está perdiendo clientes que buscan sus servicios fuera de las redes.";
    }
    if (!hasContact) {
      return "No tiene sitio web ni ningún canal digital de contacto — está completamente desconectado del mundo online.";
    }
    return "No tiene sitio web profesional — está perdiendo clientes que buscan sus servicios en Google todos los días.";
  }

  // ── Has website but poor ──────────────────────────────────────────────────
  if (input.website_quality === "poor") {
    if (!hasContact) {
      return "Tiene sitio web con problemas graves y sin datos de contacto visibles — los clientes potenciales se van sin convertir.";
    }
    return "Su sitio web actual genera desconfianza y limita las conversiones — necesita una actualización profesional urgente.";
  }

  // ── Has website but improvable ────────────────────────────────────────────
  if (input.website_quality === "needs_improvement") {
    if (!hasContact) {
      return "Su sitio web existe pero no tiene información de contacto clara — está perdiendo leads en el último paso.";
    }
    return "Su sitio web existe pero le faltan elementos clave — podría estar captando el doble de clientes con mejoras concretas.";
  }

  // ── No contact path despite good website ─────────────────────────────────
  if (!hasContact) {
    return "Tiene sitio web pero sin teléfono ni email visibles — los clientes que llegan no saben cómo comunicarse.";
  }

  // ── General fallback ─────────────────────────────────────────────────────
  return "Su presencia digital tiene oportunidades de mejora que impactan directamente en la captación de nuevos clientes.";
}
