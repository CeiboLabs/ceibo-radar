import type { Lead } from "@/lib/types";
import type { NicheStats } from "./types";

export const LEAD_SYSTEM_PROMPT = `Eres un analista de ventas digitales para Ceibo Labs, una agencia web uruguaya. \
Analizas leads de negocios y respondes ÚNICAMENTE con JSON válido. \
Sé conciso, comercial y práctico. Enfocate en brechas digitales y oportunidades de negocio. \
Toda tu respuesta debe estar en español.`;

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

  return `Analiza este lead de negocio y responde únicamente con JSON válido:

${prompt}

Responde con exactamente esta estructura JSON:
{
  "summary": "Resumen comercial de 2-4 líneas de este negocio y la oportunidad. Conciso y directo.",
  "analysis": {
    "digital_weaknesses": ["debilidad 1", "debilidad 2"],
    "business_opportunities": ["oportunidad 1", "oportunidad 2"],
    "digital_maturity_assessment": "Una oración evaluando su nivel de madurez digital.",
    "missing_conversion_channels": ["canal 1", "canal 2"]
  },
  "premium_tier": "$"
}

Para premium_tier: "$" = cliente de bajo valor, "$$" = valor medio, "$$$" = alto valor.
Considera: categoría, ubicación, señales de marca, madurez digital, tamaño del negocio.
Máximo 2-3 items por array. Todo en español. Breve y útil.`;
}

export const NICHES_SYSTEM_PROMPT = `Eres un analista estratégico para Ceibo Labs, una agencia web uruguaya. \
Analizas estadísticas de leads y respondes ÚNICAMENTE con JSON válido. \
Identifica los mejores nichos de mercado para prospectar. Todo en español.`;

export function buildNichesPrompt(stats: NicheStats[]): string {
  const statsText = stats
    .map(
      (s) =>
        `- ${s.category}: ${s.total} leads, ${s.no_website} sin web (${s.total > 0 ? Math.round((s.no_website / s.total) * 100) : 0}%), ${s.poor_website} web deficiente, score promedio: ${s.avg_score}`
    )
    .join("\n");

  return `Analiza estas estadísticas de categorías de negocios para una agencia web uruguaya buscando nuevos clientes.

Datos por categoría (total leads, sin website, website deficiente, score promedio):
${statsText}

Identifica los TOP 5 nichos más prometedores. Considera: alto porcentaje sin web, mala presencia digital, atractivo comercial y valor del cliente.

Responde únicamente con JSON válido:
{
  "niches": [
    {
      "category": "nombre de categoría",
      "rank": 1,
      "opportunity_level": "high",
      "explanation": "Breve explicación de por qué esta categoría es atractiva para nuestra agencia"
    }
  ]
}

opportunity_level debe ser "high", "medium" o "low". Máximo 5 nichos. Todo en español.`;
}
