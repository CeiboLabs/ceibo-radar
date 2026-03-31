"use client";

import { useEffect, useState } from "react";
import type { Campaign, Lead } from "@/lib/types";

// ─── Create Campaign Modal ────────────────────────────────────────────────────
function CreateModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (c: Campaign) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
    });
    const data = await res.json();
    onCreate(data);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md mx-4 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-bold text-white">Nueva campaña</h2>
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Nombre</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="ej: Gyms Montevideo"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-ceibo-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Descripción (opcional)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
            placeholder="Describe el objetivo de esta campaña"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-ceibo-500 resize-none" />
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={handleCreate} disabled={saving || !name.trim()}
            className="flex-1 bg-ceibo-600 hover:bg-ceibo-500 disabled:bg-gray-700 text-white font-semibold py-2 rounded-lg text-sm transition-colors">
            {saving ? "Creando..." : "Crear campaña"}
          </button>
          <button onClick={onClose} className="px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

const CAMPAIGN_STATUSES = [
  { value: "active",   label: "Activa",    className: "text-ceibo-500 bg-ceibo-950 border-ceibo-800" },
  { value: "paused",   label: "Pausada",   className: "text-yellow-500 bg-yellow-950 border-yellow-800" },
  { value: "archived", label: "Archivada", className: "text-gray-400 bg-gray-800 border-gray-700" },
] as const;

// ─── Campaign Detail Panel ────────────────────────────────────────────────────
function CampaignDetail({ campaign, onClose, onDelete, onUpdate }: {
  campaign: Campaign;
  onClose: () => void;
  onDelete: (id: number) => void;
  onUpdate: (id: number, data: Partial<Campaign>) => void;
}) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusSaving, setStatusSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/campaigns/${campaign.id}`)
      .then((r) => r.json())
      .then((data) => { setLeads(data.leads ?? []); setLoading(false); });
  }, [campaign.id]);

  const removeLead = async (leadId: number) => {
    await fetch(`/api/campaigns/${campaign.id}/leads`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId }),
    });
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
  };

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar la campaña "${campaign.name}"?`)) return;
    await fetch(`/api/campaigns/${campaign.id}`, { method: "DELETE" });
    onDelete(campaign.id);
    onClose();
  };

  const handleStatusChange = async (newStatus: string) => {
    setStatusSaving(true);
    const res = await fetch(`/api/campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    const updated = await res.json();
    onUpdate(campaign.id, updated);
    setStatusSaving(false);
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-bold text-white">{campaign.name}</h3>
          {campaign.description && <p className="text-xs text-gray-500 mt-0.5">{campaign.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleDelete} className="text-xs text-red-500 hover:text-red-400 transition-colors">
            Eliminar
          </button>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Status selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Estado:</span>
        <div className="flex gap-1.5">
          {CAMPAIGN_STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => handleStatusChange(s.value)}
              disabled={statusSaving || campaign.status === s.value}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-colors disabled:cursor-default ${
                campaign.status === s.value
                  ? s.className
                  : "text-gray-600 bg-gray-800 border-gray-700 hover:text-gray-400 hover:border-gray-600"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-500">{leads.length} leads en esta campaña</p>

      {loading ? (
        <p className="text-xs text-gray-600">Cargando leads...</p>
      ) : leads.length === 0 ? (
        <div className="bg-gray-800 rounded-xl p-6 text-center">
          <p className="text-sm text-gray-500">Esta campaña no tiene leads todavía.</p>
          <p className="text-xs text-gray-600 mt-1">Agregá leads desde la vista principal.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {leads.map((lead) => (
            <div key={lead.id} className="flex items-center gap-3 bg-gray-800 rounded-lg px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">{lead.name}</div>
                <div className="text-xs text-gray-500">
                  {lead.has_website ? "Con website" : "Sin website"} · Score {lead.lead_score ?? "—"}
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded border ${
                lead.lead_priority === "high" ? "bg-red-950 text-red-400 border-red-900" :
                lead.lead_priority === "medium" ? "bg-yellow-950 text-yellow-500 border-yellow-900" :
                "bg-gray-700 text-gray-500 border-gray-600"
              }`}>{lead.lead_priority ?? "—"}</span>
              <button onClick={() => removeLead(lead.id)}
                className="text-xs text-gray-600 hover:text-red-400 transition-colors shrink-0">
                Quitar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Campaign | null>(null);

  useEffect(() => {
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then((data) => { setCampaigns(Array.isArray(data) ? data : []); setLoading(false); });
  }, []);

  const onCreate = (c: Campaign) => setCampaigns((prev) => [c, ...prev]);
  const onDelete = (id: number) => {
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
    if (selected?.id === id) setSelected(null);
  };
  const onUpdate = (id: number, data: Partial<Campaign>) => {
    setCampaigns((prev) => prev.map((c) => c.id === id ? { ...c, ...data } : c));
    if (selected?.id === id) setSelected((prev) => prev ? { ...prev, ...data } : prev);
  };

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-100">Campañas</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-ceibo-600 hover:bg-ceibo-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + Nueva campaña
        </button>
      </div>

      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onCreate={onCreate} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Campaign list */}
        <div className="space-y-3">
          {loading && <p className="text-sm text-gray-600">Cargando...</p>}
          {!loading && campaigns.length === 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
              <p className="text-sm text-gray-500">No hay campañas creadas.</p>
            </div>
          )}
          {campaigns.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c)}
              className={`w-full text-left bg-gray-900 border rounded-xl p-4 transition-colors hover:border-gray-600 ${
                selected?.id === c.id ? "border-ceibo-700" : "border-gray-800"
              }`}
            >
              <div className="font-semibold text-white text-sm">{c.name}</div>
              {c.description && (
                <div className="text-xs text-gray-500 mt-0.5 truncate">{c.description}</div>
              )}
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs text-gray-600">{(c.lead_count ?? 0)} leads</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  c.status === "active" ? "text-ceibo-500 bg-ceibo-950" :
                  c.status === "paused" ? "text-yellow-500 bg-yellow-950" :
                  "text-gray-600 bg-gray-800"
                }`}>{c.status}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Campaign detail */}
        <div className="md:col-span-2">
          {selected ? (
            <CampaignDetail
              campaign={selected}
              onClose={() => setSelected(null)}
              onDelete={onDelete}
              onUpdate={onUpdate}
            />
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center h-full flex items-center justify-center">
              <div>
                <p className="text-gray-500 text-sm">Seleccioná una campaña para ver sus leads</p>
                <p className="text-gray-700 text-xs mt-1">o creá una nueva para organizar tu outreach</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
