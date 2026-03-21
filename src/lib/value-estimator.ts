import type { EnrichmentData, Platform, WebsiteQuality } from "./types";

export type EstimatedValue = "low" | "medium" | "high";

export interface ValueResult {
  value: EstimatedValue;
  label: "$" | "$$" | "$$$";
  reason: string;
}

interface ValueInput {
  category: string | null;
  has_website: boolean;
  website_quality: WebsiteQuality | null;
  platform: Platform;
  description: string | null;
  location: string | null;
  enrichment: EnrichmentData;
}

// ── Category tiers ────────────────────────────────────────────────────────────
// High ticket: businesses that invest more in professional services
const HIGH_VALUE_KEYWORDS = [
  "hotel", "hostel", "resort",
  "clínica", "clinica", "médico", "medico", "doctor", "odontología", "odontologia", "dentista", "farmacia",
  "abogado", "estudio jurídico", "estudio juridico", "notario",
  "arquitecto", "arquitectura", "constructora", "construcción",
  "inmobiliaria", "bienes raíces", "bienes raices",
  "agencia de viajes", "turismo",
  "colegio", "escuela privada", "instituto",
  "franquicia", "cadena", "sucursales",
];

// Medium ticket: good fit, moderate budgets
const MEDIUM_VALUE_KEYWORDS = [
  "gym", "gimnasio", "fitness", "yoga", "pilates", "crossfit",
  "spa", "salón de belleza", "salon de belleza", "peluquería", "peluqueria", "barbería", "barberia",
  "estética", "estetica", "centro estético",
  "restaurante", "restaurant", "café", "cafe", "bar", "pizzería", "pizzeria", "parrilla", "cantina",
  "boutique", "moda", "fashion", "ropa", "indumentaria",
  "taller", "mecánica", "mecanica", "automotriz",
  "academia", "tutoría", "tutoria",
  "catering", "eventos",
];

/**
 * Estimates potential client value for Ceibo Labs based on available data.
 * Returns tier ($, $$, $$$) and a brief justification.
 * All estimates are heuristic — used for prioritization only.
 */
export function estimateClientValue(input: ValueInput): ValueResult {
  const catLower = (input.category ?? "").toLowerCase();
  const descLower = (input.description ?? "").toLowerCase();
  const combined = `${catLower} ${descLower}`;

  const isHighCategory = HIGH_VALUE_KEYWORDS.some((kw) => combined.includes(kw));
  const isMediumCategory = MEDIUM_VALUE_KEYWORDS.some((kw) => combined.includes(kw));
  const isMediumSized = input.enrichment.business_size === "medium";
  const sellsOnline = input.enrichment.sells_online === true;

  // ── High value ────────────────────────────────────────────────────────────
  if (isHighCategory || isMediumSized) {
    const reason = isHighCategory
      ? "Categoría de alto ticket — estos negocios invierten en presencia digital profesional"
      : "Señales de negocio mediano con mayor capacidad de inversión";
    return { value: "high", label: "$$$", reason };
  }

  // ── Medium value ──────────────────────────────────────────────────────────
  if (isMediumCategory || !input.has_website || input.website_quality === "poor" || sellsOnline) {
    let reason = "Categoría con presupuesto moderado para servicios web";
    if (!input.has_website) reason = "Necesita sitio desde cero — proyecto integral con buen margen";
    else if (input.website_quality === "poor") reason = "Sitio actual requiere rediseño completo";
    else if (sellsOnline) reason = "Señales de e-commerce — potencial para tienda online profesional";
    return { value: "medium", label: "$$", reason };
  }

  // ── Low value ─────────────────────────────────────────────────────────────
  return {
    value: "low",
    label: "$",
    reason: "Proyecto de entrada o mejora puntual de sitio existente",
  };
}
