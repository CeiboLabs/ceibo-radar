import type { EnrichmentData, Platform, WebsiteQuality } from "./types";

interface DiagnosisInput {
  has_website: boolean;
  website_quality: WebsiteQuality | null;
  platform: Platform;
  description: string | null;
  phone: string | null;
  email: string | null;
  enrichment: EnrichmentData;
}

/**
 * Generates a short, honest, sales-focused diagnosis of the business.
 * The goal: help the sales team understand the situation in one sentence.
 */
export function generateDiagnosis(input: DiagnosisInput): string {
  const problems: string[] = [];
  const bioLen = input.description?.trim().length ?? 0;

  // ── Primary digital presence problem ─────────────────────────────────────
  if (!input.has_website) {
    problems.push("no tener presencia web profesional");
  } else if (input.website_quality === "poor") {
    problems.push("tener un sitio web deficiente que genera desconfianza");
  } else if (input.website_quality === "needs_improvement") {
    problems.push("tener un sitio web sin elementos clave de conversión");
  }

  // ── Contact accessibility ─────────────────────────────────────────────────
  if (!input.phone && !input.email) {
    if (!input.has_website) {
      problems.push("no tener ningún canal de contacto digital accesible");
    } else {
      problems.push("no mostrar datos de contacto en su sitio");
    }
  }

  // ── Platform-specific signals ─────────────────────────────────────────────
  if (input.platform === "instagram" && !input.has_website && bioLen > 20) {
    problems.push("depender exclusivamente de Instagram sin página propia");
  }

  // ── Digital maturity signals ──────────────────────────────────────────────
  if (input.enrichment.digital_maturity === "none" && problems.length === 0) {
    problems.push("carecer de infraestructura digital básica");
  }

  // ── Positive case ─────────────────────────────────────────────────────────
  if (problems.length === 0) {
    if (input.enrichment.digital_maturity === "established") {
      return "Presencia digital sólida. Oportunidad para servicios de optimización, SEO o rediseño premium.";
    }
    return "Presencia digital funcional. Hay oportunidades de optimización y mejora del rendimiento.";
  }

  // ── Build diagnosis sentence ──────────────────────────────────────────────
  if (problems.length === 1) {
    return `Este negocio probablemente está perdiendo clientes por ${problems[0]}.`;
  }

  const last = problems.pop()!;
  return `Este negocio está perdiendo clientes por ${problems.join(", ")} y ${last}.`;
}
