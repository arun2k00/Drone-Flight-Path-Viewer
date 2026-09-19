import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Shared (isomorphic) modules: no Node built-ins, no server/browser-only modules, no React/Next (02-architecture.md §2).
const SHARED_FILES = [
  "src/types/**/*.ts",
  "src/lib/ids.ts",
  "src/lib/env-read.ts",
  "src/lib/errors/codes.ts",
  "src/lib/errors/app-error.ts",
  "src/lib/format/**/*.ts",
  "src/lib/storage/keys.ts",
  "src/lib/storage/provider.ts",
  "src/lib/uploads/validation.ts",
  "src/lib/uploads/magic.ts",
  "src/lib/telemetry/**/*.ts",
  "src/lib/map/geojson.ts",
  "src/lib/map/simplify.ts",
  "src/lib/map/projection.ts",
  "src/lib/overlay/**/*.ts",
  "src/lib/video/range.ts",
  "src/lib/video/probe-parse.ts",
  "src/lib/video/output-size.ts",
  "src/lib/video/encoder-presets.ts",
  "src/lib/video/export-args.ts",
  "src/lib/video/progress-parser.ts",
];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: SHARED_FILES,
    ignores: ["**/*.server.ts", "**/*.browser.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { group: ["node:*", "fs", "fs/*", "path", "os", "child_process", "stream", "stream/*", "crypto"], message: "Shared modules must not import Node built-ins. Move this code to a *.server.ts module." },
          { group: ["server-only", "**/*.server", "**/*.browser", "@/lib/db.server"], message: "Shared modules must not import server-only or browser-only modules." },
          { group: ["react", "react-dom", "next", "next/*", "zustand"], message: "Shared modules must stay framework-free." },
        ],
      }],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "src/generated/**", "storage/**", "docs/**", "tests/fixtures/**", "coverage/**"]),
]);
