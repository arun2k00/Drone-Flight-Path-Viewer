import "server-only";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import { getServerConfig } from "@/lib/config/env.server";

const g = globalThis as unknown as { __dtsPrisma?: PrismaClient };

export const prisma: PrismaClient =
  g.__dtsPrisma ?? new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: getServerConfig().DATABASE_URL }) });

g.__dtsPrisma = prisma;
