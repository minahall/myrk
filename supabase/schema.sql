-- MYRK schema v2 (Session 4)
-- Paste this into the Supabase SQL editor and run.
-- Safe to re-run. tips and replies are dropped+recreated (ciphertext shape
-- changed from bytea triplets to a single jsonb `packet`). nodes and
-- journalists keep their rows.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------
-- Node + journalist directories (idempotent — keep any existing rows)
-- ---------------------------------------------------------------

create table if not exists nodes (
  id          text         primary key,         -- 'a', 'b', 'c'
  public_key  jsonb        not null,            -- JWK (RSA-OAEP public)
  status      text         not null default 'active',
  created_at  timestamptz  not null default now()
);

create table if not exists journalists (
  id          uuid         primary key default gen_random_uuid(),
  name        text         not null,
  public_key  jsonb        not null,            -- JWK (RSA-OAEP public)
  created_at  timestamptz  not null default now()
);

-- ---------------------------------------------------------------
-- Tips + replies (jsonb packet)
-- ---------------------------------------------------------------

drop table if exists tips cascade;
drop table if exists replies cascade;

-- Sealed-for-journalist HybridPacket: { wk, iv, ct }.
create table tips (
  id          uuid         primary key default gen_random_uuid(),
  packet      jsonb        not null,
  created_at  timestamptz  not null default now(),
  read_at     timestamptz
);

-- Reply from journalist to source. Packet is AES-GCM only ({ iv, ct });
-- the AES key is derived from the codename, not RSA-wrapped.
create table replies (
  id          uuid         primary key default gen_random_uuid(),
  mailbox_id  text         not null,
  packet      jsonb        not null,
  created_at  timestamptz  not null default now()
);
create index if not exists replies_mailbox_idx on replies (mailbox_id);

-- ---------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------

alter table nodes       enable row level security;
alter table journalists enable row level security;
alter table tips        enable row level security;
alter table replies     enable row level security;

drop policy if exists nodes_read on nodes;
create policy nodes_read on nodes
  for select to anon, authenticated using (true);

drop policy if exists journalists_read on journalists;
create policy journalists_read on journalists
  for select to anon, authenticated using (true);

-- Tips: anon cannot select or insert.
--   Node C inserts with the service_role key (bypasses RLS).
--   Authenticated journalist can select and mark read.
drop policy if exists tips_select_auth on tips;
create policy tips_select_auth on tips
  for select to authenticated using (true);
drop policy if exists tips_update_auth on tips;
create policy tips_update_auth on tips
  for update to authenticated using (true) with check (true);

-- Replies: anon selects by mailbox_id (the hash is the capability).
--   Authenticated journalist inserts.
drop policy if exists replies_select_anon on replies;
create policy replies_select_anon on replies
  for select to anon, authenticated using (true);
drop policy if exists replies_insert_auth on replies;
create policy replies_insert_auth on replies
  for insert to authenticated with check (true);
