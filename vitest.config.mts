import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    testTimeout: 10_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "src/lib/telemetry/**",
        "src/lib/map/**",
        "src/lib/overlay/**",
        "src/lib/video/**",
      ],
      exclude: [
        "src/lib/overlay/render/**",
        "src/lib/overlay/assets.server.ts",
        "src/lib/overlay/assets.browser.ts",
        "src/lib/map/basemap.server.ts",
        "src/lib/telemetry/persistence.server.ts",
        "src/lib/video/file-response.server.ts",
        "src/lib/video/frame-grab.server.ts",
        "src/lib/video/frame-writer.server.ts",
        "src/lib/video/probe.server.ts",
        "src/lib/video/process.server.ts",
        "**/*.d.ts",
      ],
    },
  },
});
