"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { SearchForm } from "@/components/SearchForm";
import { LeadsTable } from "@/components/LeadsTable";
import { LeadFilters } from "@/components/LeadFilters";
import type { Lead, LeadStatus, Platform, PriorityFilter, SearchConfig, WebsiteFilter } from "@/lib/types";

export default function Dashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [searching, setSearching] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [websiteFilter, setWebsiteFilter] = useState<WebsiteFilter>("all");
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [platform, setPlatform] = useState<Platform | "all">("all");
  const [status, setStatus] = useState<LeadStatus | "all">("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [hotOnly, setHotOnly] = useState(false);
  const [lastResult, setLastResult] = useState<{
    total: number; no_website: number; bad_website: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    const params = new URLSearchParams();
    if (websiteFilter !== "all") params.set("website_filter", websiteFilter);
    if (priority !== "all") params.set("priority", priority);
    if (platform !== "all") params.set("platform", platform);
    if (status !== "all") params.set("status", status);
    if (favoritesOnly) params.set("favorites", "1");
    if (hotOnly) params.set("hot", "1");
    const res = await fetch(`/api/leads?${params}`);
    const data = await res.json();
    setLeads(data);
  }, [websiteFilter, priority, platform, status, favoritesOnly, hotOnly]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // Client-side filters for location, category, tags
  const displayedLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (locationFilter !== "all" && lead.search_location !== locationFilter) return false;
      if (categoryFilter !== "all" && lead.category !== categoryFilter) return false;
      if (tagFilter !== "all") {
        const tags: string[] = (() => { try { return JSON.parse(lead.tags ?? "[]"); } catch { return []; } })();
        if (!tags.includes(tagFilter)) return false;
      }
      return true;
    });
  }, [leads, locationFilter, categoryFilter, tagFilter]);

  // Derived filter options from loaded leads
  const distinctLocations = useMemo(
    () => Array.from(new Set(leads.map((l) => l.search_location).filter(Boolean))).sort(),
    [leads]
  );
  const distinctCategories = useMemo(
    () => Array.from(new Set(leads.map((l) => l.category).filter(Boolean) as string[])).sort(),
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

  const handleSearch = async (config: SearchConfig) => {
    setSearching(true);
    setProgressMsg("");
    setError(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok || !res.body) throw new Error("Search failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
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
            if (msg.type === "progress") setProgressMsg(msg.message);
            else if (msg.type === "done") {
              setLastResult({ total: msg.total, no_website: msg.no_website, bad_website: msg.bad_website });
              await fetchLeads();
            }
          } catch {}
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSearching(false);
      setProgressMsg("");
    }
  };

  const handleUpdate = async (id: number, data: { status?: LeadStatus; notes?: string; tags?: string[]; sequence_stage?: string; next_followup_at?: string | null; is_favorite?: boolean }) => {
    await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    await fetchLeads();
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (websiteFilter !== "all") params.set("website_filter", websiteFilter);
    window.open(`/api/export?${params}`, "_blank");
  };

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      {/* Search */}
      <section>
        <h2 className="text-lg font-semibold text-gray-200 mb-3">Buscar Negocios</h2>
        <SearchForm onSearch={handleSearch} loading={searching} progressMsg={progressMsg} />
      </section>

      {/* Search result summary */}
      {lastResult && !searching && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-wrap items-center gap-6">
          <div>
            <div className="text-2xl font-bold text-ceibo-400">{lastResult.total}</div>
            <div className="text-xs text-gray-500">negocios nuevos</div>
          </div>
          <div className="w-px h-8 bg-gray-800" />
          <div>
            <div className="text-2xl font-bold text-red-400">{lastResult.no_website}</div>
            <div className="text-xs text-gray-500">sin website</div>
          </div>
          <div className="w-px h-8 bg-gray-800" />
          <div>
            <div className="text-2xl font-bold text-orange-400">{lastResult.bad_website}</div>
            <div className="text-xs text-gray-500">website deficiente/mejorable</div>
          </div>
          <div className="w-px h-8 bg-gray-800" />
          <div>
            <div className="text-2xl font-bold text-gray-300">
              {lastResult.no_website + lastResult.bad_website}
            </div>
            <div className="text-xs text-gray-500">oportunidades totales</div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-950 border border-red-800 rounded-xl p-4 text-red-400 text-sm">
          Error: {error}
        </div>
      )}

      {/* Leads */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-200">Base de Leads</h2>
          <span className="text-xs text-gray-600">{leads.length} en total</span>
        </div>
        <div className="space-y-4">
          <LeadFilters
            websiteFilter={websiteFilter}
            priority={priority}
            platform={platform}
            status={status}
            locationFilter={locationFilter}
            categoryFilter={categoryFilter}
            tagFilter={tagFilter}
            favoritesOnly={favoritesOnly}
            hotOnly={hotOnly}
            locations={distinctLocations}
            categories={distinctCategories}
            tags={distinctTags}
            onWebsiteFilterChange={setWebsiteFilter}
            onPriorityChange={setPriority}
            onPlatformChange={setPlatform}
            onStatusChange={setStatus}
            onLocationChange={setLocationFilter}
            onCategoryChange={setCategoryFilter}
            onTagChange={setTagFilter}
            onFavoritesChange={setFavoritesOnly}
            onHotChange={setHotOnly}
            onExport={handleExport}
            totalCount={displayedLeads.length}
          />
          <LeadsTable leads={displayedLeads} onUpdate={handleUpdate} />
        </div>
      </section>
    </main>
  );
}
