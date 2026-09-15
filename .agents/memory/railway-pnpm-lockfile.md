---
name: Railway pnpm lockfile compatibility
description: Railway's frozen install uses pnpm 9 and requires the lockfile to be regenerated with that same major version.
---

Generate the workspace lockfile with pnpm 9.15.9 when preparing this project for Railway, and keep the root package manager pinned to that version.

**Why:** A lockfile accepted by the local pnpm 10 toolchain can still fail Railway's frozen install with an overrides configuration mismatch.

**How to apply:** Before deploying to Railway, run the pnpm 9 frozen-install check and commit the resulting pnpm-lock.yaml.