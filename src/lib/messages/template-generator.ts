import type { GeneratedMessages, LeadContext } from "./types";

/**
 * Template-based fallback generator.
 * Uses lead.id to pick variants deterministically — same lead always gets
 * the same message, but different leads get different phrasings.
 */
export function generateWithTemplates(ctx: LeadContext): GeneratedMessages {
  const name = ctx.name;
  const city = extractCity(ctx.location) ?? ctx.search_location?.split(",")[0].trim() ?? "Uruguay";
  const v = ctx.id % 3; // 0, 1, or 2 — picks variant

  const situation = !ctx.has_website
    ? noWebsiteSituation(name, v)
    : weakWebsiteSituation(name, ctx.website_quality, v);

  return {
    instagram: buildInstagram(name, situation, v),
    whatsapp: buildWhatsapp(name, situation, city, v),
    email: buildEmail(name, situation, city, v),
    mode: "template",
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extracts the city name from a full address string.
 * "Av. Flores 123, 11800 Montevideo, Depto de Montevideo" → "Montevideo"
 */
function extractCity(location: string | null): string | null {
  if (!location) return null;
  // Look for known city patterns: "Montevideo", "Punta del Este", etc.
  // Strategy: take the segment after the first comma that doesn't start with a number (zip code)
  const parts = location.split(",").map((s) => s.trim());
  for (const part of parts.slice(1)) {
    // Skip parts that look like zip codes (start with digits)
    if (/^\d/.test(part)) continue;
    // Skip parts like "Departamento de X" — take just the X
    const deptMatch = part.match(/^(?:Departamento de|Depto\.?\s+de)\s+(.+)/i);
    if (deptMatch) return deptMatch[1].trim();
    // Otherwise use this part directly
    if (part.length > 2 && part.length < 40) return part;
  }
  // Fallback: look for a part that contains no digits
  return parts.find((p) => !/\d/.test(p) && p.length > 2) ?? null;
}

// ─── Situation phrases ────────────────────────────────────────────────────────

function noWebsiteSituation(name: string, v: number): string {
  return [
    `Vimos que ${name} todavía no tiene sitio web`,
    `Notamos que ${name} no cuenta con presencia web`,
    `${name} aún no tiene su sitio web`,
  ][v];
}

function weakWebsiteSituation(
  name: string,
  quality: LeadContext["website_quality"],
  v: number
): string {
  const adj =
    quality === "poor"
      ? ["muy desactualizado", "bastante desactualizado", "con bastante para mejorar"][v]
      : ["mejorable", "con bastante potencial sin explotar", "que podría rendir mucho más"][v];
  return [
    `Vimos que ${name} tiene un sitio web ${adj}`,
    `Notamos que el sitio web de ${name} está ${adj}`,
    `El sitio web de ${name} se ve ${adj}`,
  ][v];
}

// ─── Channel builders ─────────────────────────────────────────────────────────

function buildInstagram(name: string, situation: string, v: number): string {
  const intros = [
    `Hola! 👋 ${situation} y pensamos que podríamos ayudarles.`,
    `Buenas! ${situation} — desde Ceibo Labs trabajamos exactamente en eso.`,
    `Hola! Pasamos por el perfil de ${name} y ${situation}.`,
  ];
  const ctas = [
    `¿Les interesaría conversar sobre cómo mejorar su presencia online?`,
    `Si les interesa, con gusto les contamos cómo lo encaramos. Sin compromiso.`,
    `¿Tienen unos minutos para que les cuente la propuesta?`,
  ];
  return `${intros[v]}\n\nSomos Ceibo Labs, un equipo de desarrollo web uruguayo. ${ctas[v]}`;
}

function buildWhatsapp(
  name: string,
  situation: string,
  city: string,
  v: number
): string {
  const intros = [
    `Hola! Les escribimos desde *Ceibo Labs*, somos un equipo de desarrollo web de ${city}.`,
    `Buenas! Somos *Ceibo Labs*, una empresa de desarrollo web uruguaya.`,
    `Hola! Les contactamos desde *Ceibo Labs*, desarrolladores web en Uruguay.`,
  ];
  const middles = [
    `${situation} y creemos que podemos ayudarles a tener una presencia digital que realmente les traiga clientes.`,
    `${situation}. Nos especializamos en ayudar a negocios locales a crecer con una web profesional.`,
    `Vimos su perfil y ${situation.toLowerCase()}. Trabajamos con negocios como el de ustedes para mejorar su presencia online.`,
  ];
  const ctas = [
    `¿Podrían tener una llamada corta esta semana para contarles nuestra propuesta?`,
    `¿Les interesa que les mandemos más información?`,
    `Sin compromiso — ¿tienen 15 minutos para conversar?`,
  ];
  return `${intros[v]}\n\n${middles[v]}\n\n${ctas[v]}`;
}

function buildEmail(
  name: string,
  situation: string,
  city: string,
  v: number
): { subject: string; body: string } {
  const subjects = [
    `Presencia digital para ${name}`,
    `Tu sitio web — una oportunidad para ${name}`,
    `Ceibo Labs × ${name}: presencia online profesional`,
  ];

  const greetings = [
    `Hola, equipo de ${name}:`,
    `Buen día,`,
    `Hola!`,
  ];

  const bodies = [
    `${greetings[v]}\n\n${situation}. Desde Ceibo Labs — un estudio de desarrollo web uruguayo — trabajamos con negocios en ${city} para construir presencias digitales que realmente funcionen.\n\nEntendemos que muchas veces estos proyectos se postegan o parecen complicados. Nuestra propuesta es simple: un sitio profesional, sin vueltas, a un precio accesible para el mercado local.\n\n¿Tienen 15 minutos para una llamada esta semana? Con gusto les contamos cómo podríamos trabajar juntos.\n\nSaludos,\nCeibo Labs\nhttps://ceibo.dev`,
    `${greetings[v]}\n\n${situation}. Soy del equipo de Ceibo Labs, un estudio de desarrollo web con base en Uruguay.\n\nNos dedicamos a ayudar a negocios locales a crecer en internet — desde cero o mejorando lo que ya tienen. Hemos trabajado con comercios y servicios en ${city} y siempre enfocamos en resultados concretos para el negocio.\n\n¿Podríamos agendar una conversación corta? Queremos entender bien su negocio antes de proponer cualquier cosa.\n\nQueremos saludos,\nCeibo Labs\nhttps://ceibo.dev`,
    `${greetings[v]}\n\n${situation}. Les escribo desde Ceibo Labs, una empresa de desarrollo web uruguaya.\n\nCreemos que ${name} tiene un gran potencial que todavía no se está aprovechando en el canal digital. Nuestro trabajo es exactamente ese: hacer que los buenos negocios se vean tan bien online como lo que ofrecen.\n\nSi les parece, ¿puedo enviarles un resumen rápido de lo que haríamos para ustedes?\n\nMuchas gracias por su tiempo,\nCeibo Labs\nhttps://ceibo.dev`,
  ];

  return {
    subject: subjects[v],
    body: bodies[v],
  };
}
