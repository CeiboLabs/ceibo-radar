"use client";

import { useEffect, useState } from "react";
import type { Lead, LeadPriority } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────
interface OpportunitiesData {
  stats: {
    total: number;
    no_website: number;
    high_priority: number;
    untouched_high: number;
    high_value: number;
  };
  topLeads: Lead[];
  activeNoWeb: Lead[];
  freshOpportunities: Lead[];
  topNiches: {
    category: string;
    total: number;
    no_website: number;
    weak_website: number;
    avg_score: number;
  }[];
  topLocations: {
    search_location: string;
    total: number;
    no_website: number;
    high_priority: number;
    avg_score: number;
  }[];
}

// ─── Fit label ────────────────────────────────────────────────────────────────
const FIT_LABEL: Record<string, { emoji: string; label: string; className: string }> = {
  high:   { emoji: "🔥", label: "Perfect Fit", className: "bg-red-950/80 text-red-300 border-red-800" },
  medium: { emoji: "👍", label: "Good Fit",    className: "bg-yellow-950/80 text-yellow-300 border-yellow-800" },
  low:    { emoji: "❌", label: "Low Fit",     className: "bg-gray-800 text-gray-500 border-gray-700" },
};

const VALUE_BADGE: Record<string, string> = {
  high:   "text-emerald-400 font-bold",
  medium: "text-ceibo-400",
  low:    "text-gray-500",
};
const VALUE_LABEL: Record<string, string> = {
  high: "$$$", medium: "$$", low: "$",
};

function FitBadge({ priority }: { priority: LeadPriority | null | undefined }) {
  if (!priority) return null;
  const cfg = FIT_LABEL[priority];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.className}`}>
      {cfg.emoji} {cfg.label}
    </span>
  );
}

// ─── Lead card for opportunities ──────────────────────────────────────────────
function OpportunityCard({ lead, rank }: { lead: Lead; rank?: number }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {rank !== undefined && (
              <span className="text-gray-700 font-mono text-xs w-4 shrink-0">{rank}</span>
            )}
            <FitBadge priority={lead.lead_priority as LeadPriority} />
            {lead.estimated_value && (
              <span className={`text-xs font-mono ${VALUE_BADGE[lead.estimated_value] ?? ""}`}>
                {VALUE_LABEL[lead.estimated_value] ?? ""}
              </span>
            )}
          </div>
          <div className="font-semibold text-white text-sm truncate">{lead.name}</div>
          {lead.category && (
            <div className="text-xs text-ceibo-600 mt-0.5">{lead.category}</div>
          )}
          {lead.contact_reason && (
            <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{lead.contact_reason}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className={`text-2xl font-bold font-mono ${
            lead.lead_priority === "high" ? "text-red-400" :
            lead.lead_priority === "medium" ? "text-yellow-400" : "text-gray-600"
          }`}>{lead.lead_score ?? "—"}</div>
          <div className="text-xs text-gray-600 mt-0.5">{lead.search_location}</div>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-800">
        {!lead.has_website && (
          <span className="text-xs px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-900 font-medium">
            Sin web
          </span>
        )}
        {lead.phone && <span className="text-xs text-gray-500">📞 {lead.phone}</span>}
        {lead.email && <span className="text-xs text-gray-500 truncate">✉ {lead.email}</span>}
        <span className={`text-xs ml-auto px-2 py-0.5 rounded border ${
          lead.status === "not_contacted" ? "bg-gray-800 text-gray-500 border-gray-700" :
          lead.status === "contacted"     ? "bg-blue-950 text-blue-400 border-blue-800" :
                                            "bg-ceibo-950 text-ceibo-400 border-ceibo-800"
        }`}>{
          lead.status === "not_contacted" ? "Sin contactar" :
          lead.status === "contacted" ? "Contactado" : "Interesado"
        }</span>
      </div>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
        {subtitle && <p className="text-xs text-gray-600 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function OpportunitiesPage() {
  const [data, setData] = useState<OpportunitiesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"top" | "noweb" | "fresh">("top");

  useEffect(() => {
    fetch("/api/opportunities")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="text-gray-500 text-sm">Cargando oportunidades...</div>
      </main>
    );
  }

  if (!data) return null;

  const { stats } = data;

  const tabLeads =
    activeTab === "top"   ? data.topLeads :
    activeTab === "noweb" ? data.activeNoWeb :
                            data.freshOpportunities;

  const tabs = [
    { key: "top"   as const, label: "Top por score",        count: data.topLeads.length },
    { key: "noweb" as const, label: "Sin web activos",       count: data.activeNoWeb.length },
    { key: "fresh" as const, label: "Alta prioridad sin contactar", count: data.freshOpportunities.length },
  ];

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white">Top Oportunidades</h2>
        <p className="text-xs text-gray-600 mt-1">Las mejores oportunidades de venta basadas en fit, urgencia y valor estimado</p>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Leads totales",       value: stats.total,         color: "text-gray-300" },
          { label: "Sin website",         value: stats.no_website,    color: "text-red-400" },
          { label: "🔥 Perfect Fit",      value: stats.high_priority, color: "text-red-400" },
          { label: "Sin contactar (high)", value: stats.untouched_high, color: "text-orange-400" },
          { label: "$$$ Alto valor",      value: stats.high_value,    color: "text-emerald-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
            <div className="text-xs text-gray-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left: lead lists */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === tab.key
                    ? "bg-gray-800 text-white"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {tab.label}
                <span className="ml-1.5 text-gray-600">({tab.count})</span>
              </button>
            ))}
          </div>

          {/* Lead list */}
          {tabLeads.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
              <p className="text-gray-500 text-sm">No hay leads en esta categoría todavía.</p>
              <p className="text-gray-700 text-xs mt-1">Ejecutá una búsqueda para poblar el pipeline.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tabLeads.map((lead, i) => (
                <OpportunityCard key={lead.id} lead={lead} rank={i + 1} />
              ))}
            </div>
          )}
        </div>

        {/* Right: niches + locations */}
        <div className="space-y-6">

          {/* Top niches */}
          <Section title="Nichos ganadores" subtitle="Categorías con más oportunidades">
            {data.topNiches.length === 0 ? (
              <p className="text-xs text-gray-600">Sin datos de categorías todavía.</p>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                {data.topNiches.map((niche, i) => {
                  const opportunityCount = niche.no_website + niche.weak_website;
                  const density = niche.total > 0
                    ? Math.round((opportunityCount / niche.total) * 100)
                    : 0;
                  return (
                    <div
                      key={niche.category}
                      className={`px-4 py-3 ${i < data.topNiches.length - 1 ? "border-b border-gray-800" : ""}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white font-medium truncate">{niche.category}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="h-1 flex-1 bg-gray-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-ceibo-700 rounded-full"
                                style={{ width: `${density}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 shrink-0">{density}%</span>
                          </div>
                        </div>
                        <div className="shrink-0 ml-3 text-right">
                          <div className="text-sm font-bold text-ceibo-400">{opportunityCount}</div>
                          <div className="text-xs text-gray-700">de {niche.total}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {/* Top locations */}
          <Section title="Mejores ubicaciones" subtitle="Por densidad de oportunidades">
            {data.topLocations.length === 0 ? (
              <p className="text-xs text-gray-600">Sin datos de ubicaciones todavía.</p>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                {data.topLocations.map((loc, i) => (
                  <div
                    key={loc.search_location}
                    className={`px-4 py-3 flex items-center justify-between ${
                      i < data.topLocations.length - 1 ? "border-b border-gray-800" : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">{loc.search_location}</div>
                      <div className="text-xs text-gray-600 mt-0.5">
                        {loc.no_website} sin web · {loc.high_priority} 🔥
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 ml-3">{loc.total} leads</div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
    </main>
  );
}
