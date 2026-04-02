"use client";

import { useEffect, useState, useCallback } from "react";
import type { Lead, LeadStatus } from "@/lib/types";
import { LeadModal } from "@/components/LeadModal";
import { MessageModal } from "@/components/MessageModal";
import { classifyPhone } from "@/lib/phone-classifier";

// ─── Column config ────────────────────────────────────────────────────────────
interface ColumnConfig {
  status: LeadStatus;
  label: string;
  headerText: string;
  headerBorder: string;
}

const COLUMNS: ColumnConfig[] = [
  { status: "not_contacted", label: "Sin contactar",    headerText: "text-gray-400",    headerBorder: "border-gray-700"   },
  { status: "contacted",     label: "Contactado",        headerText: "text-blue-400",    headerBorder: "border-blue-800"   },
  { status: "interested",    label: "Interesado",        headerText: "text-ceibo-400",   headerBorder: "border-ceibo-700"  },
  { status: "proposal_sent", label: "Propuesta enviada", headerText: "text-purple-400",  headerBorder: "border-purple-700" },
  { status: "closed_won",    label: "Cerrado ✓",         headerText: "text-emerald-400", headerBorder: "border-emerald-700"},
];

// ─── Score badge color ─────────────────────────────────────────────────────────
function scoreBadgeClass(score: number | null): string {
  if (!score) return "bg-gray-800 text-gray-500";
  if (score >= 70) return "bg-red-950 text-red-400";
  if (score >= 40) return "bg-yellow-950 text-yellow-400";
  return "bg-gray-800 text-gray-500";
}

// ─── Lead Card ────────────────────────────────────────────────────────────────
function LeadCard({
  lead,
  onOpenModal,
  onOpenMessage,
  onDragStart,
}: {
  lead: Lead;
  onOpenModal: () => void;
  onOpenMessage: () => void;
  onDragStart: (e: React.DragEvent, leadId: number) => void;
}) {
  const phoneInfo = classifyPhone(lead.phone);
  const phoneEmoji = phoneInfo.type === "mobile" ? "📱" : lead.phone ? "📞" : null;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead.id)}
      className="bg-gray-900 border border-gray-800 rounded-xl p-3 cursor-grab active:cursor-grabbing hover:border-gray-700 transition-colors select-none"
    >
      {/* Name + score */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {lead.is_hot && <span className="text-xs shrink-0">🔥</span>}
          <span className="text-sm font-semibold text-white truncate leading-tight">{lead.name}</span>
        </div>
        {lead.lead_score !== null && (
          <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${scoreBadgeClass(lead.lead_score)}`}>
            {lead.lead_score}
          </span>
        )}
      </div>

      {/* Category */}
      {lead.category && (
        <div className="text-xs text-ceibo-600 truncate mb-1">{lead.category}</div>
      )}

      {/* Phone */}
      {lead.phone && (
        <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
          {phoneEmoji && <span>{phoneEmoji}</span>}
          <span className="truncate">{lead.phone}</span>
        </div>
      )}

      {/* Location */}
      {lead.location && (
        <div className="text-xs text-gray-600 truncate mb-2">
          {lead.location.split(",")[0]}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1.5 mt-1">
        <button
          onClick={(e) => { e.stopPropagation(); onOpenModal(); }}
          className="flex-1 text-xs px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 border border-gray-700 transition-colors"
        >
          Ver
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onOpenMessage(); }}
          className="flex-1 text-xs px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 border border-gray-700 transition-colors"
        >
          Msg
        </button>
      </div>
    </div>
  );
}

// ─── Kanban Column ─────────────────────────────────────────────────────────────
function KanbanColumn({
  config,
  leads,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onOpenModal,
  onOpenMessage,
  onDragStart,
}: {
  config: ColumnConfig;
  leads: Lead[];
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, status: LeadStatus) => void;
  onOpenModal: (lead: Lead) => void;
  onOpenMessage: (lead: Lead) => void;
  onDragStart: (e: React.DragEvent, leadId: number) => void;
}) {
  return (
    <div
      className={`flex flex-col w-64 shrink-0 rounded-xl border transition-colors ${
        isDragOver ? "border-gray-500 bg-gray-800/30" : "border-gray-800 bg-gray-900/40"
      }`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, config.status)}
    >
      {/* Column header */}
      <div className={`px-4 pt-4 pb-3 border-b ${config.headerBorder}`}>
        <div className="flex items-center justify-between">
          <span className={`text-xs font-bold uppercase tracking-wider ${config.headerText}`}>
            {config.label}
          </span>
          <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-gray-800 ${config.headerText}`}>
            {leads.length}
          </span>
        </div>
      </div>

      {/* Cards area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[200px] max-h-[calc(100vh-220px)]">
        {leads.length === 0 ? (
          <div className={`flex items-center justify-center h-20 text-xs text-gray-700 rounded-lg border border-dashed transition-colors ${
            isDragOver ? "border-gray-500 text-gray-500" : "border-gray-800"
          }`}>
            Arrastrá leads acá
          </div>
        ) : (
          leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onOpenModal={() => onOpenModal(lead)}
              onOpenMessage={() => onOpenMessage(lead)}
              onDragStart={onDragStart}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Pipeline Page ─────────────────────────────────────────────────────────────
export default function PipelinePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [messageLead, setMessageLead] = useState<Lead | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<LeadStatus | null>(null);

  // ─── Filters ────────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterPlatform, setFilterPlatform] = useState("all");
  const [hotOnly, setHotOnly] = useState(false);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/leads");
      const data = await res.json();
      setLeads(Array.isArray(data) ? data : []);
    } catch {
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // Derived filter options
  const categories = Array.from(new Set(leads.map(l => l.category).filter(Boolean) as string[])).sort();

  // Active filter count (for badge)
  const activeFilters = [
    search.trim() !== "",
    filterCategory !== "all",
    filterPriority !== "all",
    filterPlatform !== "all",
    hotOnly,
  ].filter(Boolean).length;

  const resetFilters = () => {
    setSearch("");
    setFilterCategory("all");
    setFilterPriority("all");
    setFilterPlatform("all");
    setHotOnly(false);
  };

  // Apply filters
  const filteredLeads = leads.filter(l => {
    if (hotOnly && !l.is_hot) return false;
    if (filterCategory !== "all" && l.category !== filterCategory) return false;
    if (filterPriority !== "all" && l.lead_priority !== filterPriority) return false;
    if (filterPlatform !== "all" && l.platform !== filterPlatform) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!l.name.toLowerCase().includes(q) && !(l.category ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Group filtered leads by status
  const leadsByStatus: Record<LeadStatus, Lead[]> = {
    not_contacted: [],
    contacted:     [],
    interested:    [],
    proposal_sent: [],
    closed_won:    [],
  };
  for (const lead of filteredLeads) {
    const s = lead.status as LeadStatus;
    if (leadsByStatus[s]) leadsByStatus[s].push(lead);
  }

  // ─── Drag & Drop handlers ────────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, leadId: number) => {
    e.dataTransfer.setData("leadId", String(leadId));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, status: LeadStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStatus(status);
  };

  const handleDragLeave = () => {
    setDragOverStatus(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: LeadStatus) => {
    e.preventDefault();
    setDragOverStatus(null);
    const leadId = Number(e.dataTransfer.getData("leadId"));
    if (!leadId) return;

    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.status === targetStatus) return;

    // Optimistic update
    setLeads((prev) =>
      prev.map((l) => l.id === leadId ? { ...l, status: targetStatus } : l)
    );

    try {
      await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      });
    } catch {
      // Revert on failure
      setLeads((prev) =>
        prev.map((l) => l.id === leadId ? { ...l, status: lead.status } : l)
      );
    }
  };

  // ─── LeadModal handlers ──────────────────────────────────────────────────────
  const handleUpdate = async (
    id: number,
    data: { status?: LeadStatus; notes?: string; tags?: string[]; sequence_stage?: string; next_followup_at?: string | null; is_favorite?: boolean }
  ) => {
    await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    // Update local state
    setLeads((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        return {
          ...l,
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
          ...(data.tags !== undefined ? { tags: JSON.stringify(data.tags) } : {}),
          ...(data.sequence_stage !== undefined ? { sequence_stage: data.sequence_stage } : {}),
          ...(data.next_followup_at !== undefined ? { next_followup_at: data.next_followup_at ?? null } : {}),
          ...(data.is_favorite !== undefined ? { is_favorite: data.is_favorite } : {}),
        };
      })
    );
    // Also update selectedLead if open
    if (selectedLead?.id === id) {
      setSelectedLead((prev) => prev ? {
        ...prev,
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.tags !== undefined ? { tags: JSON.stringify(data.tags) } : {}),
        ...(data.sequence_stage !== undefined ? { sequence_stage: data.sequence_stage } : {}),
        ...(data.next_followup_at !== undefined ? { next_followup_at: data.next_followup_at ?? null } : {}),
        ...(data.is_favorite !== undefined ? { is_favorite: data.is_favorite } : {}),
      } : null);
    }
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/leads/${id}`, { method: "DELETE" });
    setLeads((prev) => prev.filter((l) => l.id !== id));
    setSelectedLead(null);
  };

  return (
    <main className="max-w-full px-6 py-8">
      {/* Header */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Pipeline</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {filteredLeads.length !== leads.length
                ? `${filteredLeads.length} de ${leads.length} leads`
                : `${leads.length} leads totales`}
            </p>
          </div>
          <button
            onClick={fetchLeads}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700"
          >
            ↻ Actualizar
          </button>
        </div>

        {/* Filters bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre..."
              className="pl-8 pr-3 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-gray-600 w-48"
            />
          </div>

          {/* Category */}
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors focus:outline-none ${
              filterCategory !== "all"
                ? "bg-ceibo-950 border-ceibo-700 text-ceibo-300"
                : "bg-gray-800 border-gray-700 text-gray-400"
            }`}
          >
            <option value="all">Todas las categorías</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* Priority */}
          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors focus:outline-none ${
              filterPriority !== "all"
                ? "bg-red-950 border-red-800 text-red-300"
                : "bg-gray-800 border-gray-700 text-gray-400"
            }`}
          >
            <option value="all">Cualquier prioridad</option>
            <option value="high">🔥 Perfect Fit</option>
            <option value="medium">👍 Good Fit</option>
            <option value="low">❌ Low Fit</option>
          </select>

          {/* Platform */}
          <select
            value={filterPlatform}
            onChange={e => setFilterPlatform(e.target.value)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors focus:outline-none ${
              filterPlatform !== "all"
                ? "bg-blue-950 border-blue-800 text-blue-300"
                : "bg-gray-800 border-gray-700 text-gray-400"
            }`}
          >
            <option value="all">Todas las plataformas</option>
            <option value="google_maps">Google Maps</option>
            <option value="instagram">Instagram</option>
          </select>

          {/* HOT toggle */}
          <button
            onClick={() => setHotOnly(v => !v)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              hotOnly
                ? "bg-red-950 border-red-800 text-red-300"
                : "bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300"
            }`}
          >
            🔥 Solo HOT
          </button>

          {/* Clear filters */}
          {activeFilters > 0 && (
            <button
              onClick={resetFilters}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-500 hover:text-red-400 hover:border-red-800 transition-colors"
            >
              ✕ Limpiar ({activeFilters})
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-3 text-gray-500">
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="text-sm">Cargando leads...</span>
          </div>
        </div>
      ) : (
        /* Kanban board */
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.status}
                config={col}
                leads={leadsByStatus[col.status]}
                isDragOver={dragOverStatus === col.status}
                onDragOver={(e) => handleDragOver(e, col.status)}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onOpenModal={setSelectedLead}
                onOpenMessage={setMessageLead}
                onDragStart={handleDragStart}
              />
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
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
    </main>
  );
}
