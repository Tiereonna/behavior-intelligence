import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * The single PrismaClient instance for the whole application.
 *
 * Two things are going on here.
 *
 * The `globalThis` cache exists because Next.js hot reload re-evaluates
 * modules on every file save. Without the cache, each save constructs a new
 * PrismaClient with a new connection pool, and after a few dozen saves
 * Postgres refuses new connections with an error that looks nothing like the
 * thing that caused it. In production, modules are evaluated once, so the
 * cache is skipped.
 *
 * The driver adapter is new in Prisma 7: the connection string is passed to
 * the client at construction rather than read from the schema file.
 */

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    // Failing loudly here beats a confusing connection error several layers
    // deeper, and makes a missing `.env` immediately obvious on a fresh clone.
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and fill it in.",
    );
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
