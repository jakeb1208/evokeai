---
name: Windows desktop packaging
description: Why the Windows installer package is separate from the hosted pnpm workspace
---

Keep desktop installer dependencies isolated from the pnpm workspace used by Railway. The desktop shell opens the hosted Evoke origin, rather than bundling a second API or embedding service credentials.

**Why:** Electron's large native downloads and packaging tools do not belong in Railway's web/API install and build path; keeping one hosted backend also preserves the existing account, saved-world, and server-only Marble credential boundaries.

**How to apply:** When changing desktop packaging, keep its installer build independent of the Railway root build. Update the trusted hosted origin if the deployment moves, and never add Marble or Supabase service-role credentials to the desktop package.