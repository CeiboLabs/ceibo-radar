"use client";

import { useState } from "react";
import type { Platform, SearchConfig, SearchDepth } from "@/lib/types";

// ─── Uruguay departments with main cities ─────────────────────────────────────
export const URUGUAY_DEPARTMENTS: { name: string; searchTerm: string; region: "metro" | "costa" | "litoral" | "norte" | "interior" }[] = [
  { name: "Montevideo",     searchTerm: "Montevideo, Uruguay",     region: "metro"    },
  { name: "Canelones",      searchTerm: "Canelones, Uruguay",      region: "metro"    },
  { name: "San José",       searchTerm: "San José, Uruguay",       region: "metro"    },
  { name: "Maldonado",      searchTerm: "Maldonado, Uruguay",      region: "costa"    },
  { name: "Punta del Este", searchTerm: "Punta del Este, Uruguay", region: "costa"    },
  { name: "Rocha",          searchTerm: "Rocha, Uruguay",          region: "costa"    },
  { name: "Colonia",        searchTerm: "Colonia, Uruguay",        region: "litoral"  },
  { name: "Soriano",        searchTerm: "Soriano, Uruguay",        region: "litoral"  },
  { name: "Río Negro",      searchTerm: "Río Negro, Uruguay",      region: "litoral"  },
  { name: "Paysandú",       searchTerm: "Paysandú, Uruguay",       region: "litoral"  },
  { name: "Salto",          searchTerm: "Salto, Uruguay",          region: "litoral"  },
  { name: "Artigas",        searchTerm: "Artigas, Uruguay",        region: "norte"    },
  { name: "Rivera",         searchTerm: "Rivera, Uruguay",         region: "norte"    },
  { name: "Tacuarembó",     searchTerm: "Tacuarembó, Uruguay",     region: "norte"    },
  { name: "Cerro Largo",    searchTerm: "Cerro Largo, Uruguay",    region: "norte"    },
  { name: "Treinta y Tres", searchTerm: "Treinta y Tres, Uruguay", region: "interior" },
  { name: "Florida",        searchTerm: "Florida, Uruguay",        region: "interior" },
  { name: "Flores",         searchTerm: "Flores, Uruguay",         region: "interior" },
  { name: "Durazno",        searchTerm: "Durazno, Uruguay",        region: "interior" },
  { name: "Lavalleja",      searchTerm: "Lavalleja, Uruguay",      region: "interior" },
];

const REGION_LABELS: Record<string, string> = {
  metro:    "Área Metropolitana",
  costa:    "Costa Este",
  litoral:  "Litoral Oeste",
  norte:    "Norte",
  interior: "Interior",
};

const PRESETS: { label: string; terms: string[] }[] = [
  {
    label: "Todo Uruguay",
    terms: URUGUAY_DEPARTMENTS.map(d => d.searchTerm),
  },
  {
    label: "Gran Mvd",
    terms: URUGUAY_DEPARTMENTS.filter(d => d.region === "metro").map(d => d.searchTerm),
  },
  {
    label: "Costa",
    terms: URUGUAY_DEPARTMENTS.filter(d => d.region === "costa").map(d => d.searchTerm),
  },
  {
    label: "Litoral",
    terms: URUGUAY_DEPARTMENTS.filter(d => d.region === "litoral").map(d => d.searchTerm),
  },
  {
    label: "Interior",
    terms: URUGUAY_DEPARTMENTS.filter(d => ["norte","interior"].includes(d.region)).map(d => d.searchTerm),
  },
];

const DEPTH_CONFIG: Record<SearchDepth, { label: string; hint: string; maxScrolls: number }> = {
  quick:    { label: "Rápido",   hint: "≈15 res/lugar",  maxScrolls: 5  },
  standard: { label: "Estándar", hint: "≈30 res/lugar",  maxScrolls: 12 },
  deep:     { label: "Profundo", hint: "≈50 res/lugar",  maxScrolls: 22 },
};

interface SearchFormProps {
  onSearch: (config: SearchConfig) => void;
  loading: boolean;
  progressMsg?: string;
}

export function SearchForm({ onSearch, loading, progressMsg }: SearchFormProps) {
  const [keyword, setKeyword] = useState("");
  const [selected, setSelected] = useState<Set<string>>(
    new Set(["Montevideo, Uruguay"])
  );
  const [platforms, setPlatforms] = useState<Platform[]>(["google_maps", "instagram"]);
  const [depth, setDepth] = useState<SearchDepth>("standard");

  const toggleDept = (term: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(term)) {
        if (next.size > 1) next.delete(term); // keep at least one
      } else {
        next.add(term);
      }
      return next;
    });
  };

  const applyPreset = (terms: string[]) => {
    setSelected(new Set(terms));
  };

  const togglePlatform = (p: Platform) => {
    setPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim() || selected.size === 0 || !platforms.length) return;
    onSearch({
      keyword: keyword.trim(),
      locations: Array.from(selected),
      platforms,
      maxScrolls: DEPTH_CONFIG[depth].maxScrolls,
    });
  };

  // Estimate approximate result count for hint
  const estimatedResults = selected.size * platforms.length * DEPTH_CONFIG[depth].maxScrolls * 2;

  // Group departments by region for display
  const byRegion = (["metro","costa","litoral","norte","interior"] as const).map(r => ({
    region: r,
    label: REGION_LABELS[r],
    depts: URUGUAY_DEPARTMENTS.filter(d => d.region === r),
  }));

  return (
    <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
      {/* Keyword */}
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-1">
          Keyword / Categoría
        </label>
        <input
          type="text"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          placeholder="ej: peluquería, gym, restaurante, dentista"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-ceibo-500 transition-colors"
          required
        />
      </div>

      {/* Uruguay location selector */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-400">
            Ubicaciones en Uruguay
            <span className="ml-2 text-ceibo-400 font-normal">
              {selected.size} {selected.size === 1 ? "lugar" : "lugares"} seleccionados
            </span>
          </label>
          <button
            type="button"
            onClick={() => setSelected(new Set(URUGUAY_DEPARTMENTS.map(d => d.searchTerm)))}
            className="text-xs text-ceibo-500 hover:text-ceibo-400 transition-colors"
          >
            Seleccionar todo →
          </button>
        </div>

        {/* Presets */}
        <div className="flex flex-wrap gap-2 mb-3">
          {PRESETS.map(preset => {
            const isActive = preset.terms.every(t => selected.has(t)) && preset.terms.length === selected.size;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset.terms)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                  isActive
                    ? "bg-ceibo-700 border-ceibo-600 text-white"
                    : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300"
                }`}
              >
                {preset.label}
                <span className="ml-1 opacity-50">{preset.terms.length}</span>
              </button>
            );
          })}
        </div>

        {/* Department grid grouped by region */}
        <div className="space-y-2.5 bg-gray-800/50 border border-gray-800 rounded-xl p-4">
          {byRegion.map(({ region, label, depts }) => (
            <div key={region}>
              <div className="text-xs text-gray-600 font-medium uppercase tracking-wide mb-1.5">{label}</div>
              <div className="flex flex-wrap gap-1.5">
                {depts.map(dept => {
                  const active = selected.has(dept.searchTerm);
                  return (
                    <button
                      key={dept.searchTerm}
                      type="button"
                      onClick={() => toggleDept(dept.searchTerm)}
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
      </div>

      <div className="flex flex-wrap gap-6">
        {/* Platforms */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">Plataformas</label>
          <div className="flex gap-2">
            {(["google_maps", "instagram"] as Platform[]).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => togglePlatform(p)}
                className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                  platforms.includes(p)
                    ? "bg-ceibo-600 border-ceibo-500 text-white"
                    : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
                }`}
              >
                {p === "google_maps" ? "Google Maps" : "Instagram"}
              </button>
            ))}
          </div>
        </div>

        {/* Depth */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">Profundidad</label>
          <div className="flex gap-2">
            {(Object.keys(DEPTH_CONFIG) as SearchDepth[]).map(d => {
              const cfg = DEPTH_CONFIG[d];
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDepth(d)}
                  className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                    depth === d
                      ? "bg-gray-700 border-gray-500 text-white"
                      : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
                  }`}
                  title={cfg.hint}
                >
                  {cfg.label}
                  <span className="ml-1.5 text-xs text-gray-500">{cfg.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Estimated scope hint */}
        <div className="flex items-end pb-0.5">
          <span className="text-xs text-gray-600">
            ~{estimatedResults.toLocaleString()} búsquedas estimadas
          </span>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || !platforms.length || selected.size === 0}
        className="w-full bg-ceibo-600 hover:bg-ceibo-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="truncate">{progressMsg || "Buscando..."}</span>
          </>
        ) : (
          `Buscar en ${selected.size} ${selected.size === 1 ? "lugar" : "lugares"}${platforms.length > 1 ? ` · ${platforms.length} plataformas` : ""}`
        )}
      </button>
    </form>
  );
}
