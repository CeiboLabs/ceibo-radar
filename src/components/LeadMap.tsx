"use client";

import { useEffect, useRef } from "react";
import type { Lead } from "@/lib/types";

// Known coordinates for Uruguayan locations
const LOCATION_COORDS: Record<string, [number, number]> = {
  "montevideo":         [-34.9011, -56.1645],
  "canelones":          [-34.5222, -56.2778],
  "maldonado":          [-34.9133, -54.9611],
  "punta del este":     [-34.9667, -54.9500],
  "la barra":           [-34.8833, -54.8833],
  "rocha":              [-34.4792, -54.3361],
  "colonia":            [-34.4628, -57.8400],
  "colonia del sacramento": [-34.4628, -57.8400],
  "san jose":           [-34.3367, -56.7133],
  "san josé":           [-34.3367, -56.7133],
  "flores":             [-33.5275, -56.8869],
  "florida":            [-34.0939, -56.2147],
  "lavalleja":          [-34.3708, -55.2353],
  "minas":              [-34.3708, -55.2353],
  "treinta y tres":     [-33.2333, -54.3833],
  "cerro largo":        [-32.3333, -54.1500],
  "melo":               [-32.3667, -54.1833],
  "rivera":             [-30.9053, -55.5311],
  "tacuarembo":         [-31.7167, -55.9833],
  "tacuarembó":         [-31.7167, -55.9833],
  "durazno":            [-33.3833, -56.5167],
  "soriano":            [-33.3547, -58.0283],
  "mercedes":           [-33.3547, -58.0283],
  "rio negro":          [-33.1372, -58.2972],
  "río negro":          [-33.1372, -58.2972],
  "fray bentos":        [-33.1372, -58.2972],
  "paysandu":           [-32.3228, -58.0764],
  "paysandú":           [-32.3228, -58.0764],
  "salto":              [-31.3833, -57.9667],
  "artigas":            [-30.4044, -56.4742],
  "uruguay":            [-32.5228, -55.7658],
};

function getCoords(location: string): [number, number] | null {
  const normalized = location
    .toLowerCase()
    .replace(/, uruguay/gi, "")
    .replace(/, uy/gi, "")
    .trim();

  // Direct match
  if (LOCATION_COORDS[normalized]) return LOCATION_COORDS[normalized];

  // Partial match — check if any known key is contained in the location string
  for (const [key, coords] of Object.entries(LOCATION_COORDS)) {
    if (normalized.includes(key) || key.includes(normalized)) return coords;
  }

  return null;
}

interface MapPin {
  coords: [number, number];
  location: string;
  leads: Lead[];
}

function buildPins(leads: Lead[]): MapPin[] {
  const groups = new Map<string, Lead[]>();
  for (const lead of leads) {
    const loc = lead.search_location ?? lead.location ?? "";
    if (!groups.has(loc)) groups.set(loc, []);
    groups.get(loc)!.push(lead);
  }

  const pins: MapPin[] = [];
  for (const [location, locLeads] of groups) {
    const coords = getCoords(location);
    if (!coords) continue;
    // Add tiny jitter so overlapping cities don't stack exactly
    const jittered: [number, number] = [
      coords[0] + (Math.random() - 0.5) * 0.015,
      coords[1] + (Math.random() - 0.5) * 0.015,
    ];
    pins.push({ coords: jittered, location, leads: locLeads });
  }
  return pins;
}

function pinColor(leads: Lead[]): string {
  const hot = leads.some(l => l.is_hot);
  if (hot) return "#ef4444"; // red
  const priorities = leads.map(l => l.lead_priority);
  if (priorities.includes("high")) return "#f97316"; // orange
  if (priorities.includes("medium")) return "#eab308"; // yellow
  return "#6b7280"; // gray
}

interface LeadMapProps {
  leads: Lead[];
  onLeadClick?: (lead: Lead) => void;
}

export default function LeadMap({ leads, onLeadClick }: LeadMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Dynamic import — Leaflet requires browser environment
    import("leaflet").then(L => {
      // Fix default icon paths for Next.js
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      const map = L.map(containerRef.current!, {
        center: [-32.8, -56.0],
        zoom: 7,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);

      const pins = buildPins(leads);

      for (const pin of pins) {
        const color = pinColor(pin.leads);
        const count = pin.leads.length;

        const icon = L.divIcon({
          className: "",
          html: `<div style="
            background:${color};
            color:white;
            border-radius:50%;
            width:${count > 9 ? 36 : 30}px;
            height:${count > 9 ? 36 : 30}px;
            display:flex;
            align-items:center;
            justify-content:center;
            font-size:12px;
            font-weight:700;
            border:2px solid rgba(255,255,255,0.3);
            box-shadow:0 2px 6px rgba(0,0,0,0.4);
            cursor:pointer;
          ">${count}</div>`,
          iconSize: [count > 9 ? 36 : 30, count > 9 ? 36 : 30],
          iconAnchor: [count > 9 ? 18 : 15, count > 9 ? 18 : 15],
        });

        const topLeads = [...pin.leads]
          .sort((a, b) => (b.lead_score ?? 0) - (a.lead_score ?? 0))
          .slice(0, 5);

        const popupContent = `
          <div style="font-family:sans-serif;min-width:200px">
            <div style="font-weight:600;margin-bottom:6px;color:#111">${pin.location}</div>
            <div style="font-size:12px;color:#666;margin-bottom:8px">${count} lead${count !== 1 ? "s" : ""}</div>
            ${topLeads.map(l => `
              <div style="display:flex;align-items:center;gap:6px;padding:3px 0;border-top:1px solid #f0f0f0">
                <span style="font-size:11px;font-weight:500;color:#111;flex:1">${l.name}</span>
                ${l.lead_score != null ? `<span style="font-size:10px;background:#f0fdf4;color:#166534;padding:1px 5px;border-radius:9px">${l.lead_score}</span>` : ""}
              </div>
            `).join("")}
            ${count > 5 ? `<div style="font-size:11px;color:#999;margin-top:4px">+${count - 5} más</div>` : ""}
          </div>
        `;

        const marker = L.marker(pin.coords, { icon });
        marker.bindPopup(popupContent, { maxWidth: 260 });

        if (onLeadClick && pin.leads.length === 1) {
          marker.on("click", () => onLeadClick(pin.leads[0]));
        }

        marker.addTo(map);
      }

      mapRef.current = map;

      // Fit bounds to pins if we have any
      if (pins.length > 0) {
        const bounds = L.latLngBounds(pins.map(p => p.coords));
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
      }
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers when leads change
  useEffect(() => {
    if (!mapRef.current) return;
    import("leaflet").then(L => {
      const map = mapRef.current!;
      map.eachLayer(layer => {
        if (layer instanceof L.Marker) map.removeLayer(layer);
      });

      const pins = buildPins(leads);
      for (const pin of pins) {
        const color = pinColor(pin.leads);
        const count = pin.leads.length;
        const icon = L.divIcon({
          className: "",
          html: `<div style="background:${color};color:white;border-radius:50%;width:${count > 9 ? 36 : 30}px;height:${count > 9 ? 36 : 30}px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;border:2px solid rgba(255,255,255,0.3);box-shadow:0 2px 6px rgba(0,0,0,0.4)">${count}</div>`,
          iconSize: [count > 9 ? 36 : 30, count > 9 ? 36 : 30],
          iconAnchor: [count > 9 ? 18 : 15, count > 9 ? 18 : 15],
        });
        const topLeads = [...pin.leads].sort((a, b) => (b.lead_score ?? 0) - (a.lead_score ?? 0)).slice(0, 5);
        const popupContent = `<div style="font-family:sans-serif;min-width:200px"><div style="font-weight:600;margin-bottom:6px">${pin.location}</div><div style="font-size:12px;color:#666;margin-bottom:8px">${count} lead${count !== 1 ? "s" : ""}</div>${topLeads.map(l => `<div style="display:flex;align-items:center;gap:6px;padding:3px 0;border-top:1px solid #f0f0f0"><span style="font-size:11px;flex:1">${l.name}</span>${l.lead_score != null ? `<span style="font-size:10px;background:#f0fdf4;color:#166534;padding:1px 5px;border-radius:9px">${l.lead_score}</span>` : ""}</div>`).join("")}${count > 5 ? `<div style="font-size:11px;color:#999;margin-top:4px">+${count - 5} más</div>` : ""}</div>`;
        const marker = L.marker(pin.coords, { icon });
        marker.bindPopup(popupContent, { maxWidth: 260 });
        if (onLeadClick && pin.leads.length === 1) marker.on("click", () => onLeadClick(pin.leads[0]));
        marker.addTo(map);
      }
    });
  }, [leads, onLeadClick]);

  return (
    <div className="relative">
      <div ref={containerRef} className="w-full rounded-xl overflow-hidden" style={{ height: "520px" }} />
      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-gray-900/90 border border-gray-700 rounded-lg px-3 py-2 text-xs space-y-1.5 z-[1000]">
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> HOT lead</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-orange-500 inline-block" /> Alta prioridad</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" /> Media prioridad</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-gray-500 inline-block" /> Baja / sin clasificar</div>
      </div>
    </div>
  );
}
