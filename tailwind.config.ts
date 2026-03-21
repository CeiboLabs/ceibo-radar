import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Ceibo Labs green palette — deep, saturated, professional
        ceibo: {
          50:  "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
          950: "#052e16",
        },
      },
      boxShadow: {
        "glow-green": "0 0 20px rgba(22, 163, 74, 0.15)",
        "glow-red":   "0 0 20px rgba(220, 38, 38, 0.1)",
      },
    },
  },
  plugins: [],
};

export default config;
