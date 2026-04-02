"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { LeadsTable } from "@/components/LeadsTable";
import { LeadFilters } from "@/components/LeadFilters";
import type { Lead, LeadStatus, Platform, PriorityFilter, WebsiteFilter } from "@/lib/types";
import type { DifficultyLevel } from "@/lib/sales/difficultyEngine";
import type { SegmentTag } from "@/lib/sales/segmentationEngine";
import { ComparatorModal } from "@/components/ComparatorModal";
import { LeadModal } from "@/components/LeadModal";

export default function Dashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
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

  const fetchLeads = useCallback(async () => {
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
        t.forEach((tag) => tagSet.add(tag));
      } catch {}
    });
    return Array.from(tagSet).sort();
  }, [leads]);

  const handleUpdate = async (id: number, data: { status?: LeadStatus; notes?: string; tags?: string[]; sequence_stage?: string; next_followup_at?: string | null; is_favorite?: boolean }) => {
    await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    await fetchLeads();
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/leads/${id}`, { method: "DELETE" });
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

  const handleExport = () => {
    const params = new URLSearchParams();
    if (websiteFilter !== "all") params.set("website_filter", websiteFilter);
    window.open(`/api/export?${params}`, "_blank");
  };

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      {/* Leads */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-200">Leads</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-600">{leads.length} en total</span>
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

          {/* Comparator floating bar */}
          {compareIds.size >= 2 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-900 border border-ceibo-700 rounded-2xl px-5 py-3 flex items-center gap-4 shadow-2xl">
              <span className="text-sm text-gray-300">
                <span className="text-ceibo-400 font-bold">{compareIds.size}</span> leads seleccionados
              </span>
              <button
                onClick={() => setComparatorOpen(true)}
                className="text-sm px-4 py-1.5 rounded-lg bg-ceibo-700 hover:bg-ceibo-600 text-white font-semibold transition-colors"
              >
                Comparar →
              </button>
              <button
                onClick={() => setCompareIds(new Set())}
                className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
              >
                Limpiar
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
    </main>
  );
}
