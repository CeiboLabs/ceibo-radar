import { NextRequest, NextResponse } from "next/server";
import { isAiAvailable, callAI } from "@/lib/ai/aiService";

type Channel = "whatsapp" | "instagram" | "email";

const SYSTEM_PROMPT = `Eres un experto en ventas y marketing digital para una agencia de desarrollo web en Uruguay llamada Ceibo Labs.
Tu tarea es generar plantillas de mensajes en español para contactar a pequeñas y medianas empresas uruguayas y ofrecerles servicios de desarrollo web.
El tono debe ser profesional pero cercano, nunca agresivo ni demasiado vendedor.
Siempre devuelve un JSON con la clave "template" que contiene el texto del mensaje.
Usa las variables {{nombre}}, {{categoria}}, {{ubicacion}}, {{problema}}, {{solucion}} donde corresponda.`;

function buildPrompt(channel: Channel, category?: string): string {
  const categoryHint = category ? ` para negocios de tipo "${category}"` : "";

  if (channel === "email") {
    return `Genera una plantilla de email de prospección${categoryHint} para ofrecer servicios de desarrollo web.
El email debe:
- Comenzar con "Asunto: ..." en la primera línea como sugerencia del asunto
- Tener un saludo formal pero amigable
- Mencionar brevemente el problema digital que podría tener el negocio
- Proponer una solución sin entrar en detalles de precio
- Incluir un llamado a la acción claro (agendar una llamada, responder el email)
- Tener entre 5 y 8 oraciones
- Usar las variables disponibles: {{nombre}}, {{categoria}}, {{ubicacion}}, {{problema}}, {{solucion}}`;
  }

  return `Genera una plantilla de mensaje de ${channel === "whatsapp" ? "WhatsApp" : "Instagram DM"}${categoryHint} para ofrecer servicios de desarrollo web.
El mensaje debe:
- Ser conversacional y breve (3 a 5 oraciones)
- No sonar como spam ni mensaje masivo
- Mencionar algo específico del negocio o categoría para parecer personalizado
- Terminar con una pregunta o llamado a la acción sutil
- Usar las variables disponibles: {{nombre}}, {{categoria}}, {{ubicacion}}, {{problema}}, {{solucion}}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { channel?: Channel; category?: string };
  const { channel = "whatsapp", category } = body;

  const validChannels: Channel[] = ["whatsapp", "instagram", "email"];
  if (!validChannels.includes(channel)) {
    return NextResponse.json({ error: "Canal inválido" }, { status: 400 });
  }

  if (!isAiAvailable()) {
    return NextResponse.json(
      { error: "AI no disponible. Configura OPENAI_API_KEY en .env.local." },
      { status: 503 }
    );
  }

  try {
    const raw = await callAI(SYSTEM_PROMPT, buildPrompt(channel, category), 400);
    const parsed = JSON.parse(raw) as { template?: string };
    if (!parsed.template) {
      throw new Error("La respuesta de AI no incluye una plantilla");
    }
    return NextResponse.json({ template: parsed.template });
  } catch (err) {
    console.error("[templates/generate] Error:", err);
    return NextResponse.json(
      { error: "No se pudo generar la plantilla. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
