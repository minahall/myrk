-- MYRK schema v1
-- Paste this into the Supabase SQL editor, then run.
-- Idempotent: safe to re-run.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------

-- Public directory of relay node public keys.
create table if not exists nodes (
  id          text         primary key,         -- 'a', 'b', 'c'
  public_key  jsonb        not null,            -- JWK (RSA-OAEP public)
  status      text         not null default 'active',
  created_at  timestamptz  not null default now()
);

-- Public directory of journalist public keys. v1: one row.
create table if not exists journalists (
  id          uuid         primary key default gen_random_uuid(),
  name        text         not null,
  public_key  jsonb        not null,            -- JWK (RSA-OAEP public)
  created_at  timestamptz  not null default now()
);

-- Encrypted tip dropbox. Payload is AES-GCM; AES key is RSA-OAEP-wrapped
-- to the journalist's public key by the source's browser.
create table if not exists tips (
  id           uuid         primary key default gen_random_uuid(),
  ciphertext   bytea        not null,
  wrapped_key  bytea        not null,
  iv           bytea        not null,
  created_at   timestamptz  not null default now(),
  read_at      timestamptz
);

-- Reply mailbox. mailbox_id is a hash of the codename (PBKDF2 / Argon2).
-- The AES key for ciphertext is derived from the same codename.
create table if not exists replies (
  id           uuid         primary key default gen_random_uuid(),
  mailbox_id   text         not null,
  ciphertext   bytea        not null,
  iv           bytea        not null,
  created_at   timestamptz  not null default now()
);
create index if not exists replies_mailbox_idx on replies (mailbox_id);

-- ---------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------

alter table nodes       enable row level security;
alter table journalists enable row level security;
alter table tips        enable row level security;
alter table replies     enable row level security;

-- Nodes: public read of the directory (public keys only).
drop policy if exists nodes_read on nodes;
create policy nodes_read on nodes
  for select to anon, authenticated using (true);

-- Journalists: public read of the directory.
drop policy if exists journalists_read on journalists;
create policy journalists_read on journalists
  for select to anon, authenticated using (true);

-- Tips:
--   - anon cannot select or insert.
--   - Node C inserts using the service_role key, which bypasses RLS.
--   - Authenticated journalist can select and mark read.
drop policy if exists tips_select_auth on tips;
create policy tips_select_auth on tips
  for select to authenticated using (true);
drop policy if exists tips_update_auth on tips;
create policy tips_update_auth on tips
  for update to authenticated using (true) with check (true);

-- Replies:
--   - anon can select by mailbox_id (the hash is the capability).
--   - Authenticated journalist can insert.
drop policy if exists replies_select_anon on replies;
create policy replies_select_anon on replies
  for select to anon, authenticated using (true);
drop policy if exists replies_insert_auth on replies;
create policy replies_insert_auth on replies
  for insert to authenticated with check (true);

-- ---------------------------------------------------------------
-- Bootstrap note
-- ---------------------------------------------------------------
-- The `nodes` and `journalists` tables are populated by a one-time admin
-- script after keys are generated in Session 2 / Session 5. Do NOT seed
-- them here, since we need real JWK material.
