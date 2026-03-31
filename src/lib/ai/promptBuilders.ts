import type { Lead } from "@/lib/types";
import type { NicheStats } from "./types";

export const LEAD_SYSTEM_PROMPT = `Analista de ventas de Ceibo Labs (agencia web Uruguay). Responde SOLO JSON válido en español. Breve y comercial.`;

export function buildLeadPrompt(lead: Lead): string {
  const lines: string[] = [
    `Negocio: ${lead.name}`,
  ];

  if (lead.category) lines.push(`Categoría: ${lead.category}`);
  if (lead.location) lines.push(`Ubicación: ${lead.location}`);
  if (lead.description) lines.push(`Descripción: ${lead.description}`);

  lines.push(`Tiene website: ${lead.has_website ? "Sí" : "No"}`);

  if (lead.has_website && lead.website_quality) {
    lines.push(`Calidad del website: ${lead.website_quality} (score ${lead.website_quality_score ?? "?"}/100)`);
    if (lead.website_quality_summary) lines.push(`Resumen del website: ${lead.website_quality_summary}`);
  }

  lines.push(`Plataforma de origen: ${lead.platform === "google_maps" ? "Google Maps" : "Instagram"}`);
  lines.push(`Tiene teléfono: ${lead.phone ? "Sí" : "No"}`);
  lines.push(`Tiene email: ${lead.email ? "Sí" : "No"}`);

  if (lead.enrichment_data) {
    try {
      const e = JSON.parse(lead.enrichment_data);
      lines.push(`Nivel de actividad: ${e.activity_level}`);
      lines.push(`Madurez digital: ${e.digital_maturity}`);
      lines.push(`Presencia social: ${e.social_quality}`);
      if (e.business_size !== "unknown") lines.push(`Tamaño del negocio: ${e.business_size}`);
    } catch {}
  }

  const prompt = lines.join("\n");

  return `Analiza este lead y responde SOLO con JSON:

${prompt}

{"summary":"2 líneas max sobre oportunidad","analysis":{"digital_weaknesses":["max 2"],"business_opportunities":["max 2"],"digital_maturity_assessment":"1 oración","missing_conversion_channels":["max 2"]},"premium_tier":"$"}

premium_tier: "$"=bajo valor, "$$"=medio, "$$$"=alto. Todo en español.`;
}

export const NICHES_SYSTEM_PROMPT = `Analista estratégico de Ceibo Labs (agencia web Uruguay). Responde SOLO JSON válido en español.`;

export function buildNichesPrompt(stats: NicheStats[]): string {
  const statsText = stats
    .map(
      (s) =>
        `- ${s.category}: ${s.total} leads, ${s.no_website} sin web (${s.total > 0 ? Math.round((s.no_website / s.total) * 100) : 0}%), ${s.poor_website} web deficiente, score promedio: ${s.avg_score}`
    )
    .join("\n");

  return `Top 5 nichos para agencia web Uruguay. Datos (categoría: total, sin web %, score):
${statsText}

{"niches":[{"category":"...","rank":1,"opportunity_level":"high","explanation":"1 oración"}]}
opportunity_level: high/medium/low. Max 5. Español.`;
}
