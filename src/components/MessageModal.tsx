"use client";

import { useState } from "react";
import type { Lead } from "@/lib/types";
import type { GeneratedMessages } from "@/lib/messages";

interface MessageModalProps {
  lead: Lead;
  onClose: () => void;
}

type Channel = "instagram" | "whatsapp" | "email";

const channelConfig: Record<Channel, { label: string; icon: string; color: string }> = {
  instagram: { label: "Instagram DM", icon: "📸", color: "border-pink-700 text-pink-400" },
  whatsapp:  { label: "WhatsApp",     icon: "💬", color: "border-ceibo-700 text-ceibo-400" },
  email:     { label: "Email",        icon: "✉️",  color: "border-blue-700 text-blue-400" },
};

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
        <>
          <svg className="w-3.5 h-3.5 text-ceibo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-ceibo-400">Copiado</span>
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copiar
        </>
      )}
    </button>
  );
}

export function MessageModal({ lead, onClose }: MessageModalProps) {
  const [activeChannel, setActiveChannel] = useState<Channel>("instagram");
  const [messages, setMessages] = useState<GeneratedMessages | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const data = await res.json();
      setMessages(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const getMessageText = (): string => {
    if (!messages) return "";
    if (activeChannel === "email") {
      return `Asunto: ${messages.email.subject}\n\n${messages.email.body}`;
    }
    return messages[activeChannel];
  };

  const websiteLabel = !lead.has_website
    ? "Sin website"
    : lead.website_quality === "poor"
    ? "Website deficiente"
    : lead.website_quality === "needs_improvement"
    ? "Website mejorable"
    : "Website bueno";

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
        <div className="flex items-start justify-between p-6 pb-4 border-b border-gray-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">✉️</span>
              <h2 className="text-base font-bold text-white">Generar mensaje</h2>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-400">{lead.name}</span>
              <span className="text-gray-700">·</span>
              <span className="text-xs text-gray-600">{websiteLabel}</span>
              {lead.location && (
                <>
                  <span className="text-gray-700">·</span>
                  <span className="text-xs text-gray-600">{lead.location.split(",")[0]}</span>
                </>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 mt-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Generate button */}
          {!messages && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="text-4xl">🤖</div>
              <div className="text-center">
                <p className="text-gray-300 font-medium">Generar mensajes personalizados</p>
                <p className="text-sm text-gray-500 mt-1">
                  Se generarán 3 variantes: Instagram DM, WhatsApp y Email
                </p>
              </div>
              <button
                onClick={generate}
                disabled={loading}
                className="flex items-center gap-2 bg-ceibo-600 hover:bg-ceibo-500 disabled:bg-gray-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Generando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Generar mensajes
                  </>
                )}
              </button>

              {error && (
                <p className="text-red-400 text-sm">{error}</p>
              )}
            </div>
          )}

          {/* Messages */}
          {messages && (
            <div className="space-y-4">
              {/* Mode badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                    messages.mode === "ai"
                      ? "bg-purple-950 border-purple-800 text-purple-400"
                      : "bg-gray-800 border-gray-700 text-gray-500"
                  }`}>
                    {messages.mode === "ai" ? "✨ Generado con IA" : "📝 Generado con templates"}
                  </span>
                </div>
                <button
                  onClick={generate}
                  disabled={loading}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
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
                        activeChannel === ch
                          ? `${cfg.color} bg-gray-800`
                          : "border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600"
                      }`}
                    >
                      <span>{cfg.icon}</span>
                      {cfg.label}
                    </button>
                  );
                })}
              </div>

              {/* Message content */}
              <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                {activeChannel === "email" && (
                  <div className="pb-3 border-b border-gray-700 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 uppercase tracking-wide">Asunto</span>
                    </div>
                    <p className="text-sm text-gray-200 font-medium">{messages.email.subject}</p>
                  </div>
                )}

                <div className="space-y-2">
                  {activeChannel !== "email" && (
                    <span className="text-xs text-gray-500 uppercase tracking-wide">Mensaje</span>
                  )}
                  {activeChannel === "email" && (
                    <span className="text-xs text-gray-500 uppercase tracking-wide">Cuerpo</span>
                  )}
                  <pre className="text-sm text-gray-200 whitespace-pre-wrap font-sans leading-relaxed">
                    {activeChannel === "email"
                      ? messages.email.body
                      : messages[activeChannel]}
                  </pre>
                </div>

                <div className="flex justify-end pt-2 border-t border-gray-700">
                  <CopyButton text={getMessageText()} />
                </div>
              </div>

              {/* Quick copy all */}
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(channelConfig) as Channel[]).map((ch) => {
                  const cfg = channelConfig[ch];
                  const text =
                    ch === "email"
                      ? `Asunto: ${messages.email.subject}\n\n${messages.email.body}`
                      : messages[ch];
                  return (
                    <div key={ch} className="bg-gray-800/50 border border-gray-800 rounded-lg p-3 space-y-2">
                      <span className="text-xs text-gray-500">{cfg.icon} {cfg.label}</span>
                      <CopyButton text={text} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-between">
          <p className="text-xs text-gray-600">
            Revisá el mensaje antes de enviarlo. No se envía automáticamente.
          </p>
          <button
            onClick={onClose}
            className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
