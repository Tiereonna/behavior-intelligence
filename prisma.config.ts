import "dotenv/config";
import path from "node:path";
import { defineConfig, env } from "prisma/config";

/**
 * Prisma 7 configuration.
 *
 * Two things changed in Prisma 7 that are easy to trip over:
 *
 * 1. Prisma no longer reads `.env` automatically. The `dotenv/config` import
 *    above is what populates `process.env` for `prisma migrate`, `db seed`,
 *    and `studio`. Next.js loads `.env` on its own, so the running app does
 *    not depend on this file.
 * 2. Seed configuration moved here from the `prisma` key in package.json.
 */
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),

  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },

  datasource: {
    url: env("DATABASE_URL"),
  },
});
