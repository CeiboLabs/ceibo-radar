"use client";

import { useEffect, useState } from "react";
import type { AiNiche } from "@/lib/ai/types";

interface Metrics {
  total: number;
  thisWeek: number;
  thisMonth: number;
  hotLeads: number;
  favorites: number;
  contacted: number;
  avgScore: number | null;
  dailySeries: { date: string; count: number }[];
  noWebsite: number;
  poorWebsite: number;
  weakWebsite: number;
  goodWebsite: number;
  opportunities: number;
  byStatus: { status: string; count: number }[];
  byPriority: { lead_priority: string; count: number }[];
  byPlatform: { platform: string; count: number }[];
  byValue: { estimated_value: string; count: number }[];
  byLocation: { search_location: string; count: number }[];
  byCategory: { category: string; count: number }[];
  topLeads: {
    id: number; name: string; lead_score: number;
    lead_priority: string; has_website: number; status: string;
  }[];
  campaignCount: number;
}

const STATUS_ORDER = ["not_contacted", "contacted", "interested", "proposal_sent", "closed_won"] as const;
const statusLabel: Record<string, string> = {
  not_contacted: "Sin contactar",
  contacted: "Contactado",
  interested: "Interesado",
  proposal_sent: "Propuesta enviada",
  closed_won: "Cerrado",
};
const statusBarColor: Record<string, string> = {
  not_contacted: "bg-gray-600",
  contacted: "bg-blue-500",
  interested: "bg-yellow-500",
  proposal_sent: "bg-orange-500",
  closed_won: "bg-ceibo-500",
};
const priorityColor: Record<string, string> = {
  high: "text-red-400", medium: "text-yellow-400", low: "text-gray-500",
};
const valueLabel: Record<string, string> = {
  high: "Alto", medium: "Medio", low: "Bajo", null: "Sin estimar",
};
const valueColor: Record<string, string> = {
  high: "bg-ceibo-500", medium: "bg-blue-500", low: "bg-gray-500", null: "bg-gray-700",
};

function Stat({ label, value, sub, color = "text-ceibo-400" }: {
  label: string; value: number | string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className={`text-3xl font-bold font-mono ${color}`}>{value}</div>
      <div className="text-sm font-medium text-gray-300 mt-1">{label}</div>
      {sub && <div className="text-xs text-gray-600 mt-0.5">{sub}</div>}
    </div>
  );
}

function Sparkline({ series }: { series: { date: string; count: number }[] }) {
  if (!series.length) return null;
  const max = Math.max(...series.map(s => s.count), 1);
  const W = 400; const H = 60;
  const pts = series.map((s, i) => `${(i / (series.length - 1)) * W},${H - (s.count / max) * (H - 4)}`);
  const poly = pts.join(" ");
  const area = `0,${H} ${poly} ${W},${H}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-14" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4ade80" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#4ade80" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#sg)" />
      <polyline points={poly} fill="none" stroke="#4ade80" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

interface HeatmapRow {
  location?: string;
  region?: string;
  category?: string;
  total: number;
  no_website: number;
  poor_website: number;
  hot_leads: number;
  avg_score: number | null;
}

interface NichesState {
  niches: AiNiche[];
  analyzed_at: string;
  cached?: boolean;
}

const opportunityColor: Record<AiNiche["opportunity_level"], string> = {
  high: "text-red-400 bg-red-950/40 border-red-900",
  medium: "text-yellow-400 bg-yellow-950/40 border-yellow-900",
  low: "text-gray-400 bg-gray-800 border-gray-700",
};

const opportunityLabel: Record<AiNiche["opportunity_level"], string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [niches, setNiches] = useState<NichesState | null>(null);
  const [nichesLoading, setNichesLoading] = useState(false);
  const [nichesError, setNichesError] = useState<string | null>(null);
  const [heatmap, setHeatmap] = useState<{ by_location: HeatmapRow[]; by_category: HeatmapRow[] } | null>(null);

  const fetchNiches = async (force = false) => {
    setNichesLoading(true);
    setNichesError(null);
    try {
      const res = await fetch("/api/ai/niches", { method: force ? "POST" : "GET" });
      const data = await res.json();
      if (!res.ok) {
        setNichesError(data.error ?? "Error al analizar nichos");
        return;
      }
      setNiches(data);
    } catch {
      setNichesError("Error de conexión con AI");
    } finally {
      setNichesLoading(false);
    }
  };

  useEffect(() => {
    fetch("/api/metrics")
      .then((r) => r.json())
      .then((data) => { setMetrics(data); setLoading(false); });
    fetch("/api/heatmap")
      .then((r) => r.json())
      .then((data) => setHeatmap(data))
      .catch(() => {});
  }, []);

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-7 w-32 bg-gray-800 rounded animate-pulse" />
          <div className="h-9 w-36 bg-gray-800 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({length: 4}).map((_,i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-2">
              <div className="h-8 w-16 bg-gray-800 rounded animate-pulse" />
              <div className="h-4 w-24 bg-gray-800/60 rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 h-32 animate-pulse" />
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 h-32 animate-pulse" />
        </div>
      </main>
    );
  }

  if (!metrics) return null;

  const contactRate = metrics.total > 0 ? Math.round((metrics.contacted / metrics.total) * 100) : 0;
  const closedWon = metrics.byStatus.find(s => s.status === "closed_won")?.count ?? 0;
  const conversionRate = metrics.total > 0 ? Math.round((closedWon / metrics.total) * 100) : 0;

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-100">Dashboard</h2>
        <a href="/buscar" className="bg-ceibo-600 hover:bg-ceibo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          + Nueva búsqueda
        </a>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Leads totales" value={metrics.total} />
        <Stat label="Esta semana" value={`+${metrics.thisWeek}`} sub={`+${metrics.thisMonth} este mes`} color="text-blue-400" />
        <Stat label="HOT leads" value={metrics.hotLeads} color="text-red-400" sub="alta prioridad" />
        <Stat label="Score promedio" value={metrics.avgScore ?? "—"} sub="sobre 100" color="text-yellow-400" />
      </div>

      {/* KPIs secundarios */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Contactados" value={`${contactRate}%`} sub={`${metrics.contacted} de ${metrics.total}`} color="text-blue-400" />
        <Stat label="Cerrados" value={`${conversionRate}%`} sub={`${closedWon} deals`} color="text-ceibo-400" />
        <Stat label="Oportunidades" value={metrics.opportunities} color="text-orange-400" sub="sin web o web deficiente" />
        <Stat label="Campañas activas" value={metrics.campaignCount} color="text-purple-400" />
      </div>

      {/* Sparkline + plataformas */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-sm font-semibold text-gray-300 mb-0.5">Leads últimos 30 días</div>
          <div className="text-xs text-gray-600 mb-3">
            {metrics.dailySeries.filter(s => s.count > 0).length} días con actividad
          </div>
          <Sparkline series={metrics.dailySeries} />
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Por plataforma</h3>
          <div className="space-y-3">
            {metrics.byPlatform.map(({ platform, count }) => {
              const pct = metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0;
              return (
                <div key={platform} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">{platform === "google_maps" ? "Google Maps" : "Instagram"}</span>
                    <span className="text-gray-500">{count} <span className="text-gray-700">({pct}%)</span></span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${platform === "google_maps" ? "bg-blue-500" : "bg-pink-500"}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Funnel completo */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Embudo de ventas</h3>
        <div className="space-y-3">
          {STATUS_ORDER.map(s => {
            const count = metrics.byStatus.find(b => b.status === s)?.count ?? 0;
            const pct = metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0;
            return (
              <div key={s} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-300">{statusLabel[s]}</span>
                  <span className="text-gray-500">{count} <span className="text-gray-700">({pct}%)</span></span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${statusBarColor[s]}`}
                    style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Priority */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Por prioridad</h3>
          <div className="space-y-2">
            {metrics.byPriority.map(({ lead_priority, count }) => (
              <div key={lead_priority} className="flex items-center justify-between text-sm">
                <span className={`font-medium ${priorityColor[lead_priority] ?? "text-gray-400"}`}>
                  {lead_priority === "high" ? "Alta" : lead_priority === "medium" ? "Media" : "Baja"}
                </span>
                <span className="text-gray-400 font-mono">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Website quality */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Presencia web</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-red-400">Sin website</span><span className="text-gray-400 font-mono">{metrics.noWebsite}</span></div>
            <div className="flex justify-between"><span className="text-orange-400">Website malo</span><span className="text-gray-400 font-mono">{metrics.poorWebsite}</span></div>
            <div className="flex justify-between"><span className="text-yellow-400">Website mejorable</span><span className="text-gray-400 font-mono">{metrics.weakWebsite}</span></div>
            <div className="flex justify-between"><span className="text-ceibo-400">Website bueno</span><span className="text-gray-400 font-mono">{metrics.goodWebsite}</span></div>
          </div>
        </div>

        {/* Estimated value */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Valor estimado</h3>
          <div className="space-y-3">
            {(["high", "medium", "low", "null"] as const).map(v => {
              const count = metrics.byValue.find(b => b.estimated_value === v)?.count ?? 0;
              const pct = metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0;
              return (
                <div key={v} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">{valueLabel[v]}</span>
                    <span className="text-gray-500">{count}</span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${valueColor[v]}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Heatmap de Oportunidades ────────────────────────────────────────── */}
      {heatmap && (heatmap.by_location.length > 0 || heatmap.by_category.length > 0) && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">🗺 Mapa de Oportunidades</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* By location */}
            {heatmap.by_location.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Por ubicación</h4>
                <div className="space-y-2.5">
                  {heatmap.by_location.map((row) => {
                    const opportunity = row.no_website + row.poor_website;
                    const pct = row.total > 0 ? Math.round((opportunity / row.total) * 100) : 0;
                    return (
                      <div key={row.location}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-300 truncate flex-1">{row.location}</span>
                          <span className="text-gray-500 ml-2 shrink-0">{opportunity}/{row.total} · <span className="text-orange-400">{pct}%</span></span>
                          {row.hot_leads > 0 && (
                            <span className="ml-2 text-red-400 shrink-0">🔥{row.hot_leads}</span>
                          )}
                        </div>
                        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${pct >= 70 ? "bg-red-500" : pct >= 40 ? "bg-orange-500" : "bg-yellow-600"}`}
                            style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* By category */}
            {heatmap.by_category.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Por categoría</h4>
                <div className="space-y-2.5">
                  {heatmap.by_category.map((row) => {
                    const opportunity = row.no_website + row.poor_website;
                    const pct = row.total > 0 ? Math.round((opportunity / row.total) * 100) : 0;
                    return (
                      <div key={row.category}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-300 truncate flex-1">{row.category}</span>
                          <span className="text-gray-500 ml-2 shrink-0">{opportunity}/{row.total} · <span className="text-orange-400">{pct}%</span></span>
                          {row.hot_leads > 0 && (
                            <span className="ml-2 text-red-400 shrink-0">🔥{row.hot_leads}</span>
                          )}
                        </div>
                        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${pct >= 70 ? "bg-red-500" : pct >= 40 ? "bg-orange-500" : "bg-yellow-600"}`}
                            style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* ── end Heatmap ──────────────────────────────────────────────────────── */}

      {/* ── Winning Niches (AI) ─────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h3 className="text-sm font-semibold text-ceibo-400 uppercase tracking-wide">✦ Nichos Ganadores</h3>
            <p className="text-xs text-gray-600 mt-0.5">Análisis AI de las mejores categorías para prospectar</p>
          </div>
          <div className="flex items-center gap-2">
            {niches?.cached && (
              <span className="text-xs text-gray-600">En caché</span>
            )}
            {niches && (
              <button
                onClick={() => fetchNiches(true)}
                disabled={nichesLoading}
                className="text-xs px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40 border border-gray-700 text-gray-400 transition-colors"
              >
                {nichesLoading ? "..." : "Actualizar"}
              </button>
            )}
            {!niches && (
              <button
                onClick={() => fetchNiches(false)}
                disabled={nichesLoading}
                className="text-xs px-3 py-1.5 rounded-lg bg-ceibo-900 hover:bg-ceibo-800 disabled:bg-gray-800 disabled:text-gray-500 text-ceibo-300 border border-ceibo-700 transition-colors font-medium"
              >
                {nichesLoading ? "Analizando..." : "Detectar nichos"}
              </button>
            )}
          </div>
        </div>

        {nichesError && (
          <div className="px-6 py-4">
            <p className="text-sm text-red-400">{nichesError}</p>
          </div>
        )}

        {nichesLoading && !niches && (
          <div className="px-6 py-6 text-center">
            <p className="text-sm text-gray-500">Analizando categorías con AI...</p>
          </div>
        )}

        {niches && niches.niches.length > 0 && (
          <div className="divide-y divide-gray-800">
            {niches.niches.map((niche) => (
              <div key={niche.category} className="px-6 py-4 flex items-start gap-4">
                <span className="text-2xl font-bold font-mono text-gray-700 w-6 shrink-0">{niche.rank}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-white">{niche.category}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${opportunityColor[niche.opportunity_level]}`}>
                      {opportunityLabel[niche.opportunity_level]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">{niche.explanation}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {!niches && !nichesLoading && !nichesError && (
          <div className="px-6 py-6 text-center">
            <p className="text-sm text-gray-600">Presiona &quot;Detectar nichos&quot; para analizar qué categorías son las más atractivas para prospectar.</p>
          </div>
        )}
      </div>
      {/* ── end Winning Niches ──────────────────────────────────────────────── */}
    </main>
  );
}
