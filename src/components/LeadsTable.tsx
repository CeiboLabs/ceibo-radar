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

// Auto-tags that duplicate visible badges — hide from table display
const HIDDEN_AUTO_TAGS = new Set([
  "sin-website", "website-malo", "website-mejorable",
  "sin-contacto", "tiene-telefono", "tiene-email",
  "alta-prioridad", "baja-prioridad",
  "sin-presencia-digital", "instagram-activo",
]);

// ─── Config ───────────────────────────────────────────────────────────────────
const PRIORITY_COLOR: Record<LeadPriority, { score: string; bar: string; border: string }> = {
  high:   { score: "text-red-400",    bar: "bg-red-500",    border: "border-l-2 border-red-800"    },
  medium: { score: "text-yellow-400", bar: "bg-yellow-500", border: "border-l-2 border-yellow-800" },
  low:    { score: "text-gray-500",   bar: "bg-gray-700",   border: ""                              },
};

const STATUS_CFG: Record<LeadStatus, { label: string; cls: string }> = {
  not_contacted: { label: "Sin contactar", cls: "bg-gray-800/80 text-gray-400 border-gray-700"         },
  contacted:     { label: "Contactado",    cls: "bg-blue-950 text-blue-400 border-blue-800"           },
  interested:    { label: "Interesado",    cls: "bg-ceibo-950 text-ceibo-400 border-ceibo-800"        },
  proposal_sent: { label: "Propuesta",     cls: "bg-purple-950 text-purple-400 border-purple-800"     },
  closed_won:    { label: "Ganado ✓",      cls: "bg-emerald-950 text-emerald-400 border-emerald-800"  },
  closed_lost:   { label: "Perdido",       cls: "bg-red-950/70 text-red-400 border-red-900"           },
};

const WEBSITE_CFG: Record<string, { label: string; cls: string }> = {
  no_website:        { label: "Sin web",   cls: "text-red-400 bg-red-950/60 border-red-900"         },
  poor:              { label: "Web mala",  cls: "text-orange-400 bg-orange-950/60 border-orange-900" },
  needs_improvement: { label: "Web débil", cls: "text-yellow-500 bg-yellow-950/40 border-yellow-900" },
  good:              { label: "Web ✓",     cls: "text-ceibo-400 bg-ceibo-950/50 border-ceibo-900"   },
};

type SortKey = "lead_score" | "name" | "created_at";
type SortDir = "asc" | "desc";

// ─── Icon button helper ───────────────────────────────────────────────────────
function IconBtn({
  onClick, title, children, className = "",
}: {
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-8 h-8 flex items-center justify-center rounded-lg border border-gray-700 bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors text-sm ${className}`}
    >
      {children}
    </button>
  );
}

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
    const av = sortKey === "lead_score" ? (a.lead_score ?? -1) : sortKey === "name" ? a.name.toLowerCase() : a.created_at;
    const bv = sortKey === "lead_score" ? (b.lead_score ?? -1) : sortKey === "name" ? b.name.toLowerCase() : b.created_at;
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

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: "lead_score", label: "Score" },
    { key: "name",       label: "Nombre" },
    { key: "created_at", label: "Reciente" },
  ];

  return (
    <>
      {/* Sort bar — outside the card to avoid alignment issues */}
      <div className="flex items-center gap-2 px-1 mb-2">
        <span className="text-xs text-gray-600">Ordenar:</span>
        {SORT_OPTIONS.map(opt => (
          <button
            key={opt.key}
            onClick={() => toggleSort(opt.key)}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
              sortKey === opt.key
                ? "bg-gray-800 border-gray-600 text-gray-200"
                : "border-transparent text-gray-600 hover:text-gray-400"
            }`}
          >
            {opt.label}
            {sortKey === opt.key && (
              <span className="ml-1 text-ceibo-400">{sortDir === "desc" ? "↓" : "↑"}</span>
            )}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-gray-800 overflow-hidden">
        {/* Lead rows */}
        <div className="divide-y divide-gray-800/60">
          {sorted.map((lead) => {
            const priority = lead.lead_priority as LeadPriority | null;
            const pcfg     = priority ? PRIORITY_COLOR[priority] : null;
            const status   = STATUS_CFG[lead.status];
            const na       = getNextAction(lead);
            const phoneInfo = classifyPhone(lead.phone);
            const allTags: string[] = (() => { try { return JSON.parse(lead.tags ?? "[]"); } catch { return []; } })();
            const tags = allTags.filter(t => !HIDDEN_AUTO_TAGS.has(t));

            const webKey = !lead.has_website ? "no_website"
              : (lead.website_quality as WebsiteQuality | null) ?? null;
            const webBadge = webKey && WEBSITE_CFG[webKey] ? WEBSITE_CFG[webKey] : null;

            return (
              <div
                key={lead.id}
                onClick={() => setSelectedLead(lead)}
                className={`group relative flex items-center gap-3 px-4 py-3.5 bg-gray-900 hover:bg-gray-800/50 transition-colors cursor-pointer ${pcfg?.border ?? ""}`}
              >
                {/* Checkbox */}
                {onToggleCompare && (
                  <input
                    type="checkbox"
                    checked={compareIds?.has(lead.id) ?? false}
                    onChange={(e) => { e.stopPropagation(); onToggleCompare(lead.id); }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-3.5 h-3.5 rounded accent-ceibo-500 cursor-pointer shrink-0"
                  />
                )}

                {/* Score pill */}
                <div className="shrink-0 w-14 flex flex-col items-center gap-1">
                  <span className={`text-sm font-bold font-mono leading-none ${pcfg?.score ?? "text-gray-600"}`}>
                    {lead.lead_score ?? "—"}
                  </span>
                  <div className="w-10 h-1 bg-gray-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${pcfg?.bar ?? "bg-gray-700"}`}
                      style={{ width: lead.lead_score ? `${lead.lead_score}%` : "0%" }} />
                  </div>
                </div>

                {/* Business info — takes remaining space */}
                <div className="flex-1 min-w-0 space-y-1">
                  {/* Name row */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-white text-sm">{lead.name}</span>
                    {lead.is_hot && (
                      <span className="text-xs px-1 py-0.5 rounded bg-red-950 border border-red-800 text-red-400 font-medium leading-none">🔥</span>
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

                  {/* Meta row: category · platform · location */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {lead.category && <span className="text-xs text-ceibo-600">{lead.category}</span>}
                    <span className="text-gray-700 text-xs">·</span>
                    <span className="text-xs text-gray-600">{lead.platform === "google_maps" ? "Google Maps" : "Instagram"}</span>
                    {lead.location && (
                      <>
                        <span className="text-gray-700 text-xs">·</span>
                        <span className="text-xs text-gray-600 truncate max-w-[200px]">{lead.location}</span>
                      </>
                    )}
                  </div>

                  {/* Reason */}
                  {(lead.contact_reason || lead.description) && (
                    <p className="text-xs text-gray-500 leading-relaxed line-clamp-1 max-w-lg">
                      {lead.contact_reason ?? lead.description}
                    </p>
                  )}

                  {/* Tags + signals row */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {webBadge && (
                      <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${webBadge.cls}`}>
                        {webBadge.label}
                      </span>
                    )}
                    {lead.phone && (
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${
                        phoneInfo.canWhatsapp
                          ? "bg-ceibo-950/40 text-ceibo-500 border-ceibo-900"
                          : "bg-gray-800 text-gray-500 border-gray-700"
                      }`}>
                        {phoneInfo.canWhatsapp ? "📱 WhatsApp" : "☎ Fijo"}
                      </span>
                    )}
                    {tags.slice(0, 2).map(tag => (
                      <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-gray-800/80 text-gray-500 border border-gray-700/60">
                        {tag}
                      </span>
                    ))}
                    {tags.length > 2 && (
                      <span className="text-xs text-gray-700">+{tags.length - 2}</span>
                    )}
                  </div>
                </div>

                {/* Status block */}
                <div className="shrink-0 flex flex-col items-end gap-1 w-28">
                  <span className={`text-xs px-2 py-1 rounded-lg border whitespace-nowrap ${status.cls}`}>
                    {status.label}
                  </span>
                  {na.action !== "none" && (
                    <span className={`text-xs whitespace-nowrap ${na.color}`}>
                      {na.icon} {na.label}
                    </span>
                  )}
                </div>

                {/* Action buttons */}
                <div
                  className="shrink-0 flex items-center gap-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Favorite */}
                  <IconBtn
                    onClick={() => onUpdate(lead.id, { is_favorite: !lead.is_favorite })}
                    title={lead.is_favorite ? "Quitar favorito" : "Favorito"}
                    className={lead.is_favorite ? "text-yellow-400 border-yellow-900 bg-yellow-950/30 hover:bg-yellow-950/50 hover:text-yellow-300" : "hover:text-yellow-400"}
                  >
                    {lead.is_favorite ? "⭐" : "☆"}
                  </IconBtn>

                  {/* Ver lead — primary CTA */}
                  <button
                    onClick={() => setSelectedLead(lead)}
                    className="h-8 px-3 rounded-lg bg-ceibo-900 hover:bg-ceibo-800 border border-ceibo-700 text-ceibo-300 hover:text-ceibo-200 text-xs font-medium transition-colors whitespace-nowrap"
                  >
                    Ver →
                  </button>

                  {/* Extract info */}
                  <IconBtn
                    onClick={() => setMessageLead(lead)}
                    title="Extraer información para ChatGPT"
                    className="hover:text-purple-400 hover:border-purple-800"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </IconBtn>

                  {/* External profile */}
                  <a
                    href={lead.profile_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Abrir perfil externo"
                    onClick={(e) => e.stopPropagation()}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-700 bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors text-sm"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>

                  {/* Delete — visible on row hover only */}
                  {onDelete && (
                    <IconBtn
                      onClick={() => { if (confirm(`¿Eliminar "${lead.name}"?`)) onDelete(lead.id); }}
                      title="Eliminar lead"
                      className="opacity-0 group-hover:opacity-100 hover:text-red-400 hover:border-red-900 hover:bg-red-950/40"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </IconBtn>
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
