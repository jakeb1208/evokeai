# Evoke AI

Evoke AI is a web experience for creating, revising, and eventually exploring AI-generated worlds.

## Run & Operate

- `pnpm --filter @workspace/evoai run dev` — run the web preview
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm start` — serve the production web build and API from one process
- Marble requires `MARBLE_API_KEY` as a server-only environment secret. The frontend calls `/api/marble/*`; it never receives the key.
- Railway uses `railway.json`, builds the workspace, serves the web app through the API process, and health-checks `/api/healthz`.
- Supabase Auth powers email/password accounts. Enable the Email provider with **Confirm email** required; the app does not allow an unverified signup session into the product.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- Frontend: React + Vite
- World generation: World Labs Marble World API
- Build: Vite + esbuild

## Where things live

- `artifacts/evoai/src/App.tsx` — web routes and the Edit / Create experience
- `artifacts/evoai/src/index.css` — visual system and page layout
- `artifacts/api-server/src/routes/marble.ts` — server-only Marble proxy
- `artifacts/api-server/src/routes/health.ts` — health endpoint
- `railway.json` — Railway build, start, and health-check configuration

## Architecture decisions

- Marble API credentials stay in the API process; do not use a `VITE_` prefix for the key.
- Marble generation is asynchronous, so the Edit / Create page submits an operation and polls its status.
- Marble’s public API is generation-based. “Edit” creates a new revision using the prior prompt plus the requested changes; it does not mutate the original world.

## Product

- Users can enter the Edit / Create workspace from the home screen.
- Create accepts text and reference images.
- Edit accepts a Marble world ID, revision instructions, and optional reference images.

## User preferences

- Keep the existing monorepo structure and add service boundaries rather than migrating the stack.

## Gotchas

- Keep the Railway lockfile compatible with pnpm 9.15.9; see `.agents/memory/railway-pnpm-lockfile.md`.
- Marble image payloads are sent inline and are limited to eight images at 7.5 MB each in the web UI.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See `docs/supabase-railway-unity.md` for the planned Supabase auth, GLB storage, and Unity handoff.
