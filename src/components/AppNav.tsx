"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/feed",          label: "🆕 Feed"           },
  { href: "/opportunities", label: "🔥 Oportunidades"  },
  { href: "/",              label: "Leads"             },
  { href: "/campaigns",     label: "Campañas"          },
  { href: "/dashboard",     label: "Dashboard"         },
  { href: "/jobs",          label: "Jobs"              },
];

export function AppNav() {
  const path = usePathname();

  return (
    <header className="border-b border-gray-800 bg-gray-900/60 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0 hover:opacity-90 transition-opacity">
          <Image
            src="/android-chrome-192x192.png"
            alt="Ceibo Labs"
            width={36}
            height={36}
            className="rounded-xl"
          />
          <div>
            <span className="font-bold text-white text-base tracking-tight">Ceibo</span>
            <span className="font-bold text-ceibo-500 text-base tracking-tight"> Radar</span>
          </div>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map(({ href, label }) => {
            const active = href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-gray-800 text-white border border-gray-700"
                    : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 border border-transparent"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto text-xs text-gray-700 font-mono">v0.7.0</div>
      </div>
    </header>
  );
}
