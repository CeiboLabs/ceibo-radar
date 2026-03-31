import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // playwright still needs to be external (used locally for scraping)
  serverExternalPackages: ["playwright"],
};

export default nextConfig;
