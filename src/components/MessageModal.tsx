"use client";

import { useState } from "react";
import type { Lead } from "@/lib/types";
import type { GeneratedMessages } from "@/lib/messages";

interface MessageModalProps {
  lead: Lead;
  onClose: () => void;
}

type Channel = "instagram" | "whatsapp" | "email";
type Tab = "templates" | "free";

interface SavedTemplate {
  id: string;
  name: string;
  channel: Channel;
  content: string;
}

const STORAGE_KEY = "ceibo_templates";

const channelConfig: Record<Channel, { label: string; icon: string; color: string }> = {
  instagram: { label: "Instagram DM", icon: "📸", color: "border-pink-700 text-pink-400" },
  whatsapp:  { label: "WhatsApp",     icon: "💬", color: "border-ceibo-700 text-ceibo-400" },
  email:     { label: "Email",        icon: "✉️",  color: "border-blue-700 text-blue-400" },
};

function loadTemplates(): SavedTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as SavedTemplate[];
  } catch { return []; }
}

function cleanPhone(phone: string): string {
  // Remove spaces, dashes, parentheses; keep + and digits
  return phone.replace(/[\s\-().]/g, "");
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors"
    >
      {copied ? (
        <><svg className="w-3.5 h-3.5 text-ceibo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg><span className="text-ceibo-400">Copiado</span></>
      ) : (
        <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copiar</>
      )}
    </button>
  );
}

export function MessageModal({ lead, onClose }: MessageModalProps) {
  const [tab, setTab] = useState<Tab>("templates");
  const [activeChannel, setActiveChannel] = useState<Channel>("whatsapp");

  // Templates tab
  const templates = loadTemplates();
  const [selectedTemplate, setSelectedTemplate] = useState<SavedTemplate | null>(
    templates.length > 0 ? templates[0] : null
  );
  const [applying, setApplying] = useState(false);
  const [appliedMessage, setAppliedMessage] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  // Free generation tab
  const [messages, setMessages] = useState<GeneratedMessages | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Template tab handlers ────────────────────────────────────────────────────
  const handleSelectTemplate = (t: SavedTemplate) => {
    setSelectedTemplate(t);
    setAppliedMessage(null);
    setApplyError(null);
  };

  const handleApply = async () => {
    if (!selectedTemplate) return;
    setApplying(true);
    setApplyError(null);
    try {
      const res = await fetch("/api/messages/from-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, template: selectedTemplate.content }),
      });
      const data = await res.json() as { message?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Error al aplicar plantilla");
      setAppliedMessage(data.message ?? "");
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setApplying(false);
    }
  };

  // ── Free generation handlers ─────────────────────────────────────────────────
  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id }),
      });
      if (!res.ok) throw new Error("Error generando mensajes");
      setMessages(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const getFreeMessageText = (): string => {
    if (!messages) return "";
    if (activeChannel === "email") return `Asunto: ${messages.email.subject}\n\n${messages.email.body}`;
    return messages[activeChannel];
  };

  // ── Contact links ────────────────────────────────────────────────────────────
  const waLink = lead.phone ? `https://wa.me/${cleanPhone(lead.phone).replace(/^\+/, "")}` : null;
  const emailLink = lead.email ? `mailto:${lead.email}` : null;

  // Header info
  const websiteLabel = !lead.has_website ? "Sin website" :
    lead.website_quality === "poor" ? "Website deficiente" :
    lead.website_quality === "needs_improvement" ? "Website mejorable" : "Website bueno";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 pb-4 border-b border-gray-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base">✉️</span>
              <h2 className="text-base font-bold text-white">Mensaje para {lead.name}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-xs text-gray-600">{websiteLabel}</span>
              {lead.location && <><span className="text-gray-700">·</span><span className="text-xs text-gray-600">{lead.location.split(",")[0]}</span></>}
              {waLink && (
                <a href={waLink} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-ceibo-950 border border-ceibo-800 text-ceibo-400 hover:bg-ceibo-900 transition-colors">
                  💬 WhatsApp
                </a>
              )}
              {emailLink && (
                <a href={emailLink}
                  className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-950 border border-blue-800 text-blue-400 hover:bg-blue-900 transition-colors">
                  ✉ Email
                </a>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 mt-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-4">
          <button
            onClick={() => setTab("templates")}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              tab === "templates" ? "bg-gray-800 text-white" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            📋 Desde plantilla
          </button>
          <button
            onClick={() => setTab("free")}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              tab === "free" ? "bg-gray-800 text-white" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            🤖 Generar libre
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* ── Templates tab ────────────────────────────────────────────────── */}
          {tab === "templates" && (
            <>
              {templates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 space-y-3 text-center">
                  <div className="text-3xl">📋</div>
                  <p className="text-gray-400 font-medium text-sm">No tenés plantillas guardadas</p>
                  <p className="text-xs text-gray-600">Creá plantillas desde el botón "Plantillas" en la pantalla principal.<br/>Podés usar variables como <code className="text-ceibo-400">{"{{problema}}"}</code> que la IA va a rellenar según el lead.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Template list */}
                  <div className="grid grid-cols-2 gap-2">
                    {templates.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleSelectTemplate(t)}
                        className={`text-left p-3 rounded-xl border transition-colors ${
                          selectedTemplate?.id === t.id
                            ? "bg-ceibo-950/40 border-ceibo-700"
                            : "bg-gray-800/50 border-gray-700 hover:border-gray-600"
                        }`}
                      >
                        <div className="text-sm font-medium text-white truncate">{t.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5 capitalize">{channelConfig[t.channel]?.icon} {channelConfig[t.channel]?.label}</div>
                      </button>
                    ))}
                  </div>

                  {/* Selected template preview */}
                  {selectedTemplate && (
                    <div className="space-y-3">
                      <div className="bg-gray-800 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Vista previa</span>
                          <span className="text-xs text-gray-600">{channelConfig[selectedTemplate.channel]?.icon} {channelConfig[selectedTemplate.channel]?.label}</span>
                        </div>
                        {/* Highlight variables in preview */}
                        <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                          {selectedTemplate.content.split(/(\{\{[^}]+\}\})/g).map((part, i) =>
                            /^\{\{[^}]+\}\}$/.test(part)
                              ? <span key={i} className={`font-mono text-xs px-1 py-0.5 rounded ${
                                  /problema|solucion/i.test(part)
                                    ? "bg-purple-950 text-purple-400 border border-purple-800"
                                    : "bg-ceibo-950 text-ceibo-400 border border-ceibo-800"
                                }`}>{part}</span>
                              : <span key={i}>{part}</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-600 mt-3">
                          Las variables <span className="text-purple-400 font-mono">{"{{problema}}"}</span> y <span className="text-purple-400 font-mono">{"{{solucion}}"}</span> se generan con IA según el perfil del lead.
                        </p>
                      </div>

                      {applyError && (
                        <div className="rounded-lg bg-red-950/50 border border-red-800 px-3 py-2 text-xs text-red-400">
                          {applyError}
                        </div>
                      )}

                      {!appliedMessage ? (
                        <button
                          onClick={handleApply}
                          disabled={applying}
                          className="w-full flex items-center justify-center gap-2 bg-ceibo-600 hover:bg-ceibo-500 disabled:bg-gray-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
                        >
                          {applying ? (
                            <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>Personalizando con IA...</>
                          ) : (
                            <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>Aplicar para {lead.name}</>
                          )}
                        </button>
                      ) : (
                        <div className="space-y-3">
                          <div className="bg-gray-800 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-ceibo-400 uppercase tracking-wide">✨ Mensaje listo</span>
                              <button
                                onClick={() => { setAppliedMessage(null); }}
                                className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
                              >
                                ↩ Cambiar
                              </button>
                            </div>
                            <pre className="text-sm text-gray-200 whitespace-pre-wrap font-sans leading-relaxed">
                              {appliedMessage}
                            </pre>
                          </div>
                          <div className="flex items-center gap-2">
                            <CopyButton text={appliedMessage} />
                            {waLink && selectedTemplate.channel === "whatsapp" && (
                              <a
                                href={`${waLink}?text=${encodeURIComponent(appliedMessage)}`}
                                target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-ceibo-900 border border-ceibo-700 text-ceibo-300 hover:bg-ceibo-800 transition-colors"
                              >
                                💬 Abrir en WhatsApp
                              </a>
                            )}
                            {emailLink && selectedTemplate.channel === "email" && (
                              <a
                                href={emailLink}
                                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-950 border border-blue-800 text-blue-300 hover:bg-blue-900 transition-colors"
                              >
                                ✉ Abrir email
                              </a>
                            )}
                            <button
                              onClick={handleApply}
                              className="ml-auto text-xs text-gray-600 hover:text-gray-400 flex items-center gap-1 transition-colors"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                              Regenerar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── Free generation tab ──────────────────────────────────────────── */}
          {tab === "free" && (
            <>
              {!messages ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-4">
                  <div className="text-4xl">🤖</div>
                  <div className="text-center">
                    <p className="text-gray-300 font-medium">Generar mensajes personalizados</p>
                    <p className="text-sm text-gray-500 mt-1">3 variantes listas: Instagram DM, WhatsApp y Email</p>
                  </div>
                  <button
                    onClick={generate}
                    disabled={loading}
                    className="flex items-center gap-2 bg-ceibo-600 hover:bg-ceibo-500 disabled:bg-gray-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors"
                  >
                    {loading ? (
                      <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>Generando...</>
                    ) : (
                      <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>Generar mensajes</>
                    )}
                  </button>
                  {error && <p className="text-red-400 text-sm">{error}</p>}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      messages.mode === "ai"
                        ? "bg-purple-950 border-purple-800 text-purple-400"
                        : "bg-gray-800 border-gray-700 text-gray-500"
                    }`}>
                      {messages.mode === "ai" ? "✨ Generado con IA" : "📝 Templates"}
                    </span>
                    <button onClick={generate} disabled={loading} className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      Regenerar
                    </button>
                  </div>

                  {/* Channel tabs */}
                  <div className="flex gap-2">
                    {(Object.keys(channelConfig) as Channel[]).map((ch) => {
                      const cfg = channelConfig[ch];
                      return (
                        <button
                          key={ch}
                          onClick={() => setActiveChannel(ch)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            activeChannel === ch ? `${cfg.color} bg-gray-800` : "border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600"
                          }`}
                        >
                          <span>{cfg.icon}</span>{cfg.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Message */}
                  <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                    {activeChannel === "email" && (
                      <div className="pb-3 border-b border-gray-700">
                        <span className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Asunto</span>
                        <p className="text-sm text-gray-200 font-medium">{messages.email.subject}</p>
                      </div>
                    )}
                    <pre className="text-sm text-gray-200 whitespace-pre-wrap font-sans leading-relaxed">
                      {activeChannel === "email" ? messages.email.body : messages[activeChannel]}
                    </pre>
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-700">
                      <CopyButton text={getFreeMessageText()} />
                      {waLink && activeChannel === "whatsapp" && (
                        <a
                          href={`${waLink}?text=${encodeURIComponent(messages.whatsapp)}`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-ceibo-900 border border-ceibo-700 text-ceibo-300 hover:bg-ceibo-800 transition-colors"
                        >
                          💬 Abrir en WhatsApp
                        </a>
                      )}
                      {emailLink && activeChannel === "email" && (
                        <a href={emailLink} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-950 border border-blue-800 text-blue-300 hover:bg-blue-900 transition-colors">
                          ✉ Abrir email
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-800 flex items-center justify-between">
          <p className="text-xs text-gray-700">Revisá el mensaje antes de enviar.</p>
          <button onClick={onClose} className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Cerrar</button>
        </div>
      </div>
    </div>
  );
}
