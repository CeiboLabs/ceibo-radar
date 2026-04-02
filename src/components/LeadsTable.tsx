"use client";

import { useState } from "react";
import type { Lead, LeadPriority, LeadStatus, WebsiteQuality } from "@/lib/types";
import type { ScoreBreakdown } from "@/lib/lead-score";
import { getNextAction } from "@/lib/sales/nextActionEngine";
import { DIFFICULTY_CONFIG } from "@/lib/sales/difficultyEngine";
import { classifyPhone } from "@/lib/phone-classifier";
import { LeadModal } from "./LeadModal";
import { MessageModal } from "./MessageModal";

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

// ─── Ceibo Fit config ─────────────────────────────────────────────────────────
const fitConfig: Record<LeadPriority, { emoji: string; label: string; dot: string; row: string; badge: string }> = {
  high:   { emoji: "🔥", label: "Perfect Fit", dot: "bg-red-500",    row: "border-l-2 border-red-800",    badge: "bg-red-950/60 text-red-300 border-red-900" },
  medium: { emoji: "👍", label: "Good Fit",    dot: "bg-yellow-500",  row: "border-l-2 border-yellow-800", badge: "bg-yellow-950/60 text-yellow-400 border-yellow-900" },
  low:    { emoji: "❌", label: "Low Fit",     dot: "bg-gray-600",    row: "",                             badge: "bg-gray-800 text-gray-600 border-gray-700" },
};

// ─── Contact status config ────────────────────────────────────────────────────
const contactStatusBadge: Record<LeadStatus, string> = {
  not_contacted: "bg-gray-800 text-gray-400 border-gray-700",
  contacted:     "bg-blue-950 text-blue-400 border-blue-800",
  interested:    "bg-ceibo-950 text-ceibo-400 border-ceibo-800",
  proposal_sent: "bg-purple-950 text-purple-400 border-purple-800",
  closed_won:    "bg-emerald-950 text-emerald-400 border-emerald-800",
};
const contactStatusLabel: Record<LeadStatus, string> = {
  not_contacted: "Sin contactar",
  contacted:     "Contactado",
  interested:    "Interesado",
  proposal_sent: "Propuesta",
  closed_won:    "Cerrado",
};

const VALUE_BADGE: Record<string, { label: string; className: string }> = {
  high:   { label: "$$$", className: "text-emerald-400 font-bold font-mono" },
  medium: { label: "$$",  className: "text-ceibo-500 font-mono" },
  low:    { label: "$",   className: "text-gray-600 font-mono" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────
// Compact score cell: number + bar + emoji indicator (no text, no wrapping)
function ScoreCell({ lead }: { lead: Lead }) {
  const score = lead.lead_score;
  const priority = lead.lead_priority as LeadPriority | null;

  const textColor =
    priority === "high"   ? "text-red-400" :
    priority === "medium" ? "text-yellow-400" :
                            "text-gray-500";
  const barColor =
    priority === "high"   ? "bg-red-500" :
    priority === "medium" ? "bg-yellow-500" :
                            "bg-gray-600";

  return (
    <div className="flex items-center gap-2">
      {/* Emoji indicator — compact, never wraps */}
      <span className="text-base leading-none shrink-0">
        {priority === "high" ? "🔥" : priority === "medium" ? "👍" : "❌"}
      </span>
      <div className="flex flex-col gap-1">
        <span className={`text-sm font-bold font-mono ${textColor}`}>
          {score ?? "—"}
        </span>
        <div className="h-1 w-10 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${barColor}`}
            style={{ width: score ? `${score}%` : "0%" }}
          />
        </div>
      </div>
    </div>
  );
}

// Inline fit label for the business name row — text badge, won't appear in narrow score col
function FitLabel({ priority, estimatedValue }: { priority: LeadPriority | null; estimatedValue?: string | null }) {
  if (!priority) return null;
  const cfg = fitConfig[priority];
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <span className={`text-xs px-1.5 py-0.5 rounded border font-medium whitespace-nowrap ${cfg.badge}`}>
        {cfg.label}
      </span>
      {estimatedValue && VALUE_BADGE[estimatedValue] && (
        <span className={`text-xs ${VALUE_BADGE[estimatedValue].className}`}>
          {VALUE_BADGE[estimatedValue].label}
        </span>
      )}
    </div>
  );
}

function WebsiteBadge({ lead }: { lead: Lead }) {
  if (!lead.has_website) {
    return (
      <span className="inline-flex items-center text-xs px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-900 font-medium">
        NO WEBSITE
      </span>
    );
  }
  const quality = lead.website_quality as WebsiteQuality | null;
  if (quality === "poor") return (
    <span className="inline-flex items-center text-xs px-2 py-0.5 rounded bg-orange-950 text-orange-400 border border-orange-900 font-medium">
      BAD WEBSITE
    </span>
  );
  if (quality === "needs_improvement") return (
    <span className="inline-flex items-center text-xs px-2 py-0.5 rounded bg-yellow-950 text-yellow-400 border border-yellow-900 font-medium">
      WEAK WEBSITE
    </span>
  );
  if (quality === "good") return (
    <span className="inline-flex items-center text-xs px-2 py-0.5 rounded bg-ceibo-950 text-ceibo-400 border border-ceibo-900">
      GOOD WEBSITE
    </span>
  );
  return (
    <span className="inline-flex items-center text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">
      Has website
    </span>
  );
}

// ─── Sort types ───────────────────────────────────────────────────────────────
type SortKey = "lead_score" | "name" | "created_at";
type SortDir = "asc" | "desc";

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={`ml-1 text-xs ${active ? "text-ceibo-400" : "text-gray-700"}`}>
      {active ? (dir === "desc" ? "↓" : "↑") : "↕"}
    </span>
  );
}

// ─── Main table ───────────────────────────────────────────────────────────────
export function LeadsTable({ leads, compareIds, onToggleCompare, onUpdate, onDelete }: LeadsTableProps) {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [messageLead, setMessageLead] = useState<Lead | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("lead_score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = [...leads].sort((a, b) => {
    let av: number | string | null = null;
    let bv: number | string | null = null;

    if (sortKey === "lead_score") {
      av = a.lead_score ?? -1;
      bv = b.lead_score ?? -1;
    } else if (sortKey === "name") {
      av = a.name.toLowerCase();
      bv = b.name.toLowerCase();
    } else {
      av = a.created_at;
      bv = b.created_at;
    }

    if (av === null) return 1;
    if (bv === null) return -1;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === "desc" ? -cmp : cmp;
  });

  if (leads.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
        <p className="text-gray-500">No leads found. Run a search to get started.</p>
      </div>
    );
  }

  const ThSort = ({ col, label }: { col: SortKey; label: string }) => (
    <th
      className="px-4 py-3 text-gray-500 font-medium cursor-pointer hover:text-gray-300 select-none whitespace-nowrap"
      onClick={() => toggleSort(col)}
    >
      {label}
      <SortIcon active={sortKey === col} dir={sortDir} />
    </th>
  );

  return (
    <>
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                {onToggleCompare && (
                  <th className="px-3 py-3 w-8" />
                )}
                <ThSort col="lead_score" label="Score" />
                <ThSort col="name" label="Business" />
                <th className="px-4 py-3 text-gray-500 font-medium">Platform</th>
                <th className="px-4 py-3 text-gray-500 font-medium">Website</th>
                <th className="px-4 py-3 text-gray-500 font-medium">Contact</th>
                <th className="px-4 py-3 text-gray-500 font-medium">Location</th>
                <th className="px-4 py-3 text-gray-500 font-medium">Status</th>
                <th className="px-4 py-3 text-gray-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {sorted.map((lead, idx) => {
                const priority = lead.lead_priority as LeadPriority | null;
                const rowHighlight =
                  idx === 0 ? "bg-red-950/10" :
                  idx === 1 ? "bg-red-950/5" :
                  "";
                const borderClass = priority ? fitConfig[priority].row : "";

                return (
                  <tr
                    key={lead.id}
                    className={`hover:bg-gray-800/60 transition-colors ${rowHighlight} ${borderClass}`}
                  >
                    {/* Comparator checkbox */}
                    {onToggleCompare && (
                      <td className="px-3 py-3 w-8">
                        <input
                          type="checkbox"
                          checked={compareIds?.has(lead.id) ?? false}
                          onChange={() => onToggleCompare(lead.id)}
                          className="w-3.5 h-3.5 rounded accent-ceibo-500 cursor-pointer"
                          title="Seleccionar para comparar"
                        />
                      </td>
                    )}
                    {/* Score column */}
                    <td className="px-4 py-3 w-24">
                      <ScoreCell lead={lead} />
                    </td>

                    {/* Business name */}
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        {idx < 3 && (
                          <span className="text-xs font-bold text-gray-700 mt-0.5 shrink-0">
                            {idx === 0 ? "①" : idx === 1 ? "②" : "③"}
                          </span>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-white">{lead.name}</span>
                            {lead.is_hot && (
                              <span className="text-xs px-1 py-0.5 rounded bg-red-950 border border-red-800 text-red-400 font-medium leading-none">
                                🔥
                              </span>
                            )}
                            {lead.difficulty_level && (() => {
                              const cfg = DIFFICULTY_CONFIG[lead.difficulty_level];
                              return (
                                <span className={`text-xs px-1.5 py-0.5 rounded border font-medium leading-none ${cfg.textCls} ${cfg.bgCls} ${cfg.borderCls}`}>
                                  {cfg.emoji} {cfg.label}
                                </span>
                              );
                            })()}
                          </div>
                          {lead.category && (
                            <div className="text-xs text-ceibo-600 mt-0.5">{lead.category}</div>
                          )}
                          <FitLabel priority={priority} estimatedValue={lead.estimated_value} />
                          {lead.contact_reason ? (
                            <div className="text-xs text-gray-500 max-w-xs mt-1 leading-relaxed line-clamp-2">
                              {lead.contact_reason}
                            </div>
                          ) : lead.description && (
                            <div className="text-xs text-gray-500 truncate max-w-xs mt-0.5">
                              {lead.description}
                            </div>
                          )}
                          {/* Auto-tags preview */}
                          {(() => {
                            const tags: string[] = (() => { try { return JSON.parse(lead.tags ?? "[]"); } catch { return []; } })();
                            if (tags.length === 0) return null;
                            return (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {tags.slice(0, 3).map((tag) => (
                                  <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-500 border border-gray-700">
                                    {tag}
                                  </span>
                                ))}
                                {tags.length > 3 && (
                                  <span className="text-xs text-gray-700">+{tags.length - 3}</span>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <span className="text-gray-400 text-xs">
                        {lead.platform === "google_maps" ? "Google Maps" : "Instagram"}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <WebsiteBadge lead={lead} />
                    </td>

                    <td className="px-4 py-3 text-xs">
                      {lead.phone ? (() => {
                        const phoneInfo = classifyPhone(lead.phone);
                        return (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-gray-400 font-mono">{lead.phone}</span>
                            {phoneInfo.type !== "unknown" && (
                              <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${
                                phoneInfo.type === "mobile"
                                  ? "bg-ceibo-950 text-ceibo-500 border-ceibo-900"
                                  : "bg-gray-800 text-gray-500 border-gray-700"
                              }`}>
                                {phoneInfo.type === "mobile" ? "WhatsApp" : "Fijo"}
                              </span>
                            )}
                          </div>
                        );
                      })() : (
                        <span className="text-gray-700">—</span>
                      )}
                      {lead.email && <div className="text-gray-500 mt-0.5">{lead.email}</div>}
                    </td>

                    <td className="px-4 py-3 text-gray-400 text-xs max-w-xs truncate">
                      {lead.location ?? "-"}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className={`text-xs px-2 py-1 rounded border ${contactStatusBadge[lead.status]}`}>
                          {contactStatusLabel[lead.status]}
                        </span>
                        {(() => {
                          const na = getNextAction(lead);
                          if (na.action === "none") return null;
                          return (
                            <span className={`text-xs ${na.color}`} title={na.label}>
                              {na.icon} {na.label}
                            </span>
                          );
                        })()}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {/* Favorite star */}
                        <button
                          onClick={() => onUpdate(lead.id, { is_favorite: !lead.is_favorite })}
                          title={lead.is_favorite ? "Quitar de favoritos" : "Marcar como favorito"}
                          className={`text-sm transition-colors ${
                            lead.is_favorite
                              ? "text-yellow-400"
                              : "text-gray-700 hover:text-yellow-400"
                          }`}
                        >
                          {lead.is_favorite ? "⭐" : "☆"}
                        </button>
                        <button
                          onClick={() => setSelectedLead(lead)}
                          className="text-xs text-ceibo-400 hover:text-ceibo-300 transition-colors"
                        >
                          Ver
                        </button>
                        <button
                          onClick={() => setMessageLead(lead)}
                          className="text-xs text-purple-400 hover:text-purple-300 transition-colors whitespace-nowrap"
                          title="Generar mensaje de contacto"
                        >
                          ✉
                        </button>
                        <a
                          href={lead.profile_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-gray-600 hover:text-gray-300 transition-colors"
                          title="Abrir perfil"
                        >
                          ↗
                        </a>
                        {onDelete && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`¿Eliminar "${lead.name}"?`)) onDelete(lead.id);
                            }}
                            title="Eliminar lead"
                            className="text-gray-700 hover:text-red-400 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
        <MessageModal
          lead={messageLead}
          onClose={() => setMessageLead(null)}
        />
      )}
    </>
  );
}
