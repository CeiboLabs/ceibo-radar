"use client";

import { useState, useEffect, useRef } from "react";

interface Template {
  id: string;
  name: string;
  channel: "whatsapp" | "instagram" | "email";
  content: string;
  createdAt: string;
}

interface TemplatesModalProps {
  onClose: () => void;
}

const STORAGE_KEY = "ceibo_templates";
const VARIABLES = ["{{nombre}}", "{{categoria}}", "{{ubicacion}}", "{{problema}}", "{{solucion}}"];

const CHANNEL_LABELS: Record<Template["channel"], string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  email: "Email",
};

function loadTemplates(): Template[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as Template[];
  } catch {
    return [];
  }
}

function saveTemplates(templates: Template[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export default function TemplatesModal({ onClose }: TemplatesModalProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<Template["channel"]>("whatsapp");
  const [content, setContent] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTemplates(loadTemplates());
  }, []);

  const selected = templates.find((t) => t.id === selectedId) ?? null;

  function startNew() {
    setSelectedId(null);
    setName("");
    setChannel("whatsapp");
    setContent("");
    setGenerateError(null);
  }

  function selectTemplate(t: Template) {
    setSelectedId(t.id);
    setName(t.name);
    setChannel(t.channel);
    setContent(t.content);
    setGenerateError(null);
  }

  function insertVariable(v: string) {
    const el = textareaRef.current;
    if (!el) {
      setContent((c) => c + v);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newContent = content.slice(0, start) + v + content.slice(end);
    setContent(newContent);
    // Restore cursor after the inserted variable
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = start + v.length;
      el.selectionEnd = start + v.length;
    });
  }

  function handleSave() {
    if (!name.trim() || !content.trim()) {
      setSaveMsg("El nombre y contenido son requeridos.");
      setTimeout(() => setSaveMsg(null), 3000);
      return;
    }

    let updated: Template[];
    if (selectedId) {
      updated = templates.map((t) =>
        t.id === selectedId ? { ...t, name, channel, content } : t
      );
    } else {
      const newTemplate: Template = {
        id: crypto.randomUUID(),
        name,
        channel,
        content,
        createdAt: new Date().toISOString(),
      };
      updated = [...templates, newTemplate];
      setSelectedId(newTemplate.id);
    }

    setTemplates(updated);
    saveTemplates(updated);
    setSaveMsg("Guardado");
    setTimeout(() => setSaveMsg(null), 2000);
  }

  function handleDelete() {
    if (!selectedId) return;
    const updated = templates.filter((t) => t.id !== selectedId);
    setTemplates(updated);
    saveTemplates(updated);
    startNew();
  }

  async function handleGenerate() {
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/templates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, category: name.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Error al generar");
      }
      const data = await res.json() as { template: string };
      setContent(data.template);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-4xl mx-4 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
          <h2 className="text-lg font-semibold text-white">Plantillas de Mensajes</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Cerrar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* Left — template list */}
          <div className="w-64 flex-shrink-0 border-r border-gray-800 flex flex-col">
            <div className="p-3 border-b border-gray-800">
              <button
                onClick={startNew}
                className="w-full py-2 px-3 rounded-lg text-sm font-medium bg-ceibo-600 hover:bg-ceibo-700 text-white transition-colors"
              >
                + Nueva plantilla
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {templates.length === 0 && (
                <p className="text-xs text-gray-500 text-center py-6">Sin plantillas guardadas</p>
              )}
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => selectTemplate(t)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors group ${
                    selectedId === t.id
                      ? "bg-ceibo-600/20 border border-ceibo-700"
                      : "hover:bg-gray-800 border border-transparent"
                  }`}
                >
                  <p className="text-sm font-medium text-white truncate">{t.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{CHANNEL_LABELS[t.channel]}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Right — editor */}
          <div className="flex-1 flex flex-col min-w-0 p-5 space-y-4 overflow-y-auto">
            {/* Name + Channel */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Nombre de la plantilla</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Primer contacto WhatsApp"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-ceibo-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Canal</label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as Template["channel"])}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-ceibo-500 transition-colors"
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="instagram">Instagram</option>
                  <option value="email">Email</option>
                </select>
              </div>
            </div>

            {/* Variables */}
            <div>
              <p className="text-xs font-medium text-gray-400 mb-2">Variables disponibles</p>
              <div className="flex flex-wrap gap-2">
                {VARIABLES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVariable(v)}
                    className="px-2.5 py-1 rounded-md text-xs font-mono bg-gray-800 border border-gray-700 text-ceibo-400 hover:bg-gray-750 hover:border-ceibo-700 transition-colors"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Textarea */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-gray-400">Contenido</label>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 border border-gray-700 text-gray-300 hover:border-ceibo-600 hover:text-ceibo-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Generando...
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Generar con AI
                    </>
                  )}
                </button>
              </div>
              {generateError && (
                <div className="mb-2 rounded-lg bg-red-950/50 border border-red-800 px-3 py-2 text-xs text-red-400">
                  {generateError}
                </div>
              )}
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Escribí tu mensaje aquí o usá 'Generar con AI'..."
                rows={8}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-ceibo-500 transition-colors resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-1">
              <div>
                {selected && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-950/30 hover:border hover:border-red-800 transition-colors border border-transparent"
                  >
                    Eliminar
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                {saveMsg && (
                  <span className="text-xs text-ceibo-400">{saveMsg}</span>
                )}
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-ceibo-600 hover:bg-ceibo-700 text-white transition-colors"
                >
                  Guardar plantilla
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
