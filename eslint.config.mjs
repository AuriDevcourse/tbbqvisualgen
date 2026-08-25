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
    // Build output anywhere, not just at the repo root. `.next/**` is anchored,
    // so a build inside a git worktree (`.claude/worktrees/*/.next/`) slipped
    // past it and eslint linted Next's own generated bundles: 462 errors, none
    // of them from code anyone wrote. That buried the 5 real errors in `src/`
    // and made `npm run lint` useless as a signal — this doc claimed 2 for long
    // enough that 3 more arrived unnoticed.
    "**/.next/**",
    // Agent scratch space: worktrees, caches, transcripts. Never source.
    ".claude/**",
  ]),
]);

export default eslintConfig;
