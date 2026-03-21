import type { LeadPriority, Platform, WebsiteQuality } from "./types";

// ─── Configurable weights ────────────────────────────────────────────────────
export const SCORE_WEIGHTS = {
  // Opportunity: how much does this business need web services?
  no_website: 40,
  website_poor: 30,              // quality score 0–39
  website_needs_improvement: 20, // quality score 40–69
  website_good: 0,               // 70+ — not a target

  // Reachability: can we actually contact them?
  has_phone: 15,
  has_email: 15,
  both_phone_and_email: 5,

  // Profile richness: is this a real, active business?
  has_location: 8,
  has_description: 7,

  // Business signals: strong fit for Ceibo Labs?
  instagram_active: 5,    // Instagram lead with meaningful bio
  category_relevant: 5,   // Category is a high-value target for web development
} as const;

// ─── Priority thresholds ─────────────────────────────────────────────────────
export const PRIORITY_THRESHOLDS = {
  high: 65,   // >= 65 → High Priority
  medium: 35, // >= 35 → Medium Priority
               // < 35  → Low Priority
} as const;

// ─── Categories that are strong opportunities for a web dev agency ────────────
const RELEVANT_CATEGORY_KEYWORDS = [
  "gym", "gimnasio", "fitness", "yoga", "pilates",
  "peluquería", "peluqueria", "salon", "salón", "estética", "estetica", "spa", "barbería", "barberia",
  "restaurante", "restaurant", "bar", "café", "cafe", "cantina", "parrilla", "pizzería",
  "dentista", "odontología", "médico", "medico", "doctor", "clínica", "clinica", "farmacia",
  "abogado", "estudio jurídico", "arquitecto", "diseño", "diseñador",
  "hotel", "hostel", "turismo", "agencia de viajes",
  "ropa", "moda", "fashion", "boutique", "indumentaria",
  "inmobiliaria", "bienes raíces", "construcción",
  "tienda", "shop", "comercio", "venta",
  "taller", "mecánica", "automotriz",
  "educación", "academia", "escuela", "tutoría",
];

// ─── Types ───────────────────────────────────────────────────────────────────
export interface ScoreBreakdown {
  label: string;
  points: number;
}

export interface LeadScoreResult {
  score: number;
  priority: LeadPriority;
  breakdown: ScoreBreakdown[];
}

interface ScoringInput {
  has_website: boolean | number;
  website_quality?: WebsiteQuality | null;
  phone?: string | null;
  email?: string | null;
  location?: string | null;
  description?: string | null;
  platform?: Platform;
  category?: string | null;
}

// ─── Core function ────────────────────────────────────────────────────────────
export function scorelead(input: ScoringInput): LeadScoreResult {
  const breakdown: ScoreBreakdown[] = [];
  let total = 0;

  const hasWebsite = Boolean(input.has_website);

  // --- Website opportunity ---
  if (!hasWebsite) {
    breakdown.push({ label: "Sin website", points: SCORE_WEIGHTS.no_website });
    total += SCORE_WEIGHTS.no_website;
  } else {
    const q = input.website_quality ?? null;
    if (q === "poor") {
      breakdown.push({ label: "Website deficiente", points: SCORE_WEIGHTS.website_poor });
      total += SCORE_WEIGHTS.website_poor;
    } else if (q === "needs_improvement") {
      breakdown.push({ label: "Website mejorable", points: SCORE_WEIGHTS.website_needs_improvement });
      total += SCORE_WEIGHTS.website_needs_improvement;
    }
  }

  // --- Reachability ---
  const hasPhone = Boolean(input.phone?.trim());
  const hasEmail = Boolean(input.email?.trim());

  if (hasPhone) {
    breakdown.push({ label: "Tiene teléfono", points: SCORE_WEIGHTS.has_phone });
    total += SCORE_WEIGHTS.has_phone;
  }
  if (hasEmail) {
    breakdown.push({ label: "Tiene email", points: SCORE_WEIGHTS.has_email });
    total += SCORE_WEIGHTS.has_email;
  }
  if (hasPhone && hasEmail) {
    breakdown.push({ label: "Tel + email (bonus)", points: SCORE_WEIGHTS.both_phone_and_email });
    total += SCORE_WEIGHTS.both_phone_and_email;
  }

  // --- Profile richness ---
  if (input.location?.trim()) {
    breakdown.push({ label: "Tiene ubicación", points: SCORE_WEIGHTS.has_location });
    total += SCORE_WEIGHTS.has_location;
  }
  if (input.description?.trim()) {
    breakdown.push({ label: "Tiene descripción", points: SCORE_WEIGHTS.has_description });
    total += SCORE_WEIGHTS.has_description;
  }

  // --- Business signals ---
  const bioLength = input.description?.trim()?.length ?? 0;
  if (input.platform === "instagram" && bioLength > 20) {
    breakdown.push({ label: "Instagram activo", points: SCORE_WEIGHTS.instagram_active });
    total += SCORE_WEIGHTS.instagram_active;
  }

  const catLower = (input.category ?? "").toLowerCase();
  if (catLower && RELEVANT_CATEGORY_KEYWORDS.some((kw) => catLower.includes(kw))) {
    breakdown.push({ label: "Categoría relevante", points: SCORE_WEIGHTS.category_relevant });
    total += SCORE_WEIGHTS.category_relevant;
  }

  const score = Math.min(100, Math.max(0, total));

  const priority: LeadPriority =
    score >= PRIORITY_THRESHOLDS.high
      ? "high"
      : score >= PRIORITY_THRESHOLDS.medium
      ? "medium"
      : "low";

  return { score, priority, breakdown };
}
