# Supabase + Railway + Unity setup

The web app uses Supabase Auth and keeps completed Marble worlds in Supabase as the permanent source of truth. The SQL migration in `docs/supabase-worlds.sql` creates the world table, ownership policies, and private storage bucket used by Railway.

## 1. Create the Supabase project

1. Create a Supabase project and choose a strong database password.
2. In **Authentication → Providers**, enable Email and keep **Confirm email** enabled. The app requires the emailed confirmation code before allowing a new account into the product.
3. In **Authentication → URL Configuration**, add:
   - The Railway public URL as the **Site URL**.
   - The Railway URL plus `/auth/callback` as an allowed redirect URL if the app uses a server callback.
4. Run `docs/supabase-worlds.sql` in the Supabase SQL editor. It creates a private `world-assets` bucket and the `evoke_worlds` table.
5. Keep the bucket private. World files are delivered to the web viewer and Unity/Meta Quest clients with short-lived signed URLs.

## 2. Add the Railway variables

In the Railway service that runs this repository, open **Variables** and add:

| Variable | Railway setting | Purpose |
| --- | --- | --- |
| `MARBLE_API_KEY` | Secret | World Labs key used only by the API server |
| `SUPABASE_URL` | Variable | Supabase project URL |
| `SUPABASE_ANON_KEY` | Variable | Browser-safe Supabase key |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | Server-only admin operations and signed URLs |
| `SUPABASE_STORAGE_BUCKET` | Variable | Set to `world-assets` |

Do not put `MARBLE_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` in the frontend, in a `VITE_` variable, or in source control. The current Marble proxy expects the secret to be named exactly `MARBLE_API_KEY` and sends it upstream as the `WLT-Api-Key` header.

The current `railway.json` uses one Railway service:

1. Railway runs `pnpm run railway:build`.
2. Railway runs `pnpm start`.
3. The API server serves the built web app and `/api/*` routes.
4. Railway checks `/api/healthz`.

After adding `MARBLE_API_KEY`, redeploy and open `/api/healthz`. A successful health response only confirms the process is running; the Edit / Create page confirms Marble credentials when it starts a generation.

## 3. Auth boundary

Use Supabase Auth in the browser with the anon key, then send the Supabase access token to the Railway API as:

```http
Authorization: Bearer <supabase-access-token>
```

The Railway API verifies the token with Supabase before it:

- starts a Marble operation,
- reads or changes a world owned by the user,
- creates a storage signed URL,
- records a world or asset in the database.

The service-role key bypasses Row Level Security and must never be used in browser code. The API uses it only after verifying the user's bearer token, to download Marble assets into the private bucket and issue signed URLs.

## 4. Storage model for worlds

Use Supabase Storage for the bytes and Postgres metadata for ownership and search. The canonical implementation table is `evoke_worlds`; its `marble_world` column preserves the complete Marble world response and its `assets` column contains the durable storage paths used by both web and Unity:

```sql
-- See docs/supabase-worlds.sql for the complete migration.
```

Use storage paths such as `{user_id}/{world_id}/splats-full_res.spz`. The API downloads Marble's generated SPZ, collider mesh, panorama, and thumbnail into those paths before marking the world ready. For downloads, it returns a short-lived signed URL; do not use a permanent public URL in Unity.

## 5. Unity handoff

The future Unity client should not contain `SUPABASE_SERVICE_ROLE_KEY` or `MARBLE_API_KEY`. A safe flow is:

1. Unity signs in with Supabase Auth and stores the user access/refresh session using a platform-safe secure store.
2. Unity calls the Railway API with the access token.
3. Railway verifies the token and returns the same `evoke_worlds` world metadata plus short-lived signed asset URLs.
4. Unity downloads the SPZ or collider GLB and caches it locally.
5. When the signed URL expires, Unity asks Railway for a new one.

For Marble’s native Gaussian-splat exports, World Labs currently documents Unity 6.0 with URP, HDR enabled, Vulkan, and Multi-view rendering for VR. Marble’s documented Unity path is based on SPZ/PLY Gaussian splats; GLB storage is still useful for user-authored models and future scene assets. Treat the asset format as a per-world metadata field rather than assuming every world is a GLB.

## Recommended next implementation step

The server-side generation and persistence flow is implemented. Run the SQL migration, set the Railway variables, and redeploy. The browser only calls `/api/marble/worlds` to start a generation, `/api/worlds/operations/:operationId` for Evoke-owned status, and `/api/worlds/:id` to open the saved world.