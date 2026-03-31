"use client";

import { useEffect, useState, useCallback } from "react";
import type { Lead, LeadPriority, LeadStatus } from "@/lib/types";
import { LeadModal } from "@/components/LeadModal";
import { MessageModal } from "@/components/MessageModal";

// ─── Date grouping helpers ────────────────────────────────────────────────────
function getDateGroup(dateStr: string): "today" | "week" | "earlier" {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 1) return "today";
  if (diffDays < 7) return "week";
  return "earlier";
}

function formatRelative(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `hace ${diffMins} min`;
  if (diffHours < 24) return `hace ${diffHours}h`;
  if (diffDays === 1) return "ayer";
  if (diffDays < 7) return `hace ${diffDays} días`;
  return d.toLocaleDateString("es-UY", { day: "numeric", month: "short" });
}

// ─── Config ───────────────────────────────────────────────────────────────────
const priorityDot: Record<LeadPriority, string> = {
  high:   "bg-red-500",
  medium: "bg-yellow-500",
  low:    "bg-gray-600",
};
const statusBadge: Record<LeadStatus, { label: string; cls: string }> = {
  not_contacted: { label: "Sin contactar", cls: "text-gray-500 bg-gray-800 border-gray-700"   },
  contacted:     { label: "Contactado",    cls: "text-blue-400 bg-blue-950 border-blue-800"   },
  interested:    { label: "Interesado",    cls: "text-ceibo-400 bg-ceibo-950 border-ceibo-800" },
};

// ─── Feed card ────────────────────────────────────────────────────────────────
function FeedCard({
  lead,
  onOpen,
  onMessage,
  onFavoriteToggle,
}: {
  lead: Lead;
  onOpen: () => void;
  onMessage: () => void;
  onFavoriteToggle: () => void;
}) {
  const priority = lead.lead_priority as LeadPriority | null;
  const sbadge = statusBadge[lead.status];

  return (
    <div
      className="group bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-4 transition-colors cursor-pointer"
      onClick={onOpen}
    >
      <div className="flex items-start gap-3">
        {/* Priority dot */}
        <div className="shrink-0 mt-1.5">
          <div className={`w-2 h-2 rounded-full ${priority ? priorityDot[priority] : "bg-gray-700"}`} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Name + time */}
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-semibold text-white text-sm truncate">{lead.name}</span>
            <span className="text-xs text-gray-600 shrink-0">{formatRelative(lead.created_at)}</span>
          </div>

          {/* Category + location */}
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
            {lead.category && <span className="text-xs text-ceibo-600">{lead.category}</span>}
            {lead.category && lead.location && <span className="text-gray-700 text-xs">·</span>}
            {lead.location && <span className="text-xs text-gray-500">{lead.location}</span>}
          </div>

          {/* Score + website status + value */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {lead.lead_score !== null && (
              <span className={`text-xs font-mono font-bold ${
                priority === "high"   ? "text-red-400" :
                priority === "medium" ? "text-yellow-400" : "text-gray-500"
              }`}>{lead.lead_score}</span>
            )}
            {!lead.has_website ? (
              <span className="text-xs px-1.5 py-0.5 rounded bg-red-950 text-red-400 border border-red-900 font-medium">SIN WEB</span>
            ) : lead.website_quality === "poor" ? (
              <span className="text-xs px-1.5 py-0.5 rounded bg-orange-950 text-orange-400 border border-orange-900 font-medium">WEB MALA</span>
            ) : lead.website_quality === "needs_improvement" ? (
              <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-950 text-yellow-400 border border-yellow-900 font-medium">WEB DÉBIL</span>
            ) : null}

            {/* AI premium tier */}
            {lead.ai_premium_tier && (
              <span className={`text-xs font-mono font-bold ${
                lead.ai_premium_tier === "$$$" ? "text-emerald-400" :
                lead.ai_premium_tier === "$$"  ? "text-ceibo-400" : "text-gray-600"
              }`}>{lead.ai_premium_tier}</span>
            )}

            {/* Status */}
            <span className={`text-xs px-1.5 py-0.5 rounded border ml-auto ${sbadge.cls}`}>{sbadge.label}</span>
          </div>

          {/* AI summary or contact reason */}
          {(lead.ai_summary || lead.contact_reason) && (
            <p className="text-xs text-gray-500 mt-2 leading-relaxed line-clamp-2">
              {lead.ai_summary ?? lead.contact_reason}
            </p>
          )}
        </div>
      </div>

      {/* Quick actions (visible on hover) */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-800 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={e => { e.stopPropagation(); onOpen(); }}
          className="text-xs px-3 py-1 rounded-lg bg-ceibo-900 hover:bg-ceibo-800 text-ceibo-300 border border-ceibo-700 transition-colors"
        >
          Ver lead
        </button>
        <button
          onClick={e => { e.stopPropagation(); onMessage(); }}
          className="text-xs px-3 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-purple-400 border border-gray-700 transition-colors"
        >
          ✉ Mensaje
        </button>
        <button
          onClick={e => { e.stopPropagation(); onFavoriteToggle(); }}
          className={`text-xs px-3 py-1 rounded-lg border transition-colors ${
            lead.is_favorite
              ? "bg-yellow-950/60 border-yellow-800 text-yellow-400"
              : "bg-gray-800 border-gray-700 text-gray-500 hover:text-yellow-400"
          }`}
        >
          {lead.is_favorite ? "⭐ Guardado" : "☆ Guardar"}
        </button>
        <a
          href={lead.profile_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="text-xs px-3 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 border border-gray-700 transition-colors ml-auto"
        >
          ↗ Ver perfil
        </a>
      </div>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">{label}</span>
      <span className="text-xs text-gray-600 font-mono">{count}</span>
      <div className="flex-1 h-px bg-gray-800" />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function FeedPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [messageLead, setMessageLead] = useState<Lead | null>(null);

  const fetchLeads = useCallback(async () => {
    const res = await fetch("/api/leads?sort=recent");
    const data = await res.json();
    // Sort by created_at descending
    const sorted = (data as Lead[]).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    setLeads(sorted);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const handleUpdate = async (
    id: number,
    data: { status?: LeadStatus; notes?: string; tags?: string[]; sequence_stage?: string; next_followup_at?: string | null; is_favorite?: boolean }
  ) => {
    await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    await fetchLeads();
    // If the updated lead is open in the panel, refresh it
    if (selectedLead?.id === id) {
      const updated = await fetch(`/api/leads/${id}`).then(r => r.json()).catch(() => null);
      if (updated) setSelectedLead(updated);
    }
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/leads/${id}`, { method: "DELETE" });
    setLeads(prev => prev.filter(l => l.id !== id));
    setSelectedLead(null);
  };

  // Group leads by date
  const today   = leads.filter(l => getDateGroup(l.created_at) === "today");
  const week    = leads.filter(l => getDateGroup(l.created_at) === "week");
  const earlier = leads.filter(l => getDateGroup(l.created_at) === "earlier");

  if (loading) {
    return (
      <main className="max-w-3xl mx-auto px-6 py-8">
        <p className="text-gray-500 text-sm">Cargando feed...</p>
      </main>
    );
  }

  return (
    <>
      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-bold text-gray-100">Feed de Leads</h2>
          <span className="text-xs text-gray-600">{leads.length} leads totales</span>
        </div>

        {leads.length === 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
            <p className="text-gray-500">No hay leads aún. Realiza una búsqueda primero.</p>
          </div>
        )}

        {today.length > 0 && (
          <section>
            <SectionHeader label="Hoy" count={today.length} />
            <div className="space-y-2">
              {today.map(lead => (
                <FeedCard
                  key={lead.id}
                  lead={lead}
                  onOpen={() => setSelectedLead(lead)}
                  onMessage={() => setMessageLead(lead)}
                  onFavoriteToggle={() => handleUpdate(lead.id, { is_favorite: !lead.is_favorite })}
                />
              ))}
            </div>
          </section>
        )}

        {week.length > 0 && (
          <section>
            <SectionHeader label="Esta semana" count={week.length} />
            <div className="space-y-2">
              {week.map(lead => (
                <FeedCard
                  key={lead.id}
                  lead={lead}
                  onOpen={() => setSelectedLead(lead)}
                  onMessage={() => setMessageLead(lead)}
                  onFavoriteToggle={() => handleUpdate(lead.id, { is_favorite: !lead.is_favorite })}
                />
              ))}
            </div>
          </section>
        )}

        {earlier.length > 0 && (
          <section>
            <SectionHeader label="Antes" count={earlier.length} />
            <div className="space-y-2">
              {earlier.map(lead => (
                <FeedCard
                  key={lead.id}
                  lead={lead}
                  onOpen={() => setSelectedLead(lead)}
                  onMessage={() => setMessageLead(lead)}
                  onFavoriteToggle={() => handleUpdate(lead.id, { is_favorite: !lead.is_favorite })}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      {selectedLead && (
        <LeadModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}

      {messageLead && (
        <MessageModal
          lead={messageLead}
          onClose={() => setMessageLead(null)}
        />
      )}
    </>
  );
}
