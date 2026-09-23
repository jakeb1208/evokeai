# Supabase + Railway + Unity setup

This project currently keeps its login screen as a visual demo. The steps below are the recommended production setup for Supabase Auth, GLB storage, Railway, and a future Unity client.

## 1. Create the Supabase project

1. Create a Supabase project and choose a strong database password.
2. In **Authentication → Providers**, enable Email and keep **Confirm email** enabled. The app requires the emailed confirmation code before allowing a new account into the product.
3. In **Authentication → URL Configuration**, add:
   - The Railway public URL as the **Site URL**.
   - The Railway URL plus `/auth/callback` as an allowed redirect URL if the app uses a server callback.
4. In **Storage**, create a private bucket named `world-assets`.
5. Keep the bucket private. World files should be delivered with short-lived signed URLs rather than public URLs.

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

The Railway API should verify the token with Supabase before it:

- starts a Marble operation,
- reads or changes a world owned by the user,
- creates a storage signed URL,
- records a world or asset in the database.

The service-role key bypasses Row Level Security and must never be used in browser code. Add the auth middleware before making Marble operations user-owned. The current Marble route is intentionally a server-side integration scaffold and does not claim to be user-authenticated yet.

## 4. Storage model for GLB files

Use Supabase Storage for the bytes and Postgres metadata for ownership and search. A useful first table is:

```sql
create table public.world_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  world_id text,
  storage_path text not null unique,
  file_name text not null,
  content_type text not null default 'model/gltf-binary',
  byte_size bigint not null,
  created_at timestamptz not null default now()
);

alter table public.world_assets enable row level security;

create policy "owners can read their world assets"
on public.world_assets for select
using (auth.uid() = owner_id);

create policy "owners can insert their world assets"
on public.world_assets for insert
with check (auth.uid() = owner_id);

create policy "owners can delete their world assets"
on public.world_assets for delete
using (auth.uid() = owner_id);
```

Use storage paths such as `{user_id}/{world_id}/{asset_id}.glb`. Enforce the same ownership rule in Storage policies. The API should check the authenticated user, create a signed upload URL, and then insert metadata after the upload succeeds. For downloads, return a short-lived signed URL; do not store a permanent public URL in Unity.

## 5. Unity handoff

The future Unity client should not contain `SUPABASE_SERVICE_ROLE_KEY` or `MARBLE_API_KEY`. A safe flow is:

1. Unity signs in with Supabase Auth and stores the user access/refresh session using a platform-safe secure store.
2. Unity calls the Railway API with the access token.
3. Railway verifies the token and returns the user’s world metadata plus a short-lived signed GLB URL.
4. Unity downloads the GLB and caches it locally.
5. When the signed URL expires, Unity asks Railway for a new one.

For Marble’s native Gaussian-splat exports, World Labs currently documents Unity 6.0 with URP, HDR enabled, Vulkan, and Multi-view rendering for VR. Marble’s documented Unity path is based on SPZ/PLY Gaussian splats; GLB storage is still useful for user-authored models and future scene assets. Treat the asset format as a per-world metadata field rather than assuming every world is a GLB.

## Recommended next implementation step

Add Supabase client initialization and an Express bearer-token middleware, then replace the demo login with email/password or magic-link auth. After that, add signed upload/download endpoints for `world-assets` and attach `owner_id` to Marble operations and world metadata.