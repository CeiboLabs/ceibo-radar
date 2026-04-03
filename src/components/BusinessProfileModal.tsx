"use client";

import { useState } from "react";
import type { Lead } from "@/lib/types";

interface Props {
  lead: Lead;
  onClose: () => void;
}

const PLATFORM_LABEL: Record<string, string> = {
  google_maps: "Google Maps",
  instagram:   "Instagram",
};

const CMS_LABEL: Record<string, string> = {
  wordpress:  "WordPress",
  wix:        "Wix",
  squarespace:"Squarespace",
  shopify:    "Shopify",
  tiendanube: "Tiendanube",
  webflow:    "Webflow",
  joomla:     "Joomla",
  drupal:     "Drupal",
};

function buildWebLine(lead: Lead): string {
  if (!lead.has_website) return "No tiene sitio web";
  const quality =
    lead.website_quality === "poor"              ? "Sitio web muy desactualizado" :
    lead.website_quality === "needs_improvement" ? "Sitio web mejorable" :
                                                   "Sitio web bueno";
  const cms = lead.cms_type ? ` (${CMS_LABEL[lead.cms_type] ?? lead.cms_type})` : "";
  return quality + cms;
}

function buildRedesLine(lead: Lead): string {
  const found = PLATFORM_LABEL[lead.platform] ?? lead.platform;
  if (lead.platform === "google_maps") return `Solo Google Maps, sin Instagram detectado`;
  if (lead.platform === "instagram")   return `Instagram`;
  return found;
}

function buildReviewsLine(lead: Lead): string {
  if (!lead.rating && !lead.review_count) return "Sin reseñas registradas";
  const stars = lead.rating ? `${lead.rating} ⭐` : "";
  const count = lead.review_count ? `(${lead.review_count} reseñas)` : "";
  return [stars, count].filter(Boolean).join(" ");
}

function buildOportunidadLine(lead: Lead): string {
  if (lead.contact_reason)    return lead.contact_reason;
  if (lead.business_diagnosis) return lead.business_diagnosis;
  if (lead.ai_summary)        return lead.ai_summary;

  // Fallback: generate from data
  const noWeb   = !lead.has_website;
  const badWeb  = lead.website_quality === "poor" || lead.website_quality === "needs_improvement";
  const hot     = lead.is_hot;
  const reviews = lead.review_count ? ` con ${lead.review_count} reseñas` : "";

  if (noWeb && hot)  return `Negocio activo${reviews} sin ninguna presencia web propia. Alta oportunidad de ser el primer punto de contacto digital.`;
  if (noWeb)         return `Sin sitio web${reviews}. No aparece en búsquedas fuera de ${PLATFORM_LABEL[lead.platform] ?? lead.platform}.`;
  if (badWeb)        return `Tiene sitio web pero desactualizado o con problemas. Puede perder clientes frente a competencia con mejor presencia digital.`;
  return `Negocio establecido${reviews}. Potencial de mejorar conversión y captación online.`;
}

function buildAnalysis(lead: Lead): string {
  const city =
    lead.location?.split(",")[0]?.trim() ??
    lead.search_location?.split(",")[0]?.trim() ??
    "Uruguay";

  const lines: [string, string][] = [
    ["Negocio",       lead.name],
    ["Rubro",         lead.category ?? "—"],
    ["Ciudad",        city],
    ["Encontrado en", PLATFORM_LABEL[lead.platform] ?? lead.platform],
    ["Reseñas",       buildReviewsLine(lead)],
    ["Web",           buildWebLine(lead)],
    ["Redes sociales",buildRedesLine(lead)],
    ["Descripción",   lead.description?.slice(0, 200) ?? "Sin descripción"],
    ["Oportunidad",   buildOportunidadLine(lead)],
  ];

  return lines.map(([k, v]) => `${k}: ${v}`).join("\n");
}

export function BusinessProfileModal({ lead, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  const analysis = buildAnalysis(lead);

  const phone = lead.phone?.replace(/[\s\-().]/g, "").replace(/^\+/, "");
  const waLink = phone ? `https://wa.me/${phone}` : null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(analysis);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-base font-bold text-white">{lead.name}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Perfil para armar mensaje — copiá y pegá en ChatGPT
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Analysis */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="bg-gray-800 rounded-xl p-4">
            <pre className="text-sm text-gray-200 whitespace-pre-wrap font-sans leading-relaxed">
              {analysis}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 flex items-center gap-3">
          <button
            onClick={handleCopy}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              copied
                ? "bg-ceibo-700 text-white"
                : "bg-ceibo-600 hover:bg-ceibo-500 text-white"
            }`}
          >
            {copied ? (
              <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>Copiado</>
            ) : (
              <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copiar perfil</>
            )}
          </button>

          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-gray-800 border border-gray-700 text-ceibo-400 hover:bg-gray-700 transition-colors"
            >
              💬 Abrir WhatsApp
            </a>
          )}

          <button
            onClick={onClose}
            className="ml-auto text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
