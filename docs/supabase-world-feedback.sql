-- Run in the same Supabase project's SQL Editor as supabase-worlds.sql.
-- Additive migration: existing worlds and their assets are unchanged.
create table if not exists public.evoke_world_feedback (
  world_id uuid not null references public.evoke_worlds(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  happiness smallint not null check (happiness between 1 and 3),
  good_memories smallint not null check (good_memories between 1 and 3),
  visual_memories smallint not null check (visual_memories between 1 and 3),
  music_memories smallint not null check (music_memories between 1 and 3),
  return_interest smallint not null check (return_interest between 1 and 3),
  updated_at timestamptz not null default now(),
  primary key (owner_id, world_id)
);

create index if not exists evoke_world_feedback_world_idx
  on public.evoke_world_feedback(world_id);

alter table public.evoke_world_feedback enable row level security;

drop policy if exists "read own world feedback" on public.evoke_world_feedback;
create policy "read own world feedback" on public.evoke_world_feedback
  for select using (
    auth.uid() = owner_id and exists (
      select 1 from public.evoke_worlds w
      where w.id = world_id and w.owner_id = auth.uid()
    )
  );

drop policy if exists "write own world feedback" on public.evoke_world_feedback;
create policy "write own world feedback" on public.evoke_world_feedback
  for insert with check (
    auth.uid() = owner_id and exists (
      select 1 from public.evoke_worlds w
      where w.id = world_id and w.owner_id = auth.uid() and w.status = 'ready'
    )
  );

drop policy if exists "change own world feedback" on public.evoke_world_feedback;
create policy "change own world feedback" on public.evoke_world_feedback
  for update using (
    auth.uid() = owner_id and exists (
      select 1 from public.evoke_worlds w
      where w.id = world_id and w.owner_id = auth.uid() and w.status = 'ready'
    )
  ) with check (
    auth.uid() = owner_id and exists (
      select 1 from public.evoke_worlds w
      where w.id = world_id and w.owner_id = auth.uid() and w.status = 'ready'
    )
  );
