"use client";

import type { Lead, LeadPriority } from "@/lib/types";
import { computeDailyRank } from "@/lib/sales/dailyRankingEngine";
import { DIFFICULTY_CONFIG } from "@/lib/sales/difficultyEngine";
import { SEGMENT_LABELS, SEGMENT_COLORS, type SegmentTag } from "@/lib/sales/segmentationEngine";

interface ComparatorModalProps {
  leads: Lead[];
  onClose: () => void;
  onSelectLead: (lead: Lead) => void;
}

const PRIORITY_LABEL: Record<string, string> = { high: "Alta 🔥", medium: "Media 👍", low: "Baja" };
const VALUE_LABEL: Record<string, string> = { high: "$$$", medium: "$$", low: "$" };

function getActivity(lead: Lead): string {
  try {
    const e = JSON.parse(lead.enrichment_data ?? "{}");
    const m: Record<string, string> = { active: "Activo", low_activity: "Baja actividad", unknown: "—" };
    return m[e.activity_level] ?? "—";
  } catch { return "—"; }
}

function getSegments(lead: Lead): SegmentTag[] {
  try { return JSON.parse(lead.segment_tags ?? "[]"); } catch { return []; }
}

export function ComparatorModal({ leads, onClose, onSelectLead }: ComparatorModalProps) {
  const ranked = [...leads].sort((a, b) => computeDailyRank(b) - computeDailyRank(a));
  const best = ranked[0];

  const cellCls = (lead: Lead) =>
    `px-4 py-3 ${lead.id === best?.id ? "bg-ceibo-950/20" : ""}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-5xl bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <div>
            <h2 className="text-base font-bold text-white">Comparador de Leads</h2>
            <p className="text-xs text-gray-500 mt-0.5">{leads.length} leads seleccionados</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-700 bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Table */}
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-gray-900">
              <tr className="border-b border-gray-800">
                <th className="px-4 py-3 text-left text-xs text-gray-600 uppercase tracking-wide font-medium w-32" />
                {leads.map(lead => (
                  <th key={lead.id} className={`px-4 py-3 text-left ${lead.id === best?.id ? "bg-ceibo-950/20" : ""}`}>
                    <div className="font-semibold text-white text-sm leading-tight">{lead.name}</div>
                    {lead.category && <div className="text-xs text-ceibo-600 mt-0.5">{lead.category}</div>}
                    {lead.id === best?.id && (
                      <div className="text-xs text-ceibo-400 mt-1 font-medium">⭐ Recomendado</div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {/* Ceibo Fit Score */}
              <tr>
                <td className="px-4 py-3 text-xs text-gray-500 font-medium">Ceibo Fit</td>
                {leads.map(lead => (
                  <td key={lead.id} className={cellCls(lead)}>
                    <span className={`font-mono font-bold text-sm ${
                      lead.lead_priority === "high" ? "text-red-400" :
                      lead.lead_priority === "medium" ? "text-yellow-400" : "text-gray-500"
                    }`}>{lead.lead_score ?? "—"}</span>
                    <div className="h-1 w-16 bg-gray-800 rounded-full overflow-hidden mt-1">
                      <div className={`h-full rounded-full ${
                        lead.lead_priority === "high" ? "bg-red-500" :
                        lead.lead_priority === "medium" ? "bg-yellow-500" : "bg-gray-600"
                      }`} style={{ width: `${lead.lead_score ?? 0}%` }} />
                    </div>
                  </td>
                ))}
              </tr>

              {/* Priority */}
              <tr>
                <td className="px-4 py-3 text-xs text-gray-500 font-medium">Prioridad</td>
                {leads.map(lead => (
                  <td key={lead.id} className={`${cellCls(lead)} text-xs`}>
                    <span className={
                      lead.lead_priority === "high" ? "text-red-400" :
                      lead.lead_priority === "medium" ? "text-yellow-400" : "text-gray-500"
                    }>{PRIORITY_LABEL[lead.lead_priority ?? "low"] ?? "—"}</span>
                  </td>
                ))}
              </tr>

              {/* Difficulty */}
              <tr>
                <td className="px-4 py-3 text-xs text-gray-500 font-medium">Dificultad</td>
                {leads.map(lead => {
                  const cfg = lead.difficulty_level ? DIFFICULTY_CONFIG[lead.difficulty_level] : null;
                  return (
                    <td key={lead.id} className={`${cellCls(lead)} text-xs`}>
                      {cfg
                        ? <span className={cfg.textCls}>{cfg.emoji} {cfg.label}</span>
                        : <span className="text-gray-600">—</span>}
                    </td>
                  );
                })}
              </tr>

              {/* Estimated value */}
              <tr>
                <td className="px-4 py-3 text-xs text-gray-500 font-medium">Valor</td>
                {leads.map(lead => {
                  const tier = lead.ai_premium_tier ?? (lead.estimated_value ? VALUE_LABEL[lead.estimated_value] : null);
                  return (
                    <td key={lead.id} className={`${cellCls(lead)} text-xs font-mono font-bold`}>
                      <span className={
                        tier === "$$$" || lead.estimated_value === "high" ? "text-emerald-400" :
                        tier === "$$" || lead.estimated_value === "medium" ? "text-ceibo-400" : "text-gray-500"
                      }>{tier ?? "—"}</span>
                    </td>
                  );
                })}
              </tr>

              {/* Activity */}
              <tr>
                <td className="px-4 py-3 text-xs text-gray-500 font-medium">Actividad</td>
                {leads.map(lead => (
                  <td key={lead.id} className={`${cellCls(lead)} text-xs text-gray-300`}>
                    {getActivity(lead)}
                  </td>
                ))}
              </tr>

              {/* Website */}
              <tr>
                <td className="px-4 py-3 text-xs text-gray-500 font-medium">Website</td>
                {leads.map(lead => (
                  <td key={lead.id} className={`${cellCls(lead)} text-xs`}>
                    {!lead.has_website
                      ? <span className="text-red-400">Sin website</span>
                      : <span className={
                          lead.website_quality === "poor" ? "text-orange-400" :
                          lead.website_quality === "needs_improvement" ? "text-yellow-400" : "text-ceibo-400"
                        }>
                          {lead.website_quality === "poor" ? "Deficiente" :
                           lead.website_quality === "needs_improvement" ? "Mejorable" : "Bueno"}
                        </span>}
                  </td>
                ))}
              </tr>

              {/* Segments */}
              <tr>
                <td className="px-4 py-3 text-xs text-gray-500 font-medium">Segmentos</td>
                {leads.map(lead => (
                  <td key={lead.id} className={cellCls(lead)}>
                    <div className="flex flex-wrap gap-1">
                      {getSegments(lead).map(s => (
                        <span key={s} className={`text-xs px-1.5 py-0.5 rounded border ${SEGMENT_COLORS[s]}`}>
                          {SEGMENT_LABELS[s]}
                        </span>
                      ))}
                      {getSegments(lead).length === 0 && <span className="text-gray-600 text-xs">—</span>}
                    </div>
                  </td>
                ))}
              </tr>

              {/* Daily rank */}
              <tr>
                <td className="px-4 py-3 text-xs text-gray-500 font-medium">Rank diario</td>
                {leads.map(lead => (
                  <td key={lead.id} className={`${cellCls(lead)} font-mono text-sm ${lead.id === best?.id ? "text-ceibo-400 font-bold" : "text-gray-400"}`}>
                    {computeDailyRank(lead)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Recommendation footer */}
        {best && (
          <div className="px-6 py-4 border-t border-gray-800 bg-ceibo-950/20 flex items-center justify-between shrink-0">
            <div>
              <p className="text-xs text-gray-400">Mejor lead para contactar primero:</p>
              <p className="text-sm font-bold text-ceibo-300 mt-0.5">⭐ {best.name}</p>
            </div>
            <button
              onClick={() => { onClose(); onSelectLead(best); }}
              className="text-sm px-4 py-2 rounded-lg bg-ceibo-700 hover:bg-ceibo-600 text-white font-semibold transition-colors"
            >
              Ver lead →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
