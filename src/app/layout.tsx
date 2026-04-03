import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { AppSidebar } from "@/components/AppSidebar";

export const metadata: Metadata = {
  title: "Ceibo Radar",
  description: "Sales intelligence platform by Ceibo Labs",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-black text-gray-100 min-h-screen antialiased">
        <AppSidebar />
        <div className="ml-[220px] min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
