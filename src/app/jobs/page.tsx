"use client";

import { useEffect, useState } from "react";
import type { ScrapeJob } from "@/lib/types";

function CreateJobModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (j: ScrapeJob) => void;
}) {
  const [name, setName] = useState("");
  const [keyword, setKeyword] = useState("");
  const [locationsText, setLocationsText] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["google_maps"]);
  const [maxScrolls, setMaxScrolls] = useState(8);
  const [schedule, setSchedule] = useState("manual");
  const [saving, setSaving] = useState(false);

  const togglePlatform = (p: string) => {
    setPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  };

  const handleCreate = async () => {
    if (!name.trim() || !keyword.trim() || !locationsText.trim()) return;
    setSaving(true);
    const locations = locationsText.split(/[,\n]/).map((l) => l.trim()).filter(Boolean);
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), keyword: keyword.trim(), locations, platforms, max_scrolls: maxScrolls, schedule }),
    });
    const data = await res.json();
    onCreate(data);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md mx-4 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-bold text-white">Nuevo Job de búsqueda</h2>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Nombre</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="ej: Gyms Montevideo semanal"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-ceibo-500" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Keyword</label>
            <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)}
              placeholder="gym"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-ceibo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Schedule</label>
            <select value={schedule} onChange={(e) => setSchedule(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-ceibo-500">
              <option value="manual">Manual</option>
              <option value="daily">Diario</option>
              <option value="weekly">Semanal</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Ubicaciones (separadas por coma)</label>
          <input type="text" value={locationsText} onChange={(e) => setLocationsText(e.target.value)}
            placeholder="Montevideo, Punta del Este"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-ceibo-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2">Plataformas</label>
          <div className="flex gap-2">
            {["google_maps", "instagram"].map((p) => (
              <button key={p} type="button" onClick={() => togglePlatform(p)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                  platforms.includes(p) ? "bg-ceibo-600 border-ceibo-500 text-white" : "bg-gray-800 border-gray-700 text-gray-400"
                }`}>
                {p === "google_maps" ? "Google Maps" : "Instagram"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Profundidad — {maxScrolls} scrolls
          </label>
          <input type="range" min={3} max={25} value={maxScrolls} onChange={(e) => setMaxScrolls(Number(e.target.value))}
            className="w-full accent-ceibo-500" />
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={handleCreate} disabled={saving || !name.trim() || !keyword.trim()}
            className="flex-1 bg-ceibo-600 hover:bg-ceibo-500 disabled:bg-gray-700 text-white font-semibold py-2 rounded-lg text-sm">
            {saving ? "Creando..." : "Crear job"}
          </button>
          <button onClick={onClose} className="px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<ScrapeJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [runningJobId, setRunningJobId] = useState<number | null>(null);
  const [runProgress, setRunProgress] = useState<Record<number, string>>({});

  useEffect(() => {
    fetch("/api/jobs").then((r) => r.json()).then((data) => { setJobs(data); setLoading(false); });
  }, []);

  const toggleJob = async (job: ScrapeJob) => {
    const res = await fetch(`/api/jobs/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !job.enabled }),
    });
    const updated = await res.json();
    setJobs((prev) => prev.map((j) => j.id === job.id ? updated : j));
  };

  const deleteJob = async (id: number) => {
    if (!confirm("¿Eliminar este job?")) return;
    await fetch(`/api/jobs/${id}`, { method: "DELETE" });
    setJobs((prev) => prev.filter((j) => j.id !== id));
  };

  const runJob = async (job: ScrapeJob) => {
    if (runningJobId !== null) return;
    setRunningJobId(job.id);
    setRunProgress((prev) => ({ ...prev, [job.id]: "Iniciando..." }));
    try {
      const locations: string[] = JSON.parse(job.locations);
      const platforms: string[] = JSON.parse(job.platforms);
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: job.keyword, locations, platforms, maxScrolls: job.max_scrolls }),
      });
      if (!res.ok || !res.body) throw new Error("Search failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let totalFound = 0;

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
            if (msg.type === "progress") setRunProgress((prev) => ({ ...prev, [job.id]: msg.message }));
            else if (msg.type === "done") totalFound = msg.total ?? 0;
          } catch {}
        }
      }

      // Patch job with run metadata
      await fetch(`/api/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ last_run_at: new Date().toISOString(), leads_found_last: totalFound }),
      });
      const refreshed = await fetch("/api/jobs").then((r) => r.json());
      setJobs(refreshed);
      setRunProgress((prev) => ({ ...prev, [job.id]: `Completado — ${totalFound} leads encontrados` }));
    } catch {
      setRunProgress((prev) => ({ ...prev, [job.id]: "Error al ejecutar" }));
    } finally {
      setRunningJobId(null);
      setTimeout(() => setRunProgress((prev) => { const n = { ...prev }; delete n[job.id]; return n; }), 4000);
    }
  };

  const onCreate = (j: ScrapeJob) => setJobs((prev) => [j, ...prev]);

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-100">Jobs de búsqueda</h2>
          <p className="text-xs text-gray-600 mt-0.5">Configurá búsquedas recurrentes para mantener el pipeline actualizado</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="bg-ceibo-600 hover:bg-ceibo-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          + Nuevo job
        </button>
      </div>

      {showCreate && <CreateJobModal onClose={() => setShowCreate(false)} onCreate={onCreate} />}

      {loading && <p className="text-sm text-gray-600">Cargando jobs...</p>}

      {!loading && jobs.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-gray-500 text-sm">No hay jobs configurados.</p>
          <p className="text-gray-700 text-xs mt-1">Creá un job para programar búsquedas recurrentes.</p>
        </div>
      )}

      <div className="space-y-3">
        {jobs.map((job) => {
          const locations: string[] = (() => { try { return JSON.parse(job.locations); } catch { return []; } })();
          const platforms: string[] = (() => { try { return JSON.parse(job.platforms); } catch { return []; } })();
          return (
            <div key={job.id} className={`bg-gray-900 border rounded-xl p-5 transition-colors ${
              job.enabled ? "border-gray-800" : "border-gray-800/50 opacity-60"
            }`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-white text-sm">{job.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      job.schedule === "manual" ? "bg-gray-800 text-gray-500" :
                      job.schedule === "daily" ? "bg-blue-950 text-blue-400" :
                      "bg-purple-950 text-purple-400"
                    }`}>{job.schedule}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                    <span>Keyword: <span className="text-gray-300">{job.keyword}</span></span>
                    <span>Ubicaciones: <span className="text-gray-300">{locations.join(", ")}</span></span>
                    <span>Plataformas: <span className="text-gray-300">{platforms.map(p => p === "google_maps" ? "Maps" : "IG").join(", ")}</span></span>
                    <span>Profundidad: <span className="text-gray-300">{job.max_scrolls} scrolls</span></span>
                    {job.last_run_at && <span>Última vez: <span className="text-gray-400">{new Date(job.last_run_at).toLocaleDateString("es-UY")}</span></span>}
                    {job.leads_found_last != null && <span>Leads: <span className="text-ceibo-400">{job.leads_found_last}</span></span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {/* Run now */}
                  <button
                    onClick={() => runJob(job)}
                    disabled={runningJobId !== null}
                    className="text-xs px-2.5 py-1 rounded-lg bg-ceibo-900 hover:bg-ceibo-800 disabled:bg-gray-800 disabled:text-gray-600 text-ceibo-300 border border-ceibo-800 transition-colors whitespace-nowrap"
                  >
                    {runningJobId === job.id ? "Ejecutando..." : "Ejecutar"}
                  </button>
                  {/* Toggle enabled */}
                  <button onClick={() => toggleJob(job)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      job.enabled ? "bg-ceibo-600" : "bg-gray-700"
                    }`}>
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                      job.enabled ? "translate-x-5" : "translate-x-1"
                    }`} />
                  </button>
                  <button onClick={() => deleteJob(job.id)}
                    className="text-xs text-gray-600 hover:text-red-400 transition-colors">
                    Eliminar
                  </button>
                </div>
              </div>
              {runProgress[job.id] && (
                <div className="mt-3 px-3 py-2 bg-ceibo-950/40 border border-ceibo-900 rounded-lg text-xs text-ceibo-300">
                  {runProgress[job.id]}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Note about scheduling */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 text-xs text-gray-600">
        <strong className="text-gray-500">Nota sobre scheduling:</strong> Los jobs con schedule daily/weekly se pueden ejecutar manualmente desde aquí. La ejecución automática puede configurarse externamente usando cron + la API <code className="text-gray-400">/api/search</code> con los parámetros del job.
      </div>
    </main>
  );
}
