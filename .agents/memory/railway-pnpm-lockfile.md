---
name: Railway pnpm lockfile compatibility
description: Railway's frozen install uses pnpm 9 and requires the lockfile to be regenerated with that same major version.
---

Generate the workspace lockfile with pnpm 9.15.9 when preparing this project for Railway. Keep the lockfile compatible with Railway's pnpm version without pinning the root package manager in package.json, because Replit's managed workflows may repeatedly bootstrap that version.

**Why:** A lockfile accepted by the local pnpm 10 toolchain can still fail Railway's frozen install with an overrides configuration mismatch, while a package-manager pin can make Replit's managed workflows loop during startup.

**How to apply:** Before deploying to Railway, run the pnpm 9 frozen-install check and commit the resulting pnpm-lock.yaml. Leave package.json free of a packageManager pin unless the workspace runtime explicitly supports it.