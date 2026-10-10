import { existsSync } from "node:fs";
import type { NextConfig } from "next";

// One .env at the repo root (API_URL, ADMIN_TOKEN). Read on the server only; nothing here is NEXT_PUBLIC.
if (existsSync("../../.env")) process.loadEnvFile("../../.env");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
