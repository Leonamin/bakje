import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "playwright"],
  experimental: {
    // Back/forward and revisits reuse the rendered library for 30s instead of refetching it, which is what made the list flash.
    staleTimes: { dynamic: 30 },
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
