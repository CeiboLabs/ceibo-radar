"use client";

import type { Platform, LeadStatus, WebsiteFilter, PriorityFilter } from "@/lib/types";
import type { DifficultyLevel } from "@/lib/sales/difficultyEngine";
import { SEGMENT_LABELS, type SegmentTag } from "@/lib/sales/segmentationEngine";

interface LeadFiltersProps {
  websiteFilter: WebsiteFilter;
  priority: PriorityFilter;
  platform: Platform | "all";
  status: LeadStatus | "all";
  categoryFilter: string;
  tagFilter: string;
  favoritesOnly: boolean;
  hotOnly: boolean;
  difficulty: DifficultyLevel | "all";
  segment: SegmentTag | "all";
  locationRegion: string;
  nameSearch: string;
  categories: string[];
  tags: string[];
  regions: string[];
  onWebsiteFilterChange: (v: WebsiteFilter) => void;
  onPriorityChange: (v: PriorityFilter) => void;
  onPlatformChange: (v: Platform | "all") => void;
  onStatusChange: (v: LeadStatus | "all") => void;
  onCategoryChange: (v: string) => void;
  onTagChange: (v: string) => void;
  onFavoritesChange: (v: boolean) => void;
  onHotChange: (v: boolean) => void;
  onDifficultyChange: (v: DifficultyLevel | "all") => void;
  onSegmentChange: (v: SegmentTag | "all") => void;
  onRegionChange: (v: string) => void;
  onNameSearchChange: (v: string) => void;
  onClearFilters: () => void;
  onExport: () => void;
  totalCount: number;
}

const selectClass =
  "bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-ceibo-500";

export function LeadFilters({
  websiteFilter,
  priority,
  platform,
  status,
  categoryFilter,
  tagFilter,
  favoritesOnly,
  hotOnly,
  difficulty,
  segment,
  locationRegion,
  nameSearch,
  categories,
  tags,
  regions,
  onWebsiteFilterChange,
  onPriorityChange,
  onPlatformChange,
  onStatusChange,
  onCategoryChange,
  onTagChange,
  onFavoritesChange,
  onHotChange,
  onDifficultyChange,
  onSegmentChange,
  onRegionChange,
  onNameSearchChange,
  onClearFilters,
  onExport,
  totalCount,
}: LeadFiltersProps) {
  const hasActiveFilters =
    websiteFilter !== "all" ||
    priority !== "all" ||
    platform !== "all" ||
    status !== "all" ||
    categoryFilter !== "all" ||
    tagFilter !== "all" ||
    difficulty !== "all" ||
    segment !== "all" ||
    locationRegion !== "all" ||
    favoritesOnly ||
    hotOnly ||
    nameSearch !== "";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-wrap items-center gap-3">
      {/* Text search */}
      <div className="relative">
        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={nameSearch}
          onChange={(e) => onNameSearchChange(e.target.value)}
          placeholder="Buscar por nombre..."
          className="bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-1.5 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-ceibo-500 w-48"
        />
      </div>

      {/* Priority */}
      <select value={priority} onChange={(e) => onPriorityChange(e.target.value as PriorityFilter)} className={selectClass}>
        <option value="all">Todas las prioridades</option>
        <option value="high">🔴 Alta prioridad</option>
        <option value="medium">🟡 Media prioridad</option>
        <option value="low">⚪ Baja prioridad</option>
      </select>

      {/* Website quality */}
      <select value={websiteFilter} onChange={(e) => onWebsiteFilterChange(e.target.value as WebsiteFilter)} className={selectClass}>
        <option value="all">Todos los websites</option>
        <option value="no_website">Sin website</option>
        <option value="poor">Website deficiente</option>
        <option value="needs_improvement">Website mejorable</option>
        <option value="good">Website bueno</option>
      </select>

      {/* Platform */}
      <select value={platform} onChange={(e) => onPlatformChange(e.target.value as Platform | "all")} className={selectClass}>
        <option value="all">Todas las plataformas</option>
        <option value="google_maps">Google Maps</option>
        <option value="instagram">Instagram</option>
      </select>

      {/* Status */}
      <select value={status} onChange={(e) => onStatusChange(e.target.value as LeadStatus | "all")} className={selectClass}>
        <option value="all">Todos los estados</option>
        <option value="not_contacted">Sin contactar</option>
        <option value="contacted">Contactado</option>
        <option value="interested">Interesado</option>
        <option value="proposal_sent">Propuesta enviada</option>
        <option value="closed_won">Cerrado</option>
      </select>

      {/* Department / Region filter — normalized, always shown */}
      <select value={locationRegion} onChange={(e) => onRegionChange(e.target.value)} className={selectClass}>
        <option value="all">Todos los departamentos</option>
        {regions.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>

      {/* Category filter */}
      {categories.length > 0 && (
        <select value={categoryFilter} onChange={(e) => onCategoryChange(e.target.value)} className={selectClass}>
          <option value="all">Todos los rubros</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      )}

      {/* Tag filter */}
      {tags.length > 0 && (
        <select value={tagFilter} onChange={(e) => onTagChange(e.target.value)} className={selectClass}>
          <option value="all">Todos los tags</option>
          {tags.map((tag) => (
            <option key={tag} value={tag}>{tag}</option>
          ))}
        </select>
      )}

      {/* Difficulty filter */}
      <select value={difficulty} onChange={(e) => onDifficultyChange(e.target.value as DifficultyLevel | "all")} className={selectClass}>
        <option value="all">Toda dificultad</option>
        <option value="easy">🟢 Fácil</option>
        <option value="medium">🟡 Medio</option>
        <option value="hard">🔴 Difícil</option>
      </select>

      {/* Segment filter */}
      <select value={segment} onChange={(e) => onSegmentChange(e.target.value as SegmentTag | "all")} className={selectClass}>
        <option value="all">Todos los segmentos</option>
        {(Object.keys(SEGMENT_LABELS) as SegmentTag[]).map((s) => (
          <option key={s} value={s}>{SEGMENT_LABELS[s]}</option>
        ))}
      </select>

      {/* Hot leads toggle */}
      <button
        onClick={() => onHotChange(!hotOnly)}
        className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
          hotOnly
            ? "bg-red-950/60 border-red-800 text-red-400"
            : "bg-gray-800 border-gray-700 text-gray-500 hover:text-red-400 hover:border-red-800"
        }`}
      >
        🔥 Hot
      </button>

      {/* Favorites toggle */}
      <button
        onClick={() => onFavoritesChange(!favoritesOnly)}
        className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
          favoritesOnly
            ? "bg-yellow-950/60 border-yellow-800 text-yellow-400"
            : "bg-gray-800 border-gray-700 text-gray-500 hover:text-yellow-400 hover:border-yellow-800"
        }`}
      >
        {favoritesOnly ? "⭐" : "☆"} Favoritos
      </button>

      <span className="ml-auto text-sm text-gray-500">{totalCount} leads</span>

      {/* Clear filters */}
      {hasActiveFilters && (
        <button
          onClick={onClearFilters}
          className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1.5 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700 transition-colors"
        >
          Limpiar ✕
        </button>
      )}

      <button
        onClick={onExport}
        className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-sm px-4 py-1.5 rounded-lg transition-colors flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Exportar CSV
      </button>
    </div>
  );
}
