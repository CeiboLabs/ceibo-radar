"use client";

import { useEffect, useState } from "react";
import type { AiNiche } from "@/lib/ai/types";

interface Metrics {
  total: number;
  noWebsite: number;
  poorWebsite: number;
  weakWebsite: number;
  goodWebsite: number;
  opportunities: number;
  byStatus: { status: string; count: number }[];
  byPriority: { lead_priority: string; count: number }[];
  byPlatform: { platform: string; count: number }[];
  byLocation: { search_location: string; count: number }[];
  byCategory: { category: string; count: number }[];
  topLeads: {
    id: number; name: string; lead_score: number;
    lead_priority: string; has_website: number; status: string;
  }[];
  campaignCount: number;
}

const statusLabel: Record<string, string> = {
  not_contacted: "Sin contactar",
  contacted: "Contactados",
  interested: "Interesados",
};
const priorityColor: Record<string, string> = {
  high: "text-red-400", medium: "text-yellow-400", low: "text-gray-500",
};

function Stat({ label, value, sub, color = "text-ceibo-400" }: {
  label: string; value: number; sub?: string; color?: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className={`text-3xl font-bold font-mono ${color}`}>{value}</div>
      <div className="text-sm font-medium text-gray-300 mt-1">{label}</div>
      {sub && <div className="text-xs text-gray-600 mt-0.5">{sub}</div>}
    </div>
  );
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
  }, []);

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="text-gray-500 text-sm">Cargando métricas...</div>
      </main>
    );
  }

  if (!metrics) return null;

  const contacted = metrics.byStatus.find((s) => s.status === "contacted")?.count ?? 0;
  const interested = metrics.byStatus.find((s) => s.status === "interested")?.count ?? 0;
  const notContacted = metrics.byStatus.find((s) => s.status === "not_contacted")?.count ?? 0;

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      <h2 className="text-xl font-bold text-gray-100">Dashboard</h2>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Leads totales" value={metrics.total} />
        <Stat label="Sin website" value={metrics.noWebsite} color="text-red-400"
          sub={`${metrics.total > 0 ? Math.round((metrics.noWebsite / metrics.total) * 100) : 0}% del total`} />
        <Stat label="Oportunidades" value={metrics.opportunities} color="text-orange-400"
          sub="sin web + website deficiente" />
        <Stat label="Campañas activas" value={metrics.campaignCount} color="text-purple-400" />
      </div>

      {/* Funnel */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Embudo de ventas</h3>
        <div className="space-y-3">
          {[
            { label: "Sin contactar", count: notContacted, color: "bg-gray-700", total: metrics.total },
            { label: "Contactados",   count: contacted,    color: "bg-blue-600",  total: metrics.total },
            { label: "Interesados",   count: interested,   color: "bg-ceibo-600", total: metrics.total },
          ].map(({ label, count, color, total }) => (
            <div key={label} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-300">{label}</span>
                <span className="text-gray-400 font-mono">{count}</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${color}`}
                  style={{ width: total > 0 ? `${(count / total) * 100}%` : "0%" }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Priority breakdown */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Por prioridad</h3>
          <div className="space-y-2">
            {metrics.byPriority.map(({ lead_priority, count }) => (
              <div key={lead_priority} className="flex items-center justify-between text-sm">
                <span className={`font-medium capitalize ${priorityColor[lead_priority] ?? "text-gray-400"}`}>
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

        {/* Platform */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Por plataforma</h3>
          <div className="space-y-2">
            {metrics.byPlatform.map(({ platform, count }) => (
              <div key={platform} className="flex items-center justify-between text-sm">
                <span className="text-gray-300">{platform === "google_maps" ? "Google Maps" : "Instagram"}</span>
                <span className="text-gray-400 font-mono">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* By location */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Por ubicación (top 10)</h3>
          <div className="space-y-2">
            {metrics.byLocation.map(({ search_location, count }) => (
              <div key={search_location} className="flex items-center justify-between text-sm">
                <span className="text-gray-300 truncate flex-1">{search_location}</span>
                <span className="text-gray-400 font-mono ml-4">{count}</span>
              </div>
            ))}
            {metrics.byLocation.length === 0 && <p className="text-xs text-gray-600">Sin datos</p>}
          </div>
        </div>

        {/* By category */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Por categoría (top 10)</h3>
          <div className="space-y-2">
            {metrics.byCategory.map(({ category, count }) => (
              <div key={category} className="flex items-center justify-between text-sm">
                <span className="text-gray-300 truncate flex-1">{category}</span>
                <span className="text-gray-400 font-mono ml-4">{count}</span>
              </div>
            ))}
            {metrics.byCategory.length === 0 && <p className="text-xs text-gray-600">Sin datos</p>}
          </div>
        </div>
      </div>

      {/* Top leads */}
      {metrics.topLeads.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Top leads por score</h3>
          <div className="space-y-2">
            {metrics.topLeads.map((lead, i) => (
              <div key={lead.id} className="flex items-center gap-3 text-sm">
                <span className="text-gray-700 font-mono text-xs w-4">{i + 1}</span>
                <span className="text-white font-medium flex-1">{lead.name}</span>
                <span className={`text-xs ${priorityColor[lead.lead_priority] ?? ""}`}>{lead.lead_score}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  lead.has_website ? "text-gray-500" : "bg-red-950 text-red-400"
                }`}>{lead.has_website ? "Con web" : "Sin web"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
