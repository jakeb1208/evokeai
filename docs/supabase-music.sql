-- Run this migration in the Supabase SQL editor.
-- The bucket is private; the API verifies each user's token before using its
-- server-only service-role key to read or write that user's tracks.

create extension if not exists pgcrypto;

create table if not exists public.evoke_music (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  storage_path text not null unique,
  byte_size bigint not null check (byte_size > 0 and byte_size <= 26214400),
  created_at timestamptz not null default now()
);

create index if not exists evoke_music_owner_created_idx
  on public.evoke_music (owner_id, created_at desc);

alter table public.evoke_music enable row level security;

drop policy if exists "owners can read their Evoke music" on public.evoke_music;
create policy "owners can read their Evoke music"
  on public.evoke_music for select
  using (auth.uid() = owner_id);

drop policy if exists "owners can insert their Evoke music" on public.evoke_music;
create policy "owners can insert their Evoke music"
  on public.evoke_music for insert
  with check (auth.uid() = owner_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evoke-music', 'evoke-music', false, 26214400, array['audio/mpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;