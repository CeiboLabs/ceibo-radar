import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { callAI, isAiAvailable } from "@/lib/ai/aiService";
import type { Lead } from "@/lib/types";

const SYSTEM_PROMPT = `Eres un experto en ventas para Ceibo Labs, una empresa de desarrollo web uruguaya.
Analizás el perfil de un negocio y generás dos fragmentos de texto en español rioplatense:
- "problema": la situación digital específica del negocio (1 frase corta, directa, no genérica)
- "solucion": lo que Ceibo Labs puede hacer por ellos (1 frase concreta)
Respondé siempre con JSON: { "problema": "...", "solucion": "..." }`;

function buildPrompt(lead: Lead): string {
  const websiteStatus = !lead.has_website
    ? "no tiene sitio web"
    : lead.website_quality === "poor"
    ? "tiene un sitio web muy desactualizado"
    : lead.website_quality === "needs_improvement"
    ? "tiene un sitio web mejorable con carencias importantes"
    : "tiene un sitio web aceptable";

  const city = lead.location?.split(",")[0]?.trim() ?? lead.search_location?.split(",")[0]?.trim() ?? "Uruguay";

  return `Negocio: "${lead.name}"
Rubro: ${lead.category ?? "negocio local"}
Ciudad: ${city}
Web: ${websiteStatus}
${lead.description ? `Descripción: ${lead.description.slice(0, 150)}` : ""}

Generá "problema" y "solucion" específicos para este negocio.`;
}

function applyLiteralVars(template: string, lead: Lead): string {
  const city = lead.location?.split(",")[0]?.trim() ?? lead.search_location?.split(",")[0]?.trim() ?? "Uruguay";
  return template
    .replace(/\{\{nombre\}\}/gi, lead.name ?? "")
    .replace(/\{\{categoria\}\}/gi, lead.category ?? "negocio")
    .replace(/\{\{ubicacion\}\}/gi, city);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { leadId: number; template: string };
  const { leadId, template } = body;

  if (!leadId || !template) {
    return NextResponse.json({ error: "leadId and template required" }, { status: 400 });
  }

  const { data: lead, error } = await supabase.from("leads").select("*").eq("id", leadId).single();
  if (error || !lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const l = lead as Lead;

  // Apply literal replacements first
  let message = applyLiteralVars(template, l);

  // Check if AI-generated variables are needed
  const needsAI = /\{\{(problema|solucion)\}\}/i.test(message);

  if (needsAI) {
    if (!isAiAvailable()) {
      // Fallback: replace with generic text
      const websiteStatus = !l.has_website ? "sin sitio web" : "sitio web mejorable";
      message = message
        .replace(/\{\{problema\}\}/gi, websiteStatus)
        .replace(/\{\{solucion\}\}/gi, "una presencia digital profesional");
    } else {
      try {
        const raw = await callAI(SYSTEM_PROMPT, buildPrompt(l), 200);
        const parsed = JSON.parse(raw) as { problema?: string; solucion?: string };
        message = message
          .replace(/\{\{problema\}\}/gi, parsed.problema ?? "su situación digital actual")
          .replace(/\{\{solucion\}\}/gi, parsed.solucion ?? "una web profesional que les traiga clientes");
      } catch {
        message = message
          .replace(/\{\{problema\}\}/gi, "su presencia digital actual")
          .replace(/\{\{solucion\}\}/gi, "una web profesional");
      }
    }
  }

  return NextResponse.json({ message });
}
