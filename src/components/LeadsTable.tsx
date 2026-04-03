"use client";

import { useState } from "react";
import type { Lead, LeadPriority, LeadStatus, WebsiteQuality } from "@/lib/types";
import { getNextAction } from "@/lib/sales/nextActionEngine";
import { DIFFICULTY_CONFIG } from "@/lib/sales/difficultyEngine";
import { classifyPhone } from "@/lib/phone-classifier";
import { LeadModal } from "./LeadModal";
import { BusinessProfileModal } from "./BusinessProfileModal";

interface LeadsTableProps {
  leads: Lead[];
  compareIds?: Set<number>;
  onToggleCompare?: (id: number) => void;
  onUpdate: (
    id: number,
    data: {
      status?: LeadStatus;
      notes?: string;
      tags?: string[];
      sequence_stage?: string;
      next_followup_at?: string | null;
      is_favorite?: boolean;
    }
  ) => void;
  onDelete?: (id: number) => void;
}

// ─── Config ───────────────────────────────────────────────────────────────────
const PRIORITY_SCORE_COLOR: Record<LeadPriority, string> = {
  high:   "text-red-400",
  medium: "text-yellow-400",
  low:    "text-gray-500",
};
const PRIORITY_BAR: Record<LeadPriority, string> = {
  high:   "bg-red-500",
  medium: "bg-yellow-500",
  low:    "bg-gray-600",
};
const PRIORITY_ROW_BORDER: Record<LeadPriority, string> = {
  high:   "border-l-2 border-red-800",
  medium: "border-l-2 border-yellow-800",
  low:    "",
};
const PRIORITY_ICON: Record<LeadPriority, string> = {
  high: "🔥", medium: "👍", low: "·",
};

const STATUS_BADGE: Record<LeadStatus, { label: string; cls: string }> = {
  not_contacted: { label: "Sin contactar",   cls: "bg-gray-800 text-gray-400 border-gray-700"       },
  contacted:     { label: "Contactado",      cls: "bg-blue-950 text-blue-400 border-blue-800"       },
  interested:    { label: "Interesado",      cls: "bg-ceibo-950 text-ceibo-400 border-ceibo-800"    },
  proposal_sent: { label: "Propuesta",       cls: "bg-purple-950 text-purple-400 border-purple-800" },
  closed_won:    { label: "Cerrado ✓",       cls: "bg-emerald-950 text-emerald-400 border-emerald-800" },
  closed_lost:   { label: "Perdido",         cls: "bg-red-950 text-red-400 border-red-900"          },
};

const WEBSITE_BADGE: Record<string, { label: string; cls: string }> = {
  no_website:        { label: "Sin web",   cls: "bg-red-950 text-red-400 border-red-900"       },
  poor:              { label: "Web mala",  cls: "bg-orange-950 text-orange-400 border-orange-900" },
  needs_improvement: { label: "Web débil", cls: "bg-yellow-950 text-yellow-500 border-yellow-900" },
  good:              { label: "Web buena", cls: "bg-ceibo-950 text-ceibo-400 border-ceibo-900"  },
};

// ─── Sort types ───────────────────────────────────────────────────────────────
type SortKey = "lead_score" | "name" | "created_at";
type SortDir = "asc" | "desc";

// ─── Main component ───────────────────────────────────────────────────────────
export function LeadsTable({ leads, compareIds, onToggleCompare, onUpdate, onDelete }: LeadsTableProps) {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [messageLead, setMessageLead]   = useState<Lead | null>(null);
  const [sortKey, setSortKey]           = useState<SortKey>("lead_score");
  const [sortDir, setSortDir]           = useState<SortDir>("desc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  const sorted = [...leads].sort((a, b) => {
    let av: number | string | null = sortKey === "lead_score" ? (a.lead_score ?? -1)
      : sortKey === "name" ? a.name.toLowerCase()
      : a.created_at;
    let bv: number | string | null = sortKey === "lead_score" ? (b.lead_score ?? -1)
      : sortKey === "name" ? b.name.toLowerCase()
      : b.created_at;
    if (av === null) return 1;
    if (bv === null) return -1;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === "desc" ? -cmp : cmp;
  });

  if (leads.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
        <p className="text-gray-500 text-sm">No hay leads. Realizá una búsqueda para comenzar.</p>
      </div>
    );
  }

  const SortBtn = ({ col, label }: { col: SortKey; label: string }) => (
    <button
      onClick={() => toggleSort(col)}
      className={`flex items-center gap-1 text-xs font-medium uppercase tracking-wider transition-colors ${
        sortKey === col ? "text-ceibo-400" : "text-gray-600 hover:text-gray-400"
      }`}
    >
      {label}
      <span>{sortKey === col ? (sortDir === "desc" ? "↓" : "↑") : "↕"}</span>
    </button>
  );

  return (
    <>
      <div className="rounded-xl overflow-hidden border border-gray-800">
        {/* Header */}
        <div className="bg-gray-900/80 border-b border-gray-800 px-4 py-2.5 flex items-center gap-4">
          {onToggleCompare && <div className="w-4" />}
          <SortBtn col="lead_score" label="Score" />
          <SortBtn col="name" label="Negocio" />
          <div className="ml-auto">
            <SortBtn col="created_at" label="Fecha" />
          </div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-gray-800/70">
          {sorted.map((lead) => {
            const priority  = lead.lead_priority as LeadPriority | null;
            const scoreColor = priority ? PRIORITY_SCORE_COLOR[priority] : "text-gray-500";
            const barColor   = priority ? PRIORITY_BAR[priority] : "bg-gray-700";
            const rowBorder  = priority ? PRIORITY_ROW_BORDER[priority] : "";
            const status     = STATUS_BADGE[lead.status];
            const na         = getNextAction(lead);
            const phoneInfo  = classifyPhone(lead.phone);
            const tags: string[] = (() => { try { return JSON.parse(lead.tags ?? "[]"); } catch { return []; } })();

            // Website badge key
            const webKey = !lead.has_website ? "no_website"
              : (lead.website_quality as WebsiteQuality | null) ?? null;
            const webBadge = webKey && WEBSITE_BADGE[webKey] ? WEBSITE_BADGE[webKey] : null;

            return (
              <div
                key={lead.id}
                className={`group relative bg-gray-900 hover:bg-gray-800/60 transition-colors flex items-center gap-3 px-4 py-3 ${rowBorder}`}
              >
                {/* Checkbox */}
                {onToggleCompare && (
                  <input
                    type="checkbox"
                    checked={compareIds?.has(lead.id) ?? false}
                    onChange={() => onToggleCompare(lead.id)}
                    className="w-3.5 h-3.5 rounded accent-ceibo-500 cursor-pointer shrink-0"
                  />
                )}

                {/* Score */}
                <div className="shrink-0 w-12 flex flex-col items-center gap-1">
                  <span className={`text-sm font-bold font-mono leading-none ${scoreColor}`}>
                    {lead.lead_score ?? "—"}
                  </span>
                  <div className="w-8 h-1 bg-gray-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${barColor}`}
                      style={{ width: lead.lead_score ? `${lead.lead_score}%` : "0%" }} />
                  </div>
                  <span className="text-xs leading-none">{priority ? PRIORITY_ICON[priority] : ""}</span>
                </div>

                {/* Business info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white text-sm leading-tight">{lead.name}</span>
                    {lead.is_hot && (
                      <span className="text-xs px-1 py-0.5 rounded bg-red-950 border border-red-800 text-red-400 font-medium leading-none">🔥</span>
                    )}
                    {lead.is_favorite && <span className="text-yellow-400 text-xs">⭐</span>}
                    {lead.difficulty_level && (() => {
                      const cfg = DIFFICULTY_CONFIG[lead.difficulty_level];
                      return (
                        <span className={`text-xs px-1.5 py-0.5 rounded border font-medium leading-none ${cfg.textCls} ${cfg.bgCls} ${cfg.borderCls}`}>
                          {cfg.emoji} {cfg.label}
                        </span>
                      );
                    })()}
                  </div>

                  {/* Category + platform + location */}
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {lead.category && (
                      <span className="text-xs text-ceibo-600">{lead.category}</span>
                    )}
                    {lead.category && (lead.platform || lead.location) && (
                      <span className="text-gray-700 text-xs">·</span>
                    )}
                    <span className="text-xs text-gray-600">
                      {lead.platform === "google_maps" ? "Maps" : "IG"}
                    </span>
                    {lead.location && (
                      <>
                        <span className="text-gray-700 text-xs">·</span>
                        <span className="text-xs text-gray-600 truncate max-w-[180px]">{lead.location}</span>
                      </>
                    )}
                  </div>

                  {/* Reason / description */}
                  {(lead.contact_reason || lead.description) && (
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-1 max-w-md">
                      {lead.contact_reason ?? lead.description}
                    </p>
                  )}

                  {/* Tags */}
                  {tags.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-500 border border-gray-700/60">
                          {tag}
                        </span>
                      ))}
                      {tags.length > 3 && (
                        <span className="text-xs text-gray-700">+{tags.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Signals (website + phone) */}
                <div className="shrink-0 flex flex-col items-end gap-1.5">
                  {webBadge && (
                    <span className={`text-xs px-2 py-0.5 rounded border font-medium whitespace-nowrap ${webBadge.cls}`}>
                      {webBadge.label}
                    </span>
                  )}
                  {lead.phone && (
                    <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${
                      phoneInfo.canWhatsapp
                        ? "bg-ceibo-950 text-ceibo-500 border-ceibo-900"
                        : "bg-gray-800 text-gray-500 border-gray-700"
                    }`}>
                      {phoneInfo.canWhatsapp ? "📱 WhatsApp" : "☎ Fijo"}
                    </span>
                  )}
                </div>

                {/* Status + next action */}
                <div className="shrink-0 w-28 flex flex-col items-start gap-1">
                  <span className={`text-xs px-2 py-0.5 rounded border whitespace-nowrap ${status.cls}`}>
                    {status.label}
                  </span>
                  {na.action !== "none" && (
                    <span className={`text-xs ${na.color} whitespace-nowrap`} title={na.label}>
                      {na.icon} {na.label}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="shrink-0 flex items-center gap-1.5">
                  {/* Favorite */}
                  <button
                    onClick={() => onUpdate(lead.id, { is_favorite: !lead.is_favorite })}
                    title={lead.is_favorite ? "Quitar favorito" : "Agregar a favoritos"}
                    className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors border ${
                      lead.is_favorite
                        ? "text-yellow-400 bg-yellow-950/30 border-yellow-900"
                        : "text-gray-600 hover:text-yellow-400 bg-gray-800 border-gray-700"
                    }`}
                  >
                    {lead.is_favorite ? "⭐" : "☆"}
                  </button>

                  {/* Ver lead - main CTA */}
                  <button
                    onClick={() => setSelectedLead(lead)}
                    className="px-3 py-1.5 rounded-lg bg-ceibo-900 hover:bg-ceibo-800 border border-ceibo-700 text-ceibo-300 text-xs font-medium transition-colors whitespace-nowrap"
                  >
                    Ver lead
                  </button>

                  {/* Extraer info */}
                  <button
                    onClick={() => setMessageLead(lead)}
                    title="Extraer información para ChatGPT"
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 hover:text-purple-400 transition-colors"
                  >
                    ⬡
                  </button>

                  {/* External profile */}
                  <a
                    href={lead.profile_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Abrir perfil"
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    ↗
                  </a>

                  {/* Delete */}
                  {onDelete && (
                    <button
                      onClick={() => { if (confirm(`¿Eliminar "${lead.name}"?`)) onDelete(lead.id); }}
                      title="Eliminar lead"
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-red-950 border border-gray-700 hover:border-red-900 text-gray-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedLead && (
        <LeadModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={onUpdate}
          onDelete={onDelete ? (id) => { onDelete(id); setSelectedLead(null); } : undefined}
        />
      )}

      {messageLead && (
        <BusinessProfileModal
          lead={messageLead}
          onClose={() => setMessageLead(null)}
        />
      )}
    </>
  );
}
