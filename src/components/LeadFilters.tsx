"use client";

import { useState } from "react";
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
  availablePlatforms: Platform[];
  availableStatuses: (LeadStatus | string)[];
  availablePriorities: string[];
  availableWebsiteQualities: string[];
  availableDifficulties: (DifficultyLevel | string)[];
  availableSegments: (SegmentTag | string)[];
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
  availablePlatforms,
  availableStatuses,
  availablePriorities,
  availableWebsiteQualities,
  availableDifficulties,
  availableSegments,
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
  onExport: _onExport,
  totalCount,
}: LeadFiltersProps) {
  const [expanded, setExpanded] = useState(false);

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

  const secondaryActive = [
    platform !== "all",
    locationRegion !== "all",
    categoryFilter !== "all",
    tagFilter !== "all",
    difficulty !== "all",
    segment !== "all",
  ].filter(Boolean).length;

  const totalActive = [
    websiteFilter !== "all",
    priority !== "all",
    platform !== "all",
    status !== "all",
    categoryFilter !== "all",
    tagFilter !== "all",
    difficulty !== "all",
    segment !== "all",
    locationRegion !== "all",
    favoritesOnly,
    hotOnly,
    nameSearch !== "",
  ].filter(Boolean).length;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
      {/* Row 1 — always visible */}
      <div className="flex flex-wrap items-center gap-2">
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
        {availablePriorities.length > 0 && (
          <select value={priority} onChange={(e) => onPriorityChange(e.target.value as PriorityFilter)} className={selectClass}>
            <option value="all">Todas las prioridades</option>
            {availablePriorities.includes("high")   && <option value="high">🔴 Alta prioridad</option>}
            {availablePriorities.includes("medium")  && <option value="medium">🟡 Media prioridad</option>}
            {availablePriorities.includes("low")     && <option value="low">⚪ Baja prioridad</option>}
          </select>
        )}

        {/* Website quality */}
        {availableWebsiteQualities.length > 0 && (
          <select value={websiteFilter} onChange={(e) => onWebsiteFilterChange(e.target.value as WebsiteFilter)} className={selectClass}>
            <option value="all">Todos los websites</option>
            {availableWebsiteQualities.includes("no_website")        && <option value="no_website">Sin website</option>}
            {availableWebsiteQualities.includes("poor")              && <option value="poor">Website deficiente</option>}
            {availableWebsiteQualities.includes("needs_improvement") && <option value="needs_improvement">Website mejorable</option>}
            {availableWebsiteQualities.includes("good")              && <option value="good">Website bueno</option>}
          </select>
        )}

        {/* Status */}
        {availableStatuses.length > 0 && (
          <select value={status} onChange={(e) => onStatusChange(e.target.value as LeadStatus | "all")} className={selectClass}>
            <option value="all">Todos los estados</option>
            {availableStatuses.includes("not_contacted")  && <option value="not_contacted">Sin contactar</option>}
            {availableStatuses.includes("contacted")      && <option value="contacted">Contactado</option>}
            {availableStatuses.includes("interested")     && <option value="interested">Interesado</option>}
            {availableStatuses.includes("proposal_sent")  && <option value="proposal_sent">Propuesta enviada</option>}
            {availableStatuses.includes("closed_won")     && <option value="closed_won">Cerrado ✓</option>}
            {availableStatuses.includes("closed_lost")    && <option value="closed_lost">Perdido</option>}
          </select>
        )}

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

        {/* Más filtros button */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
            expanded || secondaryActive > 0
              ? "bg-ceibo-950/40 border-ceibo-800 text-ceibo-400"
              : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300"
          }`}
        >
          Más filtros{secondaryActive > 0 ? ` (${secondaryActive})` : ""}
          <svg className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Spacer */}
        <span className="ml-auto text-xs text-gray-600 tabular-nums">{totalCount} leads</span>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-400 px-2.5 py-1.5 rounded-lg border border-gray-700 hover:border-red-900 bg-gray-800 hover:bg-red-950/20 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Limpiar{totalActive > 0 ? ` (${totalActive})` : ""}
          </button>
        )}
      </div>

      {/* Row 2 — secondary filters, only when expanded */}
      {expanded && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-800/70">
          {/* Platform */}
          {availablePlatforms.length > 0 && (
            <select value={platform} onChange={(e) => onPlatformChange(e.target.value as Platform | "all")} className={selectClass}>
              <option value="all">Todas las plataformas</option>
              {availablePlatforms.includes("google_maps") && <option value="google_maps">Google Maps</option>}
              {availablePlatforms.includes("instagram")   && <option value="instagram">Instagram</option>}
            </select>
          )}

          {/* Department / Region filter */}
          {regions.length > 0 && (
            <select value={locationRegion} onChange={(e) => onRegionChange(e.target.value)} className={selectClass}>
              <option value="all">Todos los departamentos</option>
              {regions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          )}

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
          {availableDifficulties.length > 0 && (
            <select value={difficulty} onChange={(e) => onDifficultyChange(e.target.value as DifficultyLevel | "all")} className={selectClass}>
              <option value="all">Toda dificultad</option>
              {availableDifficulties.includes("easy")   && <option value="easy">🟢 Fácil</option>}
              {availableDifficulties.includes("medium")  && <option value="medium">🟡 Medio</option>}
              {availableDifficulties.includes("hard")    && <option value="hard">🔴 Difícil</option>}
            </select>
          )}

          {/* Segment filter */}
          {availableSegments.length > 0 && (
            <select value={segment} onChange={(e) => onSegmentChange(e.target.value as SegmentTag | "all")} className={selectClass}>
              <option value="all">Todos los segmentos</option>
              {(Object.keys(SEGMENT_LABELS) as SegmentTag[]).filter(s => availableSegments.includes(s)).map((s) => (
                <option key={s} value={s}>{SEGMENT_LABELS[s]}</option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  );
}
