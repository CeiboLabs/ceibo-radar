import type { DetectedOpportunity, Platform, WebsiteQuality } from "./types";

export interface OpportunityResult {
  opportunities: DetectedOpportunity[];
  summary: string;
}

interface OpportunityInput {
  name: string;
  has_website: boolean;
  website_quality: WebsiteQuality | null;
  website_quality_issues: string[] | null; // parsed array
  platform: Platform;
  description: string | null;
  phone: string | null;
  email: string | null;
  location: string | null;
}

/**
 * Detects specific commercial opportunities for Ceibo Labs.
 * Each opportunity explains WHY this lead is relevant.
 * All detections are grounded in available data — nothing is fabricated.
 */
export function detectOpportunities(input: OpportunityInput): OpportunityResult {
  const ops: DetectedOpportunity[] = [];
  const issues = input.website_quality_issues ?? [];
  const bioLen = input.description?.trim().length ?? 0;

  // ── Website gap ───────────────────────────────────────────────────────────
  if (!input.has_website) {
    ops.push({
      code: "NO_WEBSITE",
      label: "Sin sitio web",
      description: `${input.name} no tiene presencia web. Candidato ideal para un sitio profesional desde cero.`,
      impact: "high",
    });
  } else {
    if (input.website_quality === "poor") {
      ops.push({
        code: "WEAK_WEBSITE",
        label: "Sitio web deficiente",
        description:
          "El sitio web actual tiene problemas graves que dañan la credibilidad del negocio y limitan la conversión.",
        impact: "high",
      });
    } else if (input.website_quality === "needs_improvement") {
      ops.push({
        code: "IMPROVABLE_WEBSITE",
        label: "Sitio web mejorable",
        description:
          "El sitio existe pero tiene carencias importantes. Una mejora profesional aumentaría su efectividad.",
        impact: "medium",
      });
    }
  }

  // ── Contact path ──────────────────────────────────────────────────────────
  if (!input.phone && !input.email && !input.has_website) {
    ops.push({
      code: "NO_CONTACT_PATH",
      label: "Sin canal de contacto digital",
      description:
        "No hay forma digital de contactarlos. Un sitio con formulario y datos de contacto sería transformador.",
      impact: "high",
    });
  } else if (input.has_website && !input.phone && !input.email) {
    ops.push({
      code: "POOR_DIGITAL_FUNNEL",
      label: "Embudo digital débil",
      description:
        "Tienen sitio web pero sin teléfono ni email visibles. Están perdiendo clientes potenciales en el último paso.",
      impact: "medium",
    });
  }

  // ── Instagram active but no web ───────────────────────────────────────────
  if (input.platform === "instagram" && !input.has_website && bioLen > 20) {
    ops.push({
      code: "INSTAGRAM_ACTIVE_NO_WEB",
      label: "Instagram activo sin web",
      description:
        "Tienen presencia activa en Instagram pero sin sitio web propio. Sus seguidores no tienen a dónde ir para comprar o contactarlos.",
      impact: "high",
    });
  }

  // ── Website-specific issues from quality analysis ─────────────────────────
  const hasNoContactOnSite = issues.some((i) => /contacto|contact/i.test(i));
  const isNotMobileFriendly = issues.some((i) => /mobile|móvil|viewport/i.test(i));
  const hasNoSSL = issues.some((i) => /ssl|https/i.test(i));

  if (input.has_website && hasNoContactOnSite) {
    ops.push({
      code: "NO_CONTACT_ON_SITE",
      label: "Web sin información de contacto",
      description:
        "El sitio no muestra datos de contacto claramente. Los visitantes no saben cómo comunicarse.",
      impact: "medium",
    });
  }

  if (input.has_website && isNotMobileFriendly) {
    ops.push({
      code: "NOT_MOBILE_FRIENDLY",
      label: "Sitio no adaptado a móviles",
      description:
        "El sitio no está optimizado para celulares. Más del 60% del tráfico web viene de dispositivos móviles.",
      impact: "medium",
    });
  }

  if (input.has_website && hasNoSSL) {
    ops.push({
      code: "NO_SSL",
      label: "Sin certificado SSL",
      description:
        "El sitio no usa HTTPS. Los navegadores lo marcan como inseguro, lo que aleja a los usuarios.",
      impact: "high",
    });
  }

  // ── Trust signals ─────────────────────────────────────────────────────────
  if (!input.location && !input.description && !input.has_website) {
    ops.push({
      code: "NO_TRUST_SIGNALS",
      label: "Sin señales de confianza",
      description:
        "Sin dirección, sin descripción, sin web. Un sitio profesional generaría credibilidad inmediata frente a sus competidores.",
      impact: "medium",
    });
  }

  // ── Generate summary ──────────────────────────────────────────────────────
  const highImpact = ops.filter((o) => o.impact === "high");
  let summary: string;

  if (ops.length === 0) {
    summary = "Presencia digital aceptable. Oportunidades de mejora menores.";
  } else if (highImpact.length >= 2) {
    summary = `Oportunidad fuerte: ${highImpact
      .slice(0, 2)
      .map((o) => o.label.toLowerCase())
      .join(" y ")}.`;
  } else if (highImpact.length === 1) {
    summary = `Oportunidad clara: ${highImpact[0].label.toLowerCase()}. ${
      ops.length > 1 ? `+${ops.length - 1} problema${ops.length > 2 ? "s" : ""} adicional.` : ""
    }`;
  } else {
    summary = `${ops.length} oportunidad${ops.length > 1 ? "es" : ""} de mejora detectada${ops.length > 1 ? "s" : ""}.`;
  }

  return { opportunities: ops, summary };
}
