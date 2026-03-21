"use client";

import { useState, useEffect, useRef } from "react";
import type {
  Lead, LeadPriority, LeadStatus, WebsiteQuality, ContactLog,
  DetectedOpportunity, EnrichmentData, Campaign, LeadEvent,
} from "@/lib/types";
import type { ScoreBreakdown } from "@/lib/lead-score";
import type { AiLeadAnalysis } from "@/lib/ai/types";
import { DIFFICULTY_CONFIG } from "@/lib/sales/difficultyEngine";
import { getContactTiming } from "@/lib/sales/contactTimingEngine";
import { SEGMENT_LABELS, SEGMENT_COLORS, type SegmentTag } from "@/lib/sales/segmentationEngine";

const SEQUENCE_STAGES = [
  { key: "none",          label: "Sin iniciar"    },
  { key: "first_contact", label: "1er contacto"   },
  { key: "followup_1",    label: "Seguimiento 1"  },
  { key: "followup_2",    label: "Seguimiento 2"  },
  { key: "done",          label: "Finalizado"     },
] as const;
type SequenceStage = typeof SEQUENCE_STAGES[number]["key"];

interface LeadModalProps {
  lead: Lead;
  onClose: () => void;
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
}

// ─── Config maps ──────────────────────────────────────────────────────────────
const statusConfig: Record<LeadStatus, { label: string; className: string }> = {
  not_contacted: { label: "Sin contactar", className: "bg-gray-700 text-gray-300" },
  contacted:     { label: "Contactado",    className: "bg-blue-900 text-blue-300"   },
  interested:    { label: "Interesado",    className: "bg-ceibo-900 text-ceibo-300" },
};
const qualityConfig: Record<WebsiteQuality, { label: string; bar: string; text: string }> = {
  good:              { label: "GOOD WEBSITE", bar: "bg-ceibo-500",  text: "text-ceibo-400"  },
  needs_improvement: { label: "WEAK WEBSITE", bar: "bg-yellow-500", text: "text-yellow-400" },
  poor:              { label: "BAD WEBSITE",  bar: "bg-orange-500", text: "text-orange-400" },
};
const impactBadge: Record<DetectedOpportunity["impact"], string> = {
  high:   "bg-red-950 text-red-400 border-red-900",
  medium: "bg-yellow-950 text-yellow-500 border-yellow-900",
  low:    "bg-gray-800 text-gray-500 border-gray-700",
};
const enrichmentLabel = {
  activity_level:   { active: "Activo", low_activity: "Baja actividad", unknown: "Desconocido" },
  digital_maturity: { none: "Sin presencia", basic: "Básica", established: "Establecida" },
  business_size:    { small: "Pequeño", medium: "Mediano", unknown: "Desconocido" },
  social_quality:   { strong: "Fuerte", moderate: "Moderada", weak: "Débil", none: "Sin presencia" },
};
const TAG_COLORS = [
  "bg-ceibo-950 text-ceibo-400 border-ceibo-800",
  "bg-blue-950 text-blue-400 border-blue-800",
  "bg-purple-950 text-purple-400 border-purple-800",
  "bg-orange-950 text-orange-400 border-orange-800",
  "bg-pink-950 text-pink-400 border-pink-800",
];
function tagColor(tag: string) { return TAG_COLORS[tag.charCodeAt(0) % TAG_COLORS.length]; }

// ─── Event icon / color ───────────────────────────────────────────────────────
function eventMeta(type: string): { icon: string; color: string } {
  switch (type) {
    case "status_changed":       return { icon: "●", color: "text-blue-400" };
    case "note_added":           return { icon: "✎", color: "text-gray-400" };
    case "tag_added":            return { icon: "＋", color: "text-ceibo-400" };
    case "tag_removed":          return { icon: "－", color: "text-red-400"  };
    case "ai_analyzed":          return { icon: "✦", color: "text-ceibo-400" };
    case "favorited":            return { icon: "⭐", color: "text-yellow-400" };
    case "unfavorited":          return { icon: "☆", color: "text-gray-500"   };
    case "contacted_whatsapp":   return { icon: "💬", color: "text-ceibo-400" };
    case "contacted_email":      return { icon: "✉", color: "text-blue-400"  };
    case "created":              return { icon: "○", color: "text-gray-600"  };
    default:                     return { icon: "·", color: "text-gray-600"  };
  }
}

// ─── Score bar for a single factor ────────────────────────────────────────────
const MAX_SINGLE_FACTOR = 40; // no_website weight is the max
function ScoreFactorRow({ item }: { item: ScoreBreakdown }) {
  const pct = Math.round((item.points / MAX_SINGLE_FACTOR) * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-400 flex-1 truncate">{item.label}</span>
      <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden shrink-0">
        <div className="h-full bg-ceibo-500 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-ceibo-400 w-8 text-right shrink-0">+{item.points}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function LeadModal({ lead, onClose, onUpdate }: LeadModalProps) {
  // Slide-in animation
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Form state
  const [status, setStatus]           = useState<LeadStatus>(lead.status);
  const [notes, setNotes]             = useState(lead.notes ?? "");
  const [saving, setSaving]           = useState(false);
  const [isFavorite, setIsFavorite]   = useState(Boolean(lead.is_favorite));
  const [favSaving, setFavSaving]     = useState(false);

  // Tags
  const [tags, setTags]       = useState<string[]>(() => { try { return JSON.parse(lead.tags ?? "[]"); } catch { return []; } });
  const [tagInput, setTagInput] = useState("");

  // Sequence
  const [sequenceStage, setSequenceStage] = useState<SequenceStage>((lead.sequence_stage as SequenceStage) ?? "none");
  const [nextFollowup, setNextFollowup]   = useState(lead.next_followup_at?.split("T")[0] ?? "");

  // Campaign
  const [campaigns, setCampaigns]               = useState<Campaign[]>([]);
  const [leadCampaignIds, setLeadCampaignIds]   = useState<number[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [campaignSaving, setCampaignSaving]     = useState(false);

  // History
  const [events, setEvents]     = useState<LeadEvent[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Contact loading
  const [contactLoading, setContactLoading] = useState<string | null>(null);

  // AI state
  const [aiLoading, setAiLoading]       = useState(false);
  const [aiError, setAiError]           = useState<string | null>(null);
  const [aiSummary, setAiSummary]       = useState<string | null>(lead.ai_summary ?? null);
  const [aiAnalysis, setAiAnalysis]     = useState<AiLeadAnalysis | null>(() => {
    try { return lead.ai_analysis ? JSON.parse(lead.ai_analysis) : null; } catch { return null; }
  });
  const [aiPremiumTier, setAiPremiumTier] = useState<"$" | "$$" | "$$$" | null>(lead.ai_premium_tier ?? null);

  // Score breakdown open/closed
  const [scoreOpen, setScoreOpen] = useState(false);

  // Parsed static data
  const quality        = lead.website_quality as WebsiteQuality | null;
  const priority       = lead.lead_priority as LeadPriority | null;
  const scoreBreakdown = useRef<ScoreBreakdown[]>(lead.lead_score_breakdown ? (() => { try { return JSON.parse(lead.lead_score_breakdown!); } catch { return []; } })() : []);
  const issues         = lead.website_quality_issues  ? (() => { try { return JSON.parse(lead.website_quality_issues!); } catch { return []; } })() : [] as string[];
  const opportunities  = lead.opportunities ? (() => { try { return JSON.parse(lead.opportunities!); } catch { return []; } })() : [] as DetectedOpportunity[];
  const enrichment     = lead.enrichment_data ? (() => { try { return JSON.parse(lead.enrichment_data!) as EnrichmentData; } catch { return null; } })() : null;

  useEffect(() => {
    Promise.all([
      fetch("/api/campaigns").then(r => r.json()),
      fetch(`/api/leads/${lead.id}/campaigns`).then(r => r.json()),
    ]).then(([all, mine]) => {
      setCampaigns(all ?? []);
      setLeadCampaignIds((mine ?? []).map((c: Campaign) => c.id));
    }).catch(() => {});

    fetch(`/api/leads/${lead.id}/events`).then(r => r.json()).then(setEvents).catch(() => {});
  }, [lead.id]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleContactAction = async (channel: "whatsapp" | "email") => {
    setContactLoading(channel);
    try {
      const res = await fetch(`/api/leads/${lead.id}/contact`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel }),
      });
      const data = await res.json();
      if (!res.ok) return;
      window.open(data.url, "_blank");
      if (data.updated_lead?.status !== status) {
        setStatus(data.updated_lead.status);
        onUpdate(lead.id, { status: data.updated_lead.status });
      }
      // Refresh events after contact
      fetch(`/api/leads/${lead.id}/events`).then(r => r.json()).then(setEvents).catch(() => {});
    } finally { setContactLoading(null); }
  };

  const handleFavoriteToggle = async () => {
    setFavSaving(true);
    const next = !isFavorite;
    setIsFavorite(next); // optimistic
    await onUpdate(lead.id, { is_favorite: next });
    setFavSaving(false);
    // Refresh events
    fetch(`/api/leads/${lead.id}/events`).then(r => r.json()).then(setEvents).catch(() => {});
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (tag && !tags.includes(tag)) setTags(prev => [...prev, tag]);
    setTagInput("");
  };
  const removeTag = (tag: string) => setTags(prev => prev.filter(t => t !== tag));

  const addToCampaign = async () => {
    if (!selectedCampaignId) return;
    setCampaignSaving(true);
    await fetch(`/api/campaigns/${selectedCampaignId}/leads`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadIds: [lead.id] }),
    });
    setLeadCampaignIds(prev => [...prev, Number(selectedCampaignId)]);
    setSelectedCampaignId(""); setCampaignSaving(false);
  };
  const removeFromCampaign = async (cid: number) => {
    await fetch(`/api/campaigns/${cid}/leads`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: lead.id }),
    });
    setLeadCampaignIds(prev => prev.filter(id => id !== cid));
  };

  const handleSave = async () => {
    setSaving(true);
    await onUpdate(lead.id, { status, notes, tags, sequence_stage: sequenceStage, next_followup_at: nextFollowup || null });
    setSaving(false);
    onClose();
  };

  const handleAiAnalyze = async () => {
    setAiLoading(true); setAiError(null);
    try {
      const res = await fetch(`/api/leads/${lead.id}/ai-analyze`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setAiError(data.error ?? "Error al analizar con AI"); return; }
      setAiSummary(data.summary);
      setAiAnalysis(data.analysis);
      setAiPremiumTier(data.premium_tier);
      fetch(`/api/leads/${lead.id}/events`).then(r => r.json()).then(setEvents).catch(() => {});
    } catch { setAiError("Error de conexión con AI"); }
    finally { setAiLoading(false); }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`relative w-full max-w-2xl h-full bg-gray-900 border-l border-gray-700 flex flex-col shadow-2xl transition-transform duration-300 ease-out ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* ── Sticky header ──────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-6 py-4 shrink-0">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-white leading-tight truncate">{lead.name}</h2>
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                {lead.category && (
                  <span className="text-xs text-ceibo-500">{lead.category}</span>
                )}
                {lead.category && lead.location && <span className="text-gray-700 text-xs">·</span>}
                {lead.location && (
                  <span className="text-xs text-gray-500">{lead.location}</span>
                )}
                <span className="text-gray-700 text-xs">·</span>
                <span className="text-xs text-gray-500">
                  {lead.platform === "google_maps" ? "Google Maps" : "Instagram"}
                </span>
              </div>
            </div>

            {/* Favorite + Close */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleFavoriteToggle}
                disabled={favSaving}
                title={isFavorite ? "Quitar de favoritos" : "Marcar como favorito"}
                className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-colors ${
                  isFavorite
                    ? "bg-yellow-950/60 border-yellow-800 text-yellow-400"
                    : "bg-gray-800 border-gray-700 text-gray-500 hover:text-yellow-400 hover:border-yellow-800"
                }`}
              >
                {isFavorite ? "⭐" : "☆"}
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-700 bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Quick badges row */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {/* Difficulty badge */}
            {lead.difficulty_level && (() => {
              const cfg = DIFFICULTY_CONFIG[lead.difficulty_level];
              return (
                <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${cfg.textCls} ${cfg.bgCls} ${cfg.borderCls}`}>
                  {cfg.emoji} {cfg.label}
                </span>
              );
            })()}

            {priority === "high" && (
              <span className="text-xs px-2 py-0.5 rounded-full border bg-red-950/80 text-red-300 border-red-900 font-semibold">🔥 Perfect Fit</span>
            )}
            {priority === "medium" && (
              <span className="text-xs px-2 py-0.5 rounded-full border bg-yellow-950/80 text-yellow-400 border-yellow-900 font-semibold">👍 Good Fit</span>
            )}
            {priority === "low" && (
              <span className="text-xs px-2 py-0.5 rounded-full border bg-gray-800 text-gray-500 border-gray-700 font-semibold">❌ Low Fit</span>
            )}

            {/* Ceibo Fit score pill */}
            {lead.lead_score !== null && (
              <span className={`text-xs px-2 py-0.5 rounded-full border font-mono font-bold ${
                priority === "high"   ? "bg-red-950/60 text-red-400 border-red-900" :
                priority === "medium" ? "bg-yellow-950/60 text-yellow-400 border-yellow-900" :
                                        "bg-gray-800 text-gray-500 border-gray-700"
              }`}>{lead.lead_score}/100</span>
            )}

            {/* AI premium tier */}
            {aiPremiumTier && (
              <span className={`text-xs px-2 py-0.5 rounded-full border font-mono font-bold ${
                aiPremiumTier === "$$$" ? "bg-emerald-950/60 text-emerald-400 border-emerald-800" :
                aiPremiumTier === "$$"  ? "bg-ceibo-950 text-ceibo-400 border-ceibo-800" :
                                          "bg-gray-800 text-gray-500 border-gray-700"
              }`}>{aiPremiumTier}</span>
            )}

            {/* Heuristic estimated_value fallback */}
            {!aiPremiumTier && lead.estimated_value === "high" && (
              <span className="text-xs px-2 py-0.5 rounded-full border bg-emerald-950/60 text-emerald-400 border-emerald-800 font-mono font-bold">$$$ Alto valor</span>
            )}
            {!aiPremiumTier && lead.estimated_value === "medium" && (
              <span className="text-xs px-2 py-0.5 rounded-full border bg-ceibo-950 text-ceibo-400 border-ceibo-800 font-mono">$$ Valor medio</span>
            )}

            {/* Status */}
            <span className={`text-xs px-2 py-0.5 rounded-full border ml-auto ${statusConfig[status].className} border-current`}>
              {statusConfig[status].label}
            </span>
          </div>
        </div>

        {/* ── Scrollable content ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* ── Contact Context Panel ────────────────────────────────────────── */}
          {(() => {
            const timing = getContactTiming({ ...lead, status });
            const segments: SegmentTag[] = (() => { try { return JSON.parse(lead.segment_tags ?? "[]"); } catch { return []; } })();
            const timingColor =
              timing.recommendation === "contact_now"  ? "text-ceibo-400" :
              timing.recommendation === "followup_now" ? "text-orange-400" :
                                                          "text-gray-400";
            const timingIcon =
              timing.recommendation === "contact_now"  ? "📞" :
              timing.recommendation === "followup_now" ? "🔔" : "⏳";

            return (
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Contexto de Contacto</p>

                {/* Timing row */}
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className={`flex items-center gap-1.5 text-sm font-medium ${timingColor}`}>
                      <span>{timingIcon}</span>
                      <span>{timing.recommendation === "contact_now" ? "Contactar ahora" :
                             timing.recommendation === "followup_now" ? "Hacer seguimiento" :
                             `Esperar ${timing.waitDays} día${timing.waitDays === 1 ? "" : "s"}`}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{timing.reason}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-gray-400 font-medium">{timing.window}</div>
                    <div className="text-xs text-gray-600">{timing.days}</div>
                  </div>
                </div>

                {/* Segments */}
                {segments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1 border-t border-gray-700">
                    {segments.map(s => (
                      <span key={s} className={`text-xs px-2 py-0.5 rounded-full border ${SEGMENT_COLORS[s]}`}>
                        {SEGMENT_LABELS[s]}
                      </span>
                    ))}
                  </div>
                )}

                {/* Quick signals */}
                <div className="flex flex-wrap gap-3 pt-1 border-t border-gray-700 text-xs text-gray-500">
                  {enrichment?.activity_level && (
                    <span>Actividad: <span className={enrichment.activity_level === "active" ? "text-ceibo-400" : "text-gray-400"}>
                      {enrichment.activity_level === "active" ? "Activo" : enrichment.activity_level === "low_activity" ? "Baja actividad" : "—"}
                    </span></span>
                  )}
                  {lead.is_hot && <span className="text-red-400 font-medium">🔥 Hot lead</span>}
                  {lead.is_favorite && <span className="text-yellow-400">⭐ Favorito</span>}
                  {lead.location_region && <span className="text-gray-500">📍 {lead.location_region}</span>}
                </div>
              </div>
            );
          })()}

          {/* Contact reason */}
          {lead.contact_reason && (
            <div className="bg-ceibo-950/40 border border-ceibo-900 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-400 font-medium mb-1 uppercase tracking-wide">Razón de contacto</p>
              <p className="text-sm text-ceibo-200 leading-relaxed">{lead.contact_reason}</p>
            </div>
          )}

          {/* Business diagnosis */}
          {lead.business_diagnosis && (
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-500 font-medium mb-1 uppercase tracking-wide">Diagnóstico</p>
              <p className="text-xs text-gray-300 leading-relaxed">{lead.business_diagnosis}</p>
            </div>
          )}

          {/* ── AI Section ───────────────────────────────────────────────────── */}
          <div className="border border-gray-700 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-gray-800/60">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-ceibo-400 uppercase tracking-wide">✦ Análisis AI</span>
                {aiPremiumTier && (
                  <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full border ${
                    aiPremiumTier === "$$$" ? "bg-emerald-950/60 text-emerald-400 border-emerald-800" :
                    aiPremiumTier === "$$"  ? "bg-ceibo-950 text-ceibo-400 border-ceibo-800" :
                                              "bg-gray-800 text-gray-500 border-gray-700"
                  }`}>{aiPremiumTier}</span>
                )}
              </div>
              <button
                onClick={handleAiAnalyze}
                disabled={aiLoading}
                className="text-xs px-3 py-1.5 rounded-lg bg-ceibo-900 hover:bg-ceibo-800 disabled:bg-gray-800 disabled:text-gray-500 text-ceibo-300 border border-ceibo-700 transition-colors font-medium"
              >
                {aiLoading ? "Analizando..." : aiSummary ? "Re-analizar" : "Analizar con AI"}
              </button>
            </div>
            {aiError && (
              <div className="px-4 py-2 bg-red-950/40 border-t border-red-900">
                <p className="text-xs text-red-400">{aiError}</p>
              </div>
            )}
            {aiSummary ? (
              <div className="px-4 py-4 border-t border-gray-700 space-y-4">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Resumen</p>
                  <p className="text-sm text-gray-200 leading-relaxed">{aiSummary}</p>
                </div>
                {aiAnalysis && (
                  <>
                    {aiAnalysis.digital_weaknesses.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1.5">Debilidades digitales</p>
                        <ul className="space-y-1">
                          {aiAnalysis.digital_weaknesses.map((w, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-xs text-gray-300">
                              <span className="text-red-500 shrink-0 mt-0.5">✕</span>{w}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {aiAnalysis.business_opportunities.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1.5">Oportunidades</p>
                        <ul className="space-y-1">
                          {aiAnalysis.business_opportunities.map((o, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-xs text-gray-300">
                              <span className="text-ceibo-500 shrink-0 mt-0.5">→</span>{o}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {aiAnalysis.digital_maturity_assessment && (
                      <div>
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Madurez digital</p>
                        <p className="text-xs text-gray-300">{aiAnalysis.digital_maturity_assessment}</p>
                      </div>
                    )}
                    {aiAnalysis.missing_conversion_channels.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1.5">Canales faltantes</p>
                        <div className="flex flex-wrap gap-1.5">
                          {aiAnalysis.missing_conversion_channels.map((c, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-orange-950/60 text-orange-400 border border-orange-900">{c}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : !aiLoading && (
              <div className="px-4 py-3 border-t border-gray-700">
                <p className="text-xs text-gray-600">Presiona &quot;Analizar con AI&quot; para generar un análisis comercial de este lead.</p>
              </div>
            )}
          </div>

          {/* ── Contact info ─────────────────────────────────────────────────── */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Información de contacto</h3>
            <div className="space-y-2 text-sm">
              {lead.phone && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 w-20 shrink-0">Teléfono</span>
                  <span className="text-gray-200 flex-1 font-mono text-xs">{lead.phone}</span>
                  <button
                    onClick={() => handleContactAction("whatsapp")}
                    disabled={contactLoading === "whatsapp"}
                    className="text-xs px-2.5 py-1 rounded-lg bg-ceibo-900 hover:bg-ceibo-800 disabled:bg-gray-800 text-ceibo-300 border border-ceibo-700 transition-colors"
                  >
                    {contactLoading === "whatsapp" ? "..." : "WhatsApp"}
                  </button>
                </div>
              )}
              {lead.email && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 w-20 shrink-0">Email</span>
                  <span className="text-gray-200 flex-1 truncate text-xs">{lead.email}</span>
                  <button
                    onClick={() => handleContactAction("email")}
                    disabled={contactLoading === "email"}
                    className="text-xs px-2.5 py-1 rounded-lg bg-blue-950 hover:bg-blue-900 disabled:bg-gray-800 text-blue-300 border border-blue-800 transition-colors"
                  >
                    {contactLoading === "email" ? "..." : "Email"}
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <span className="text-gray-500 w-20 shrink-0">Perfil</span>
                <a href={lead.profile_url} target="_blank" rel="noopener noreferrer"
                  className="text-ceibo-400 hover:underline truncate text-xs">{lead.profile_url}</a>
              </div>
              {lead.website_url && (
                <div className="flex gap-2">
                  <span className="text-gray-500 w-20 shrink-0">Website</span>
                  <a href={lead.website_url} target="_blank" rel="noopener noreferrer"
                    className="text-ceibo-400 hover:underline truncate text-xs">{lead.website_url}</a>
                </div>
              )}
              {lead.description && (
                <div className="flex gap-2">
                  <span className="text-gray-500 w-20 shrink-0 mt-0.5">Bio</span>
                  <span className="text-gray-300 text-xs flex-1 leading-relaxed">{lead.description}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Ceibo Fit Score breakdown ─────────────────────────────────────── */}
          {lead.lead_score !== null && (
            <div className={`rounded-xl border overflow-hidden ${
              priority === "high"   ? "border-red-900" :
              priority === "medium" ? "border-yellow-900" : "border-gray-700"
            }`}>
              <button
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-800/60 hover:bg-gray-800 transition-colors"
                onClick={() => setScoreOpen(o => !o)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Ceibo Fit Score</span>
                  <span className={`text-xl font-bold font-mono ${
                    priority === "high"   ? "text-red-400" :
                    priority === "medium" ? "text-yellow-400" : "text-gray-500"
                  }`}>{lead.lead_score}</span>
                  <div className="w-20 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${
                      priority === "high"   ? "bg-red-500" :
                      priority === "medium" ? "bg-yellow-500" : "bg-gray-600"
                    }`} style={{ width: `${lead.lead_score}%` }} />
                  </div>
                </div>
                <span className="text-gray-500 text-xs">{scoreOpen ? "▲ Ocultar" : "▼ Ver desglose"}</span>
              </button>

              {scoreOpen && scoreBreakdown.current.length > 0 && (
                <div className="px-4 py-3 border-t border-gray-700 space-y-2.5">
                  {scoreBreakdown.current.map((item, i) => (
                    <ScoreFactorRow key={i} item={item} />
                  ))}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                    <span className="text-xs text-gray-500 font-medium">Total</span>
                    <span className="text-sm font-mono font-bold text-white">{lead.lead_score}/100</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Website status ───────────────────────────────────────────────── */}
          {lead.has_website && quality ? (
            <div className="bg-gray-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold ${qualityConfig[quality].text}`}>{qualityConfig[quality].label}</span>
                <span className={`text-sm font-mono font-bold ${qualityConfig[quality].text}`}>{lead.website_quality_score}/100</span>
              </div>
              <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${qualityConfig[quality].bar}`} style={{ width: `${lead.website_quality_score ?? 0}%` }} />
              </div>
              {lead.website_quality_summary && <p className="text-xs text-gray-400">{lead.website_quality_summary}</p>}
              {issues.length > 0 && (
                <ul className="space-y-1 mt-1">
                  {issues.map((issue: string, i: number) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-gray-400">
                      <span className="text-orange-500 shrink-0">✕</span>{issue}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : !lead.has_website && (
            <div className="bg-red-950/50 border border-red-900 rounded-xl p-3">
              <p className="text-xs text-red-400 font-medium">Sin website — lead prioritario para desarrollo web.</p>
            </div>
          )}

          {/* ── Opportunities ────────────────────────────────────────────────── */}
          {opportunities.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Oportunidades detectadas</h3>
              <div className="space-y-2">
                {opportunities.map((op: DetectedOpportunity) => (
                  <div key={op.code} className={`rounded-lg px-3 py-2 border ${impactBadge[op.impact]}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">{op.label}</span>
                      <span className="text-xs opacity-60 capitalize ml-auto">Impacto {op.impact}</span>
                    </div>
                    <p className="text-xs opacity-70 mt-0.5 leading-relaxed">{op.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Enrichment ───────────────────────────────────────────────────── */}
          {enrichment && (
            <div className="bg-gray-800 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Señales del negocio</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div className="flex justify-between"><span className="text-gray-500">Actividad</span><span className="text-gray-300">{enrichmentLabel.activity_level[enrichment.activity_level]}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Madurez digital</span><span className="text-gray-300">{enrichmentLabel.digital_maturity[enrichment.digital_maturity]}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Tamaño</span><span className="text-gray-300">{enrichmentLabel.business_size[enrichment.business_size]}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Presencia social</span><span className="text-gray-300">{enrichmentLabel.social_quality[enrichment.social_quality]}</span></div>
                {enrichment.sells_online !== null && (
                  <div className="flex justify-between col-span-2">
                    <span className="text-gray-500">Venta online</span>
                    <span className={enrichment.sells_online ? "text-ceibo-400" : "text-gray-400"}>
                      {enrichment.sells_online ? "Señales detectadas" : "No detectado"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Tags ─────────────────────────────────────────────────────────── */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tags</h3>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map(tag => (
                <span key={tag} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${tagColor(tag)}`}>
                  {tag}
                  <button onClick={() => removeTag(tag)} className="opacity-60 hover:opacity-100 ml-0.5">×</button>
                </span>
              ))}
              {tags.length === 0 && <span className="text-xs text-gray-600">Sin tags</span>}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="agregar tag..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-ceibo-500"
              />
              <button onClick={addTag} className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 transition-colors">
                + Agregar
              </button>
            </div>
          </div>

          {/* ── Sequence ─────────────────────────────────────────────────────── */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Secuencia de contacto</h3>
            <div className="flex gap-1.5 flex-wrap mb-2">
              {SEQUENCE_STAGES.map(stage => (
                <button
                  key={stage.key}
                  type="button"
                  onClick={() => setSequenceStage(stage.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    sequenceStage === stage.key
                      ? "bg-ceibo-900 border-ceibo-700 text-ceibo-300"
                      : "bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600"
                  }`}
                >
                  {stage.label}
                </button>
              ))}
            </div>
            {(sequenceStage === "followup_1" || sequenceStage === "followup_2") && (
              <div className="flex items-center gap-2 mt-2">
                <label className="text-xs text-gray-500 shrink-0">Próximo seguimiento:</label>
                <input type="date" value={nextFollowup} onChange={e => setNextFollowup(e.target.value)}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-ceibo-500" />
              </div>
            )}
            {sequenceStage !== "none" && lead.last_contacted_at && (
              <p className="text-xs text-gray-600 mt-1">
                Último contacto: {new Date(lead.last_contacted_at).toLocaleDateString("es-UY")}
              </p>
            )}
          </div>

          {/* ── Campaigns ────────────────────────────────────────────────────── */}
          {campaigns.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Campañas</h3>
              {leadCampaignIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {campaigns.filter(c => leadCampaignIds.includes(c.id)).map(c => (
                    <span key={c.id} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-purple-950 border border-purple-800 text-purple-300">
                      {c.name}
                      <button onClick={() => removeFromCampaign(c.id)} className="opacity-60 hover:opacity-100 ml-0.5" title="Quitar de campaña">×</button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <select value={selectedCampaignId} onChange={e => setSelectedCampaignId(e.target.value)}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-ceibo-500">
                  <option value="">Agregar a campaña...</option>
                  {campaigns.filter(c => !leadCampaignIds.includes(c.id)).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button onClick={addToCampaign} disabled={!selectedCampaignId || campaignSaving}
                  className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40 border border-gray-700 text-gray-300 transition-colors">
                  {campaignSaving ? "..." : "Agregar"}
                </button>
              </div>
            </div>
          )}

          {/* ── Status ───────────────────────────────────────────────────────── */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Estado</h3>
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(statusConfig) as LeadStatus[]).map(s => (
                <button key={s} onClick={() => setStatus(s)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                    status === s ? `${statusConfig[s].className} border-current` : "bg-gray-800 text-gray-500 border-gray-700 hover:border-gray-600"
                  }`}>
                  {statusConfig[s].label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Notes ────────────────────────────────────────────────────────── */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notas internas</h3>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Escribe notas sobre este lead..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-ceibo-500 resize-none"
            />
          </div>

          {/* ── History timeline ─────────────────────────────────────────────── */}
          <div>
            <button
              className="flex items-center justify-between w-full mb-3"
              onClick={() => setHistoryOpen(o => !o)}
            >
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Historial ({events.length})
              </h3>
              <span className="text-xs text-gray-600">{historyOpen ? "▲ Ocultar" : "▼ Ver"}</span>
            </button>

            {historyOpen && (
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-800" />
                <div className="space-y-3">
                  {events.length === 0 && (
                    <p className="text-xs text-gray-600 pl-5">Sin eventos registrados</p>
                  )}
                  {events.map(ev => {
                    const meta = eventMeta(ev.event_type);
                    return (
                      <div key={ev.id} className="flex items-start gap-3">
                        <span className={`shrink-0 text-xs w-4 text-center mt-0.5 ${meta.color}`}>{meta.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-300">{ev.description}</p>
                          <p className="text-xs text-gray-600 mt-0.5">
                            {new Date(ev.created_at).toLocaleDateString("es-UY", {
                              day: "numeric", month: "short", year: "numeric",
                              hour: "2-digit", minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

        </div>
        {/* ── end scrollable content ──────────────────────────────────────────── */}

        {/* ── Sticky footer ──────────────────────────────────────────────────── */}
        <div className="sticky bottom-0 bg-gray-900/95 backdrop-blur border-t border-gray-800 px-6 py-4 flex gap-3 shrink-0">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-ceibo-600 hover:bg-ceibo-500 disabled:bg-gray-700 text-white font-semibold py-2 rounded-lg text-sm transition-colors"
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
          <button
            onClick={onClose}
            className="px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors border border-gray-700"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
