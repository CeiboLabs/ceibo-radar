"use client";

import { useState, useCallback, useEffect, useMemo } from "react";

const HIDDEN_AUTO_TAGS = new Set([
  "sin-website", "website-malo", "website-mejorable",
  "sin-contacto", "tiene-telefono", "tiene-email",
  "alta-prioridad", "baja-prioridad",
  "sin-presencia-digital", "instagram-activo",
]);
import dynamic from "next/dynamic";
import Link from "next/link";
import { LeadsTable } from "@/components/LeadsTable";
import { LeadFilters } from "@/components/LeadFilters";
import type { Lead, LeadStatus, Platform, PriorityFilter, WebsiteFilter } from "@/lib/types";
import type { DifficultyLevel } from "@/lib/sales/difficultyEngine";
import type { SegmentTag } from "@/lib/sales/segmentationEngine";
import { ComparatorModal } from "@/components/ComparatorModal";
import { LeadModal } from "@/components/LeadModal";
import AddLeadModal from "@/components/AddLeadModal";
import { toast } from "@/lib/toast";

const LeadMap = dynamic(() => import("@/components/LeadMap"), { ssr: false });

function LeadsSkeleton() {
  return (
    <div className="rounded-xl border border-gray-800 overflow-hidden divide-y divide-gray-800/60">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5 bg-gray-900">
          <div className="w-3.5 h-3.5 rounded bg-gray-800 shrink-0" />
          <div className="w-14 flex flex-col gap-1.5 shrink-0">
            <div className="h-4 w-8 bg-gray-800 rounded animate-pulse" />
            <div className="h-1 w-10 bg-gray-800 rounded-full animate-pulse" />
          </div>
          <div className="flex-1 space-y-1.5">
            <div className="h-4 w-48 bg-gray-800 rounded animate-pulse" />
            <div className="h-3 w-64 bg-gray-800/60 rounded animate-pulse" />
            <div className="h-3 w-36 bg-gray-800/40 rounded animate-pulse" />
          </div>
          <div className="w-24 h-6 bg-gray-800 rounded-lg animate-pulse shrink-0" />
          <div className="flex gap-1.5 shrink-0">
            <div className="w-8 h-8 bg-gray-800 rounded-lg animate-pulse" />
            <div className="w-16 h-8 bg-gray-800 rounded-lg animate-pulse" />
            <div className="w-8 h-8 bg-gray-800 rounded-lg animate-pulse" />
            <div className="w-8 h-8 bg-gray-800 rounded-lg animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [websiteFilter, setWebsiteFilter] = useState<WebsiteFilter>("all");
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [platform, setPlatform] = useState<Platform | "all">("all");
  const [status, setStatus] = useState<LeadStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [hotOnly, setHotOnly] = useState(false);
  const [difficulty, setDifficulty] = useState<DifficultyLevel | "all">("all");
  const [segment, setSegment] = useState<SegmentTag | "all">("all");
  const [locationRegion, setLocationRegion] = useState("all");
  const [nameSearch, setNameSearch] = useState("");
  const [compareIds, setCompareIds] = useState<Set<number>>(new Set());
  const [comparatorOpen, setComparatorOpen] = useState(false);
  const [comparatorLead, setComparatorLead] = useState<Lead | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "map">("table");
  const [mapLead, setMapLead] = useState<Lead | null>(null);
  const [addLeadOpen, setAddLeadOpen] = useState(false);

  const [bulkStatus, setBulkStatus] = useState<LeadStatus | "">("");
  const [bulkLoading, setBulkLoading] = useState(false);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (websiteFilter !== "all") params.set("website_filter", websiteFilter);
      if (priority !== "all") params.set("priority", priority);
      if (platform !== "all") params.set("platform", platform);
      if (status !== "all") params.set("status", status);
      if (favoritesOnly) params.set("favorites", "1");
      if (hotOnly) params.set("hot", "1");
      if (difficulty !== "all") params.set("difficulty", difficulty);
      if (segment !== "all") params.set("segment", segment);
      if (locationRegion !== "all") params.set("region", locationRegion);
      const res = await fetch(`/api/leads?${params}`);
      const data = await res.json();
      setLeads(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [websiteFilter, priority, platform, status, favoritesOnly, hotOnly, difficulty, segment, locationRegion]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // Client-side filters: category, tags, name search
  const displayedLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (categoryFilter !== "all" && lead.category !== categoryFilter) return false;
      if (tagFilter !== "all") {
        const tags: string[] = (() => { try { return JSON.parse(lead.tags ?? "[]"); } catch { return []; } })();
        if (!tags.includes(tagFilter)) return false;
      }
      if (nameSearch.trim()) {
        const q = nameSearch.trim().toLowerCase();
        if (!lead.name?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [leads, categoryFilter, tagFilter, nameSearch]);

  // Derived filter options from loaded leads
  const distinctCategories = useMemo(
    () => Array.from(new Set(leads.map((l) => l.category).filter(Boolean) as string[])).sort(),
    [leads]
  );
  const distinctRegions = useMemo(
    () => Array.from(new Set(leads.map((l) => l.location_region).filter(Boolean) as string[])).sort(),
    [leads]
  );
  const distinctTags = useMemo(() => {
    const tagSet = new Set<string>();
    leads.forEach((lead) => {
      try {
        const t: string[] = JSON.parse(lead.tags ?? "[]");
        t.filter(tag => !HIDDEN_AUTO_TAGS.has(tag)).forEach((tag) => tagSet.add(tag));
      } catch {}
    });
    return Array.from(tagSet).sort();
  }, [leads]);

  const handleUpdate = async (id: number, data: { status?: LeadStatus; notes?: string; tags?: string[]; sequence_stage?: string; next_followup_at?: string | null; is_favorite?: boolean }) => {
    const res = await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) { toast("Error al actualizar el lead", "error"); return; }
    await fetchLeads();
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/leads/${id}`, { method: "DELETE" });
    if (!res.ok) { toast("Error al eliminar el lead", "error"); return; }
    toast("Lead eliminado");
    await fetchLeads();
  };

  const handleClearFilters = () => {
    setWebsiteFilter("all");
    setPriority("all");
    setPlatform("all");
    setStatus("all");
    setCategoryFilter("all");
    setTagFilter("all");
    setFavoritesOnly(false);
    setHotOnly(false);
    setDifficulty("all");
    setSegment("all");
    setLocationRegion("all");
    setNameSearch("");
  };

  const handleBulkAction = async (action: "status" | "recalculate" | "delete", value?: string) => {
    if (compareIds.size === 0) return;
    if (action === "delete" && !confirm(`¿Eliminar ${compareIds.size} leads? Esta acción no se puede deshacer.`)) return;
    setBulkLoading(true);
    const res = await fetch("/api/leads/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(compareIds), action, value }),
    });
    setBulkLoading(false);
    if (!res.ok) {
      toast("Error en la acción masiva", "error");
    } else {
      const count = compareIds.size;
      if (action === "delete") toast(`${count} lead${count > 1 ? "s" : ""} eliminado${count > 1 ? "s" : ""}`);
      else if (action === "status") toast(`Estado actualizado en ${count} lead${count > 1 ? "s" : ""}`);
      else if (action === "recalculate") toast(`Score recalculado en ${count} lead${count > 1 ? "s" : ""}`);
    }
    setCompareIds(new Set());
    setBulkStatus("");
    await fetchLeads();
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (websiteFilter !== "all") params.set("website_filter", websiteFilter);
    window.open(`/api/export?${params}`, "_blank");
  };

  const exportCSV = () => {
    const headers = ["Nombre", "Teléfono", "Email", "Categoría", "Ubicación", "Website", "Estado", "Score", "Plataforma", "Notas"];
    const rows = displayedLeads.map(l => [
      l.name,
      l.phone ?? "",
      l.email ?? "",
      l.category ?? "",
      l.location ?? "",
      l.website_url ?? "",
      l.status,
      String(l.lead_score ?? ""),
      l.platform,
      l.notes ?? "",
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      {/* Leads */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-200">Leads</h2>
            {/* View mode tabs */}
            <div className="flex bg-gray-800 rounded-lg p-0.5 border border-gray-700">
              <button
                onClick={() => setViewMode("table")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === "table" ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"}`}
              >
                ☰ Tabla
              </button>
              <button
                onClick={() => setViewMode("map")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === "map" ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"}`}
              >
                🗺 Mapa
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">{leads.length} en total</span>

            <button
              onClick={exportCSV}
              disabled={displayedLeads.length === 0}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 disabled:opacity-40"
            >
              ↓ CSV ({displayedLeads.length})
            </button>
            <button
              onClick={() => setAddLeadOpen(true)}
              className="text-xs px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors border border-gray-600"
            >
              + Agregar
            </button>
            <Link
              href="/buscar"
              className="text-xs px-3 py-1.5 rounded-lg bg-ceibo-700 hover:bg-ceibo-600 text-white font-medium transition-colors"
            >
              Nueva búsqueda →
            </Link>
          </div>
        </div>
        <div className="space-y-4">
          <LeadFilters
            websiteFilter={websiteFilter}
            priority={priority}
            platform={platform}
            status={status}
            categoryFilter={categoryFilter}
            tagFilter={tagFilter}
            favoritesOnly={favoritesOnly}
            hotOnly={hotOnly}
            difficulty={difficulty}
            segment={segment}
            locationRegion={locationRegion}
            nameSearch={nameSearch}
            regions={distinctRegions}
            categories={distinctCategories}
            tags={distinctTags}
            onWebsiteFilterChange={setWebsiteFilter}
            onPriorityChange={setPriority}
            onPlatformChange={setPlatform}
            onStatusChange={setStatus}
            onCategoryChange={setCategoryFilter}
            onTagChange={setTagFilter}
            onFavoritesChange={setFavoritesOnly}
            onHotChange={setHotOnly}
            onDifficultyChange={setDifficulty}
            onSegmentChange={setSegment}
            onRegionChange={setLocationRegion}
            onNameSearchChange={setNameSearch}
            onClearFilters={handleClearFilters}
            onExport={handleExport}
            totalCount={displayedLeads.length}
          />
          {viewMode === "map" ? (
            <LeadMap
              leads={displayedLeads}
              onLeadClick={(lead) => setMapLead(lead)}
            />
          ) : loading ? (
            <LeadsSkeleton />
          ) : (
            <LeadsTable
              leads={displayedLeads}
              compareIds={compareIds}
              onDelete={handleDelete}
              onToggleCompare={(id) => {
                setCompareIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id); else next.add(id);
                  return next;
                });
              }}
              onUpdate={handleUpdate}
            />
          )}

          {/* Comparator / bulk actions floating bar */}
          {compareIds.size >= 1 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-900 border border-ceibo-700 rounded-2xl px-5 py-3 flex items-center gap-3 shadow-2xl">
              <span className="text-sm text-gray-300">
                <span className="text-ceibo-400 font-bold">{compareIds.size}</span> seleccionados
              </span>
              {compareIds.size >= 2 && (
                <button
                  onClick={() => setComparatorOpen(true)}
                  className="text-sm px-3 py-1.5 rounded-lg bg-ceibo-700 hover:bg-ceibo-600 text-white font-semibold transition-colors"
                >
                  Comparar →
                </button>
              )}
              <div className="flex items-center gap-1">
                <select
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value as LeadStatus | "")}
                  className="text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-2 py-1.5"
                >
                  <option value="">Cambiar estado…</option>
                  <option value="not_contacted">Sin contactar</option>
                  <option value="contacted">Contactado</option>
                  <option value="interested">Interesado</option>
                  <option value="proposal_sent">Propuesta enviada</option>
                  <option value="closed_won">Cerrado ganado</option>
                  <option value="closed_lost">Cerrado perdido</option>
                </select>
                {bulkStatus && (
                  <button
                    onClick={() => handleBulkAction("status", bulkStatus)}
                    disabled={bulkLoading}
                    className="text-xs px-2 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors disabled:opacity-50"
                  >
                    ✓
                  </button>
                )}
              </div>
              <button
                onClick={() => handleBulkAction("recalculate")}
                disabled={bulkLoading}
                className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-300 transition-colors disabled:opacity-50"
              >
                ↻ Score
              </button>
              <button
                onClick={() => handleBulkAction("delete")}
                disabled={bulkLoading}
                className="text-xs px-3 py-1.5 rounded-lg bg-red-900/50 border border-red-800 hover:bg-red-900 text-red-400 transition-colors disabled:opacity-50"
              >
                Eliminar
              </button>
              <button
                onClick={() => setCompareIds(new Set())}
                className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </section>

      {comparatorOpen && (
        <ComparatorModal
          leads={displayedLeads.filter((l) => compareIds.has(l.id))}
          onClose={() => setComparatorOpen(false)}
          onSelectLead={(lead) => {
            setComparatorLead(lead);
            setComparatorOpen(false);
          }}
        />
      )}

      {comparatorLead && (
        <LeadModal
          lead={comparatorLead}
          onClose={() => setComparatorLead(null)}
          onUpdate={handleUpdate}
          onDelete={(id) => { handleDelete(id); setComparatorLead(null); }}
        />
      )}

      {mapLead && (
        <LeadModal
          lead={mapLead}
          onClose={() => setMapLead(null)}
          onUpdate={handleUpdate}
          onDelete={(id) => { handleDelete(id); setMapLead(null); }}
        />
      )}

      {addLeadOpen && (
        <AddLeadModal
          onClose={() => setAddLeadOpen(false)}
          onCreated={() => { setAddLeadOpen(false); fetchLeads(); }}
        />
      )}


    </main>
  );
}
