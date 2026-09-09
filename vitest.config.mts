import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * These tests cover the pure layer only, so there is no database setup, no
 * test containers, and no fixtures to reset. That is the payoff for keeping
 * `lib/measurement` and `lib/analysis` free of I/O: the suite runs in
 * milliseconds and every failure points at arithmetic rather than at plumbing.
 *
 * The `.mts` extension makes Vite load this as a real ES module, which avoids
 * a deprecation warning about ESM syntax in a CommonJS-loaded config.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
