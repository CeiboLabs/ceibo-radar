"use client";

import { useEffect, useState } from "react";
import { subscribeToasts } from "@/lib/toast";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

const ICONS = {
  success: (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  info: (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

const STYLES = {
  success: "bg-gray-900 border-ceibo-700 text-ceibo-300",
  error: "bg-gray-900 border-red-700 text-red-300",
  info: "bg-gray-900 border-gray-600 text-gray-300",
};

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => subscribeToasts(setToasts), []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-2xl text-sm font-medium min-w-[220px] max-w-sm animate-in ${STYLES[t.type]}`}
        >
          {ICONS[t.type]}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
