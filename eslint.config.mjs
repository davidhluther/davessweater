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
    ".vercel/**",
    "next-env.d.ts",
    // Agent worktrees are full checkouts of this repo; linting them double-reports
    // every file and buries real findings (13,925 problems on 2026-07-27).
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
