import type { LeadContext } from "./types";

/**
 * Builds the user prompt sent to Claude.
 * Separated here so it's easy to iterate on without touching generation logic.
 */
export function buildPrompt(ctx: LeadContext): string {
  const websiteStatus = !ctx.has_website
    ? "no tienen sitio web"
    : ctx.website_quality === "poor"
    ? "tienen un sitio web muy desactualizado y con problemas"
    : ctx.website_quality === "needs_improvement"
    ? "tienen un sitio web mejorable, con carencias importantes"
    : "tienen un sitio web aceptable";

  const platformSource =
    ctx.platform === "google_maps" ? "Google Maps" : "Instagram";

  const cityName = ctx.location
    ? ctx.location.split(",").find((p) => !/^\d/.test(p.trim()) && p.trim().length > 2)?.trim()
    : null;
  const locationPart = cityName ?? ctx.search_location?.split(",")[0].trim() ?? "";
  const categoryPart = ctx.keyword ? `(rubro: ${ctx.keyword})` : "";
  const bioPart = ctx.description
    ? `Su descripción/bio: "${ctx.description.slice(0, 150)}"`
    : "";

  return `
Genera 3 mensajes de contacto comercial para Ceibo Labs, una empresa de desarrollo web y software de Uruguay.

DATOS DEL NEGOCIO:
- Nombre: ${ctx.name}
- Ubicación: ${locationPart ? `en ${locationPart}` : "Uruguay"}
- Rubro/categoría: ${categoryPart || "negocio local"}
- Encontrado en: ${platformSource}
- Estado de su presencia digital: ${websiteStatus}
${bioPart ? `- ${bioPart}` : ""}

OBJETIVO: Ofrecerles ayuda con su presencia digital (crear o mejorar su sitio web).

REGLAS:
- Menciona el nombre del negocio de forma natural
- Tono humano, cercano, no robótico ni genérico
- NO uses frases como "espero que este mensaje te encuentre bien" ni clichés corporativos
- No exageres. Sé directo y genuino.
- En español rioplatense / uruguayo (tuteo natural)
- El CTA debe ser suave: invitar a conversar, no presionar
- Firma siempre como "Ceibo Labs"

Responde ÚNICAMENTE con un JSON válido con esta estructura exacta:
{
  "instagram": "<mensaje para Instagram DM, máximo 4 líneas, informal pero profesional>",
  "whatsapp": "<mensaje para WhatsApp, máximo 6 líneas, puede tener saltos de línea con \\n>",
  "email": {
    "subject": "<asunto del email, conciso>",
    "body": "<cuerpo del email, 6-8 líneas, más formal, con saludo y firma>"
  }
}
`.trim();
}

export const SYSTEM_PROMPT = `
Eres un experto en ventas y comunicación comercial para una empresa de desarrollo web uruguaya llamada Ceibo Labs.
Tu tarea es generar mensajes de outreach personalizados, genuinos y efectivos.
Respondes SIEMPRE con JSON válido, sin markdown, sin texto extra.
`.trim();
