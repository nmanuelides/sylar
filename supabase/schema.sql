-- Sylar Watchface Studio — Supabase schema
-- Run this in the Supabase SQL editor.

create table if not exists public.watchfaces (
  id uuid primary key,
  user_id uuid references auth.users (id) on delete cascade,
  name text not null default 'Untitled watchface',
  device_id text not null,
  data jsonb not null,
  thumbnail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists watchfaces_user_id_idx on public.watchfaces (user_id);
create index if not exists watchfaces_updated_at_idx on public.watchfaces (updated_at desc);

alter table public.watchfaces enable row level security;

-- Demo policies (no auth yet): anyone with the anon key can read/write.
-- Tighten these once authentication is added, e.g.
--   using (auth.uid() = user_id)
create policy "watchfaces_select" on public.watchfaces
  for select using (true);
create policy "watchfaces_insert" on public.watchfaces
  for insert with check (true);
create policy "watchfaces_update" on public.watchfaces
  for update using (true);
create policy "watchfaces_delete" on public.watchfaces
  for delete using (true);

-- Optional: storage bucket for uploaded assets (images).
-- insert into storage.buckets (id, name, public) values ('watchface-assets', 'watchface-assets', true);
