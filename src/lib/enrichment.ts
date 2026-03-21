import type { EnrichmentData, Platform, WebsiteQuality } from "./types";

interface EnrichmentInput {
  has_website: boolean;
  website_quality: WebsiteQuality | null;
  platform: Platform;
  description: string | null;
  phone: string | null;
  email: string | null;
  location: string | null;
  category: string | null;
}

/**
 * Infers business attributes from available structured data.
 * All inferences are heuristic — never fabricated.
 */
export function enrichLead(input: EnrichmentInput): EnrichmentData {
  const desc = input.description?.trim() ?? "";
  const descLower = desc.toLowerCase();

  // ── Activity level ────────────────────────────────────────────────────────
  const hasMeaningfulBio = desc.length > 20;
  const hasContactInfo = !!(input.phone || input.email);

  let activity_level: EnrichmentData["activity_level"];
  if (hasMeaningfulBio && hasContactInfo) {
    activity_level = "active";
  } else if (hasMeaningfulBio || hasContactInfo) {
    activity_level = "low_activity";
  } else {
    activity_level = "unknown";
  }

  // ── Digital maturity ──────────────────────────────────────────────────────
  let digital_maturity: EnrichmentData["digital_maturity"];
  if (!input.has_website) {
    digital_maturity = "none";
  } else if (input.website_quality === "good") {
    digital_maturity = "established";
  } else {
    digital_maturity = "basic";
  }

  // ── Business size ─────────────────────────────────────────────────────────
  let business_size: EnrichmentData["business_size"];
  if (/(sucursal|franquicia|cadena|nacional|branch|locations|múltiples|multiples)/i.test(descLower)) {
    business_size = "medium";
  } else if (/\b(local|pequeño|familiar|boutique|taller|artesanal|casero|emprendimiento)\b/i.test(descLower)) {
    business_size = "small";
  } else {
    business_size = "unknown";
  }

  // ── Sells online ──────────────────────────────────────────────────────────
  const ecommerceSignals =
    /(shop|tienda online|comprar|carrito|checkout|envío|delivery|pedidos? online|e-?commerce|woocommerce|shopify|mercadolibre|mercado libre)/i;
  let sells_online: boolean | null;
  if (ecommerceSignals.test(descLower)) {
    sells_online = true;
  } else if (/(solo presencial|no hacemos envío|atendemos en el local|sin envío)/i.test(descLower)) {
    sells_online = false;
  } else {
    sells_online = null;
  }

  // ── Social quality ────────────────────────────────────────────────────────
  let social_quality: EnrichmentData["social_quality"];
  if (input.platform === "instagram") {
    const hasLinkInBio = input.has_website; // we detected a URL in their bio
    if (desc.length > 60 && hasLinkInBio) {
      social_quality = "strong";
    } else if (desc.length > 20 || hasLinkInBio) {
      social_quality = "moderate";
    } else {
      social_quality = "weak";
    }
  } else {
    // Google Maps — description means they actively manage their listing
    social_quality = desc.length > 10 ? "moderate" : "none";
  }

  return { activity_level, digital_maturity, business_size, sells_online, social_quality };
}
