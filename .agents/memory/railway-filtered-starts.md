---
name: Railway filtered starts
description: Runtime working-directory behavior for pnpm-filtered production services
---

Production commands launched through `pnpm --filter <workspace> run start` execute with the filtered package as the working directory, not the monorepo root.

**Why:** Relative paths based on `process.cwd()` can point inside the package and fail to find assets built in a sibling workspace, causing the deployed API to return `Cannot GET /` even when the frontend build succeeded.

**How to apply:** Resolve shared production assets from the compiled server module location or pass an explicit absolute asset directory through `WEB_DIST_DIR`; verify both `/` and the health endpoint with the exact production start command.