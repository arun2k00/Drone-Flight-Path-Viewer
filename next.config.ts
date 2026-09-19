import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native addons must not be bundled by Turbopack (Prisma client and better-sqlite3 are already on Next's built-in list).
  serverExternalPackages: ["@napi-rs/canvas", "@resvg/resvg-js", "@prisma/adapter-better-sqlite3", "better-sqlite3"],
  poweredByHeader: false,
};

export default nextConfig;
