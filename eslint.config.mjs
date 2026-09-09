import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Prisma's generated client is a build artifact, not source we lint.
    "src/generated/**",
  ]),
  {
    // Architectural boundary, not a style preference.
    //
    // `lib/measurement` and `lib/analysis` are the pure layers: plain data in,
    // plain data out, no I/O and no framework. That is what lets them be unit
    // tested without a database and, later, lets the analysis layer be moved
    // behind an HTTP call to a Python service without touching its callers.
    //
    // Boundaries like this erode one "just this once" import at a time, so it
    // is enforced by the linter rather than by discipline.
    files: ["src/lib/measurement/**/*.ts", "src/lib/analysis/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@prisma/client",
              message:
                "Pure layer: accept plain data as arguments instead of querying the database.",
            },
            {
              name: "next",
              message: "Pure layer: must not depend on the web framework.",
            },
            {
              name: "react",
              message: "Pure layer: must not depend on the UI framework.",
            },
          ],
          patterns: [
            {
              group: ["@/lib/db", "@/server/*", "next/*", "@/generated/*"],
              message:
                "Pure layer: no database, server, or framework dependencies allowed here.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
