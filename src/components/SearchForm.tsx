"use client";

import { useState } from "react";
import type { Platform, SearchConfig, SearchDepth } from "@/lib/types";

const DEPTH_CONFIG: Record<SearchDepth, { label: string; hint: string; maxScrolls: number }> = {
  quick:    { label: "Rápido",    hint: "≈15 resultados/ubicación",  maxScrolls: 5  },
  standard: { label: "Estándar",  hint: "≈30 resultados/ubicación",  maxScrolls: 12 },
  deep:     { label: "Profundo",  hint: "≈50 resultados/ubicación",  maxScrolls: 22 },
};

interface SearchFormProps {
  onSearch: (config: SearchConfig) => void;
  loading: boolean;
  progressMsg?: string;
}

export function SearchForm({ onSearch, loading, progressMsg }: SearchFormProps) {
  const [keyword, setKeyword] = useState("");
  const [locationsText, setLocationsText] = useState("Montevideo, Uruguay");
  const [platforms, setPlatforms] = useState<Platform[]>(["google_maps", "instagram"]);
  const [depth, setDepth] = useState<SearchDepth>("standard");

  const togglePlatform = (p: Platform) => {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim() || !locationsText.trim() || !platforms.length) return;

    const locations = locationsText
      .split(/[,\n]/)
      .map((l) => l.trim())
      .filter(Boolean);

    onSearch({
      keyword: keyword.trim(),
      locations,
      platforms,
      maxScrolls: DEPTH_CONFIG[depth].maxScrolls,
    });
  };

  const locationCount = locationsText
    .split(/[,\n]/)
    .map((l) => l.trim())
    .filter(Boolean).length;

  return (
    <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Keyword */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Keyword / Categoría
          </label>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="ej: peluquería, gym, restaurante, dentista"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-ceibo-500 transition-colors"
            required
          />
        </div>

        {/* Locations */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Ubicaciones
            {locationCount > 1 && (
              <span className="ml-2 text-xs text-ceibo-400 font-normal">
                {locationCount} ubicaciones
              </span>
            )}
          </label>
          <input
            type="text"
            value={locationsText}
            onChange={(e) => setLocationsText(e.target.value)}
            placeholder="ej: Montevideo, Punta del Este, Canelones"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-ceibo-500 transition-colors"
            required
          />
          <p className="text-xs text-gray-600 mt-1">Separar múltiples ubicaciones con comas</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        {/* Platforms */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">Plataformas</label>
          <div className="flex gap-2">
            {(["google_maps", "instagram"] as Platform[]).map((p) => (
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
            {(Object.keys(DEPTH_CONFIG) as SearchDepth[]).map((d) => {
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
      </div>

      <button
        type="submit"
        disabled={loading || !platforms.length}
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
          `Buscar leads${locationCount > 1 ? ` en ${locationCount} ubicaciones` : ""}`
        )}
      </button>
    </form>
  );
}
