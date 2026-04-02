"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { URUGUAY_DEPARTMENTS } from "@/components/SearchForm";
import type { Platform } from "@/lib/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const KEYWORD_SUGGESTIONS = [
  "peluquería", "gym", "restaurante", "dentista", "barbería",
  "pilates", "veterinaria", "contador", "psicólogo", "arquitecto",
];

type DepthKey = "quick" | "standard" | "deep";

const DEPTH_CONFIG: Record<DepthKey, { label: string; hint: string; maxScrolls: number }> = {
  quick:    { label: "Rápida",   hint: "~15 res/lugar",  maxScrolls: 5  },
  standard: { label: "Estándar", hint: "~30 res/lugar",  maxScrolls: 12 },
  deep:     { label: "Profunda", hint: "~50 res/lugar",  maxScrolls: 22 },
};

const LOCATION_PRESETS: { label: string; terms: string[] }[] = [
  {
    label: "Gran Mvd",
    terms: URUGUAY_DEPARTMENTS.filter(d => d.region === "metro").map(d => d.searchTerm),
  },
  {
    label: "Costa",
    terms: URUGUAY_DEPARTMENTS.filter(d => d.region === "costa").map(d => d.searchTerm),
  },
  {
    label: "Todo UY",
    terms: URUGUAY_DEPARTMENTS.map(d => d.searchTerm),
  },
  {
    label: "Solo Mvd",
    terms: ["Montevideo, Uruguay"],
  },
];

const REGION_LABELS: Record<string, string> = {
  metro:    "Área Metropolitana",
  costa:    "Costa Este",
  litoral:  "Litoral Oeste",
  norte:    "Norte",
  interior: "Interior",
};

const BY_REGION = (["metro", "costa", "litoral", "norte", "interior"] as const).map(r => ({
  region: r,
  label: REGION_LABELS[r],
  depts: URUGUAY_DEPARTMENTS.filter(d => d.region === r),
}));

// ─── History types ────────────────────────────────────────────────────────────

interface SearchHistoryItem {
  id: string;
  keyword: string;
  locations: string[];
  platforms: Platform[];
  depth: DepthKey;
  total_found: number;
  searched_at: string;
}

const HISTORY_KEY = "ceibo_search_history";
const MAX_HISTORY = 15;

function loadHistory(): SearchHistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveToHistory(item: SearchHistoryItem) {
  const history = loadHistory();
  const filtered = history.filter(h => h.id !== item.id);
  const updated = [item, ...filtered].slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BuscarPage() {
  // Form state
  const [keyword, setKeyword] = useState("");
  const [selectedLocations, setSelectedLocations] = useState<Set<string>>(
    new Set(["Montevideo, Uruguay"])
  );
  const [platforms, setPlatforms] = useState<Platform[]>(["google_maps", "instagram"]);
  const [depth, setDepth] = useState<DepthKey>("standard");
  const [showAllDepts, setShowAllDepts] = useState(false);

  // Search state
  const [searching, setSearching] = useState(false);
  const [progressLog, setProgressLog] = useState<string[]>([]);
  const [result, setResult] = useState<{ total: number; no_website: number } | null>(null);

  // History
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  useEffect(() => { setHistory(loadHistory()); }, []);

  const logEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [progressLog]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const toggleLocation = (term: string) => {
    setSelectedLocations(prev => {
      const next = new Set(prev);
      if (next.has(term)) {
        if (next.size > 1) next.delete(term);
      } else {
        next.add(term);
      }
      return next;
    });
  };

  const applyPreset = (terms: string[]) => {
    setSelectedLocations(new Set(terms));
  };

  const togglePlatform = (p: Platform) => {
    setPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  };

  const handleSearch = async () => {
    if (!keyword.trim() || selectedLocations.size === 0 || platforms.length === 0) return;
    setSearching(true);
    setProgressLog([]);
    setResult(null);

    const maxScrolls = DEPTH_CONFIG[depth].maxScrolls;

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: keyword.trim(),
          locations: Array.from(selectedLocations),
          platforms,
          maxScrolls,
        }),
      });

      if (!res.ok || !res.body) throw new Error("Search failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalTotal = 0;
      let finalNoWebsite = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.type === "progress") {
              setProgressLog(prev => [...prev, msg.message]);
            } else if (msg.type === "done") {
              finalTotal = msg.total ?? 0;
              finalNoWebsite = msg.no_website ?? 0;
              setResult({ total: finalTotal, no_website: finalNoWebsite });
            }
          } catch {}
        }
      }

      // Save to history
      const item: SearchHistoryItem = {
        id: Date.now().toString(),
        keyword: keyword.trim(),
        locations: Array.from(selectedLocations),
        platforms,
        depth,
        total_found: finalTotal,
        searched_at: new Date().toISOString(),
      };
      saveToHistory(item);
      setHistory(loadHistory());
    } catch (err) {
      setProgressLog(prev => [
        ...prev,
        `Error: ${err instanceof Error ? err.message : "Error desconocido"}`,
      ]);
    } finally {
      setSearching(false);
    }
  };

  const rerunSearch = (item: SearchHistoryItem) => {
    setKeyword(item.keyword);
    setSelectedLocations(new Set(item.locations));
    setPlatforms(item.platforms);
    setDepth(item.depth);
    setResult(null);
    setProgressLog([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Derived ─────────────────────────────────────────────────────────────────

  const activePreset = LOCATION_PRESETS.find(
    p =>
      p.terms.length === selectedLocations.size &&
      p.terms.every(t => selectedLocations.has(t))
  )?.label ?? null;

  const canSearch = keyword.trim().length > 0 && selectedLocations.size > 0 && platforms.length > 0;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Buscar Negocios</h1>
        <p className="text-sm text-gray-500 mt-0.5">Scraper de Google Maps e Instagram para Uruguay</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
        {/* ── Left: Form ───────────────────────────────────────────────────── */}
        <div className="space-y-5">
          {/* Keyword */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Keyword / Categoría
              </label>
              <input
                type="text"
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && canSearch && !searching) handleSearch(); }}
                placeholder="ej: peluquería, gym, restaurante…"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-base placeholder-gray-600 focus:outline-none focus:border-ceibo-500 transition-colors"
              />
              {/* Chips */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {KEYWORD_SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setKeyword(s)}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                      keyword === s
                        ? "bg-ceibo-700 border-ceibo-600 text-white"
                        : "bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">
                Ubicación
                <span className="ml-2 text-ceibo-400 font-normal text-xs">
                  {selectedLocations.size} {selectedLocations.size === 1 ? "lugar" : "lugares"}
                </span>
              </label>
            </div>

            {/* Quick presets */}
            <div className="flex flex-wrap gap-2">
              {LOCATION_PRESETS.map(preset => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset.terms)}
                  className={`text-sm px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                    activePreset === preset.label
                      ? "bg-ceibo-700 border-ceibo-600 text-white"
                      : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300"
                  }`}
                >
                  {preset.label}
                  <span className="ml-1 opacity-50 text-xs">{preset.terms.length}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowAllDepts(v => !v)}
                className="text-sm px-3 py-1.5 rounded-lg border border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300 transition-colors"
              >
                {showAllDepts ? "Ocultar ↑" : "Ver todos ↓"}
              </button>
            </div>

            {/* Full department selector */}
            {showAllDepts && (
              <div className="space-y-3 bg-gray-800/50 border border-gray-800 rounded-xl p-4 mt-1">
                {BY_REGION.map(({ region, label, depts }) => (
                  <div key={region}>
                    <div className="text-xs text-gray-600 font-medium uppercase tracking-wide mb-1.5">
                      {label}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {depts.map(dept => {
                        const active = selectedLocations.has(dept.searchTerm);
                        return (
                          <button
                            key={dept.searchTerm}
                            type="button"
                            onClick={() => toggleLocation(dept.searchTerm)}
                            className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                              active
                                ? "bg-ceibo-800/60 border-ceibo-700 text-ceibo-300 font-medium"
                                : "bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-400"
                            }`}
                          >
                            {active && <span className="mr-1 text-ceibo-400">✓</span>}
                            {dept.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Platforms + Depth */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Platforms */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Plataformas</label>
              <div className="flex gap-2">
                {(["google_maps", "instagram"] as Platform[]).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePlatform(p)}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      platforms.includes(p)
                        ? "bg-ceibo-600 border-ceibo-500 text-white"
                        : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300"
                    }`}
                  >
                    {p === "google_maps" ? "Google Maps" : "Instagram"}
                  </button>
                ))}
              </div>
            </div>

            {/* Depth */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Profundidad</label>
              <div className="flex gap-2 flex-wrap">
                {(Object.keys(DEPTH_CONFIG) as DepthKey[]).map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDepth(d)}
                    className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                      depth === d
                        ? "bg-gray-700 border-gray-500 text-white font-medium"
                        : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300"
                    }`}
                    title={DEPTH_CONFIG[d].hint}
                  >
                    {DEPTH_CONFIG[d].label}
                    <span className="ml-1.5 text-xs opacity-50">{DEPTH_CONFIG[d].hint}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            type="button"
            disabled={!canSearch || searching}
            onClick={handleSearch}
            className="w-full bg-ceibo-600 hover:bg-ceibo-500 disabled:bg-gray-800 disabled:cursor-not-allowed disabled:text-gray-600 text-white font-semibold py-3.5 rounded-xl transition-colors text-base flex items-center justify-center gap-2"
          >
            {searching ? (
              <>
                <svg className="animate-spin w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Buscando…
              </>
            ) : (
              `Buscar en ${selectedLocations.size} ${selectedLocations.size === 1 ? "lugar" : "lugares"} · ${platforms.length} ${platforms.length === 1 ? "plataforma" : "plataformas"}`
            )}
          </button>
        </div>

        {/* ── Right: Progress / History ─────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Progress panel — shown while searching or after result */}
          {(searching || result || progressLog.length > 0) && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-300">
                  {searching ? "Progreso" : "Resultado"}
                </h2>
                {searching && (
                  <svg className="animate-spin w-4 h-4 text-ceibo-400" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
              </div>

              {/* Log */}
              <div className="h-52 overflow-y-auto bg-gray-950 rounded-lg p-3 space-y-0.5 font-mono text-xs">
                {progressLog.length === 0 && (
                  <span className="text-gray-600">Iniciando búsqueda…</span>
                )}
                {progressLog.map((msg, i) => (
                  <div key={i} className="text-gray-400 leading-relaxed">{msg}</div>
                ))}
                <div ref={logEndRef} />
              </div>

              {/* Summary */}
              {result && !searching && (
                <div className="space-y-3">
                  <div className="flex gap-4">
                    <div className="flex-1 bg-gray-800 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-ceibo-400">{result.total}</div>
                      <div className="text-xs text-gray-500 mt-0.5">leads encontrados</div>
                    </div>
                    <div className="flex-1 bg-gray-800 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-red-400">{result.no_website}</div>
                      <div className="text-xs text-gray-500 mt-0.5">sin website</div>
                    </div>
                  </div>
                  <Link
                    href="/"
                    className="flex items-center justify-center gap-2 w-full bg-ceibo-700 hover:bg-ceibo-600 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
                  >
                    Ver leads →
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* History panel — shown when not searching */}
          {!searching && !result && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-gray-300 mb-4">Historial de búsquedas</h2>
              {history.length === 0 ? (
                <p className="text-xs text-gray-600 text-center py-6">
                  No hay búsquedas previas
                </p>
              ) : (
                <div className="space-y-2">
                  {history.map(item => (
                    <div
                      key={item.id}
                      className="bg-gray-800/60 border border-gray-800 rounded-lg p-3 flex items-start justify-between gap-3 hover:border-gray-700 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-200 truncate">{item.keyword}</div>
                        <div className="text-xs text-gray-500 mt-0.5 truncate">
                          {item.locations.length === 1
                            ? item.locations[0].replace(", Uruguay", "")
                            : `${item.locations.length} lugares`}
                          {" · "}
                          {item.platforms.map(p => p === "google_maps" ? "Maps" : "IG").join(" + ")}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-ceibo-400 font-medium">
                            {item.total_found} leads
                          </span>
                          <span className="text-xs text-gray-700">·</span>
                          <span className="text-xs text-gray-600">
                            {new Date(item.searched_at).toLocaleDateString("es-UY", {
                              day: "2-digit", month: "2-digit", year: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => rerunSearch(item)}
                        className="shrink-0 text-xs px-2.5 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                      >
                        Re-ejecutar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Show history alongside result after search */}
          {result && history.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-gray-300 mb-3">Búsquedas recientes</h2>
              <div className="space-y-1.5">
                {history.slice(0, 5).map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => rerunSearch(item)}
                    className="w-full text-left text-xs px-3 py-2 rounded-lg bg-gray-800/60 hover:bg-gray-800 text-gray-400 hover:text-gray-300 transition-colors flex items-center justify-between"
                  >
                    <span className="truncate">{item.keyword}</span>
                    <span className="text-ceibo-500 ml-2 shrink-0">{item.total_found} leads</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
