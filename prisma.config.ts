import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    // Fallback avoids a hard failure in fresh clones/CI before .env exists (postinstall runs `prisma generate`).
    url: process.env.DATABASE_URL ?? "file:./storage/app.db",
  },
});
