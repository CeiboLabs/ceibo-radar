import type { DetectedOpportunity, EnrichmentData, Platform, WebsiteQuality } from "./types";

interface AutoTagInput {
  has_website: boolean;
  website_quality: WebsiteQuality | null;
  platform: Platform;
  description: string | null;
  phone: string | null;
  email: string | null;
  location: string | null;
  lead_score: number;
  enrichment: EnrichmentData;
  opportunities: DetectedOpportunity[];
}

/**
 * Computes auto-generated tags from structured lead data.
 * Tags are deterministic: same data → same tags every time.
 */
export function computeAutoTags(input: AutoTagInput): string[] {
  const tags: string[] = [];

  // Website status
  if (!input.has_website) tags.push("sin-website");
  if (input.website_quality === "poor") tags.push("website-malo");
  if (input.website_quality === "needs_improvement") tags.push("website-mejorable");

  // Contact availability
  if (!input.phone && !input.email) tags.push("sin-contacto");
  if (input.phone) tags.push("tiene-telefono");
  if (input.email) tags.push("tiene-email");

  // Platform signals
  const bioLen = input.description?.trim().length ?? 0;
  if (input.platform === "instagram" && bioLen > 20) tags.push("instagram-activo");

  // Priority signals
  if (input.lead_score >= 65) tags.push("alta-prioridad");
  if (input.lead_score <= 20) tags.push("baja-prioridad");

  // Enrichment signals
  if (input.enrichment.digital_maturity === "none") tags.push("sin-presencia-digital");
  if (input.enrichment.sells_online === true) tags.push("potencial-ecommerce");
  if (input.enrichment.activity_level === "active") tags.push("negocio-activo");
  if (input.enrichment.social_quality === "strong") tags.push("fuerte-presencia-social");

  // Opportunity signals
  const highImpactOps = input.opportunities.filter((o) => o.impact === "high");
  if (highImpactOps.length >= 2) tags.push("gran-oportunidad");
  if (input.opportunities.some((o) => o.code === "INSTAGRAM_ACTIVE_NO_WEB")) {
    tags.push("instagram-sin-web");
  }
  if (input.opportunities.some((o) => o.code === "NOT_MOBILE_FRIENDLY")) {
    tags.push("no-mobile");
  }

  return tags;
}
