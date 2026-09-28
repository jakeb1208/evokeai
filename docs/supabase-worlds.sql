-- Run this migration in the Supabase SQL editor.
-- Create the private `world-assets` bucket separately in Storage if it does not exist.

create extension if not exists pgcrypto;

create table if not exists public.evoke_worlds (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  operation_id text unique,
  marble_world_id text unique,
  status text not null default 'generating'
    check (status in ('generating', 'ready', 'failed')),
  display_name text not null,
  model text not null,
  world_prompt jsonb,
  -- Complete Marble response for future Unity / Meta Quest clients.
  marble_world jsonb,
  -- Array of { kind, format, quality, storage_path, content_type, byte_size } objects.
  assets jsonb not null default '[]'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists evoke_worlds_owner_created_idx
  on public.evoke_worlds (owner_id, created_at desc);

alter table public.evoke_worlds enable row level security;

drop policy if exists "owners can read their Evoke worlds" on public.evoke_worlds;
create policy "owners can read their Evoke worlds"
  on public.evoke_worlds for select
  using (auth.uid() = owner_id);

drop policy if exists "owners can insert their Evoke worlds" on public.evoke_worlds;
create policy "owners can insert their Evoke worlds"
  on public.evoke_worlds for insert
  with check (auth.uid() = owner_id);

drop policy if exists "owners can update their Evoke worlds" on public.evoke_worlds;
create policy "owners can update their Evoke worlds"
  on public.evoke_worlds for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "owners can delete their Evoke worlds" on public.evoke_worlds;
create policy "owners can delete their Evoke worlds"
  on public.evoke_worlds for delete
  using (auth.uid() = owner_id);

-- Storage paths are always `{auth.uid()}/{marble_world_id}/{file}`.
-- Keep the bucket private and let Railway issue short-lived signed URLs.
insert into storage.buckets (id, name, public)
values ('world-assets', 'world-assets', false)
on conflict (id) do update set public = false;

drop policy if exists "owners can read Evoke world assets" on storage.objects;
create policy "owners can read Evoke world assets"
  on storage.objects for select
  using (
    bucket_id = 'world-assets'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "owners can delete Evoke world assets" on storage.objects;
create policy "owners can delete Evoke world assets"
  on storage.objects for delete
  using (
    bucket_id = 'world-assets'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create or replace function public.set_evoke_world_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_evoke_world_updated_at on public.evoke_worlds;
create trigger set_evoke_world_updated_at
before update on public.evoke_worlds
for each row execute function public.set_evoke_world_updated_at();