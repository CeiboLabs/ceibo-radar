"use client";

import { useEffect, useState, useCallback } from "react";
import type { Lead, LeadPriority, LeadStatus } from "@/lib/types";
import type { DailySection, DailyLead } from "@/lib/sales/dailyListEngine";
import { LeadModal } from "@/components/LeadModal";
import { MessageModal } from "@/components/MessageModal";

// ─── Config ───────────────────────────────────────────────────────────────────
const statusBadge: Record<LeadStatus, { label: string; cls: string }> = {
  not_contacted: { label: "Sin contactar", cls: "text-gray-500 bg-gray-800 border-gray-700"   },
  contacted:     { label: "Contactado",    cls: "text-blue-400 bg-blue-950 border-blue-800"   },
  interested:    { label: "Interesado",    cls: "text-ceibo-400 bg-ceibo-950 border-ceibo-800" },
};

const sectionHeader: Record<string, string> = {
  urgent:     "border-red-800 text-red-400",
  followups:  "border-yellow-800 text-yellow-400",
  new_hot:    "border-orange-800 text-orange-400",
  top_ranked: "border-gray-700 text-gray-400",
};

const urgencyBadge: Record<string, string> = {
  high:   "bg-red-950 border-red-800 text-red-400",
  medium: "bg-yellow-950 border-yellow-800 text-yellow-400",
  low:    "bg-gray-800 border-gray-700 text-gray-500",
};

// ─── Today Lead Card ──────────────────────────────────────────────────────────
function TodayCard({
  lead,
  onOpen,
  onMessage,
}: {
  lead: DailyLead;
  onOpen: () => void;
  onMessage: () => void;
}) {
  const priority = lead.lead_priority as LeadPriority | null;
  const sbadge = statusBadge[lead.status];
  const { next_action } = lead;

  const priorityBorder =
    priority === "high"   ? "border-l-2 border-red-800" :
    priority === "medium" ? "border-l-2 border-yellow-800" :
                            "";

  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-start gap-4 hover:border-gray-700 transition-colors ${priorityBorder}`}>
      {/* Rank badge */}
      <div className="shrink-0 w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center text-sm font-bold font-mono text-gray-400">
        {lead.daily_rank}
      </div>

      {/* Lead info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <span className="font-semibold text-white">{lead.name}</span>
          {lead.is_hot && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-red-950 border border-red-800 text-red-400 font-medium">
              🔥 HOT
            </span>
          )}
          {lead.is_favorite && (
            <span className="text-yellow-400 text-sm">⭐</span>
          )}
        </div>
        {lead.category && (
          <div className="text-xs text-ceibo-600 mt-0.5">{lead.category}</div>
        )}
        {lead.contact_reason && (
          <div className="text-xs text-gray-500 mt-1 line-clamp-2">{lead.contact_reason}</div>
        )}
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {/* Status */}
          <span className={`text-xs px-2 py-0.5 rounded border ${sbadge.cls}`}>
            {sbadge.label}
          </span>
          {/* Next action */}
          <span className={`text-xs px-2 py-0.5 rounded border font-medium ${urgencyBadge[next_action.urgency]}`}>
            <span className="mr-1">{next_action.icon}</span>
            {next_action.label}
          </span>
          {/* Score */}
          {lead.lead_score !== null && (
            <span className="text-xs text-gray-600 font-mono">
              Score {lead.lead_score}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="shrink-0 flex flex-col gap-2 items-end">
        {lead.phone && (
          <span className="text-xs text-gray-400">{lead.phone}</span>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpen}
            className="text-xs text-ceibo-400 hover:text-ceibo-300 transition-colors px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 border border-gray-700"
          >
            Ver lead
          </button>
          <button
            onClick={onMessage}
            className="text-xs text-purple-400 hover:text-purple-300 transition-colors px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 border border-gray-700"
            title="Generar mensaje"
          >
            ✉ Mensaje
          </button>
          <a
            href={lead.profile_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-600 hover:text-gray-300 px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 border border-gray-700"
            title="Abrir perfil"
          >
            ↗
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Today Page ───────────────────────────────────────────────────────────────
export default function TodayPage() {
  const [sections, setSections] = useState<DailySection[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [messageLead, setMessageLead] = useState<Lead | null>(null);
  const [nextLead, setNextLead] = useState<Lead | null>(null);
  const [nextLoading, setNextLoading] = useState(false);

  const fetchToday = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/today");
      const data = await res.json();
      setSections(data.sections ?? []);
      setGeneratedAt(data.generated_at ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchToday(); }, [fetchToday]);

  const handleNextLead = async (excludeId?: number) => {
    setNextLoading(true);
    try {
      const params = excludeId ? `?exclude_id=${excludeId}` : "";
      const res = await fetch(`/api/next-lead${params}`);
      const data = await res.json();
      if (data.lead) setNextLead(data.lead);
    } finally { setNextLoading(false); }
  };

  const handleUpdate = async (id: number, data: object) => {
    await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    await fetchToday();
    if (selectedLead?.id === id) {
      const res = await fetch(`/api/leads/${id}`);
      setSelectedLead(await res.json());
    }
  };

  const totalLeads = sections.reduce((acc, s) => acc + s.leads.length, 0);

  return (
    <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">🗓 Lista del Día</h1>
          <p className="text-sm text-gray-500 mt-1">
            {loading ? "Calculando..." : `${totalLeads} leads priorizados`}
            {generatedAt && !loading && (
              <span className="ml-2 text-gray-700">
                · {new Date(generatedAt).toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleNextLead()}
            disabled={nextLoading}
            className="text-sm text-ceibo-400 hover:text-ceibo-300 transition-colors px-3 py-1.5 rounded-lg bg-ceibo-950/40 border border-ceibo-800 disabled:opacity-40"
          >
            {nextLoading ? "..." : "→ Siguiente lead"}
          </button>
          <button
            onClick={fetchToday}
            disabled={loading}
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 disabled:opacity-40"
          >
            {loading ? "..." : "↻ Actualizar"}
          </button>
        </div>
      </div>

      {/* Empty state */}
      {!loading && sections.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-gray-500 text-lg">🎉 Todo al día</p>
          <p className="text-gray-600 text-sm mt-1">No hay leads pendientes para hoy.</p>
        </div>
      )}

      {/* Sections */}
      {sections.map((section) => {
        const headerCls = sectionHeader[section.id] ?? "border-gray-700 text-gray-400";
        return (
          <section key={section.id} className="space-y-3">
            <div className={`flex items-center gap-3 border-b pb-2 ${headerCls}`}>
              <h2 className="font-semibold text-base">{section.title}</h2>
              <span className="text-xs text-gray-600">{section.leads.length} leads</span>
            </div>
            <div className="space-y-2">
              {section.leads.map((lead) => (
                <TodayCard
                  key={lead.id}
                  lead={lead}
                  onOpen={() => setSelectedLead(lead)}
                  onMessage={() => setMessageLead(lead)}
                />
              ))}
            </div>
          </section>
        );
      })}

      {selectedLead && (
        <LeadModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={handleUpdate}
        />
      )}
      {messageLead && (
        <MessageModal
          lead={messageLead}
          onClose={() => setMessageLead(null)}
        />
      )}

      {nextLead && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-900 border border-ceibo-700 rounded-2xl px-5 py-3 flex items-center gap-4 shadow-2xl max-w-sm">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500">Siguiente recomendado:</p>
            <p className="text-sm font-semibold text-white truncate">{nextLead.name}</p>
            {nextLead.category && <p className="text-xs text-ceibo-600">{nextLead.category}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => { setSelectedLead(nextLead); setNextLead(null); }}
              className="text-sm px-3 py-1.5 rounded-lg bg-ceibo-700 hover:bg-ceibo-600 text-white font-semibold transition-colors"
            >
              Ver →
            </button>
            <button onClick={() => setNextLead(null)} className="text-gray-600 hover:text-gray-400 text-xs">✕</button>
          </div>
        </div>
      )}
    </main>
  );
}
