-- Migration 008: create client_requests table and migrate clients.concern
--
-- client_requests stores the history of a client's therapeutic requests.
-- Each client has at most one is_current=true record (enforced by partial unique index).
--
-- clients.concern is NOT touched — it remains as a legacy read-only field
-- until a separate verified step decides what to do with it.

-- ── 1. Create table ───────────────────────────────────────────────────────────

create table if not exists public.client_requests (
  id                     uuid        primary key default gen_random_uuid(),
  client_id              uuid        not null    references public.clients(id) on delete cascade,
  text                   text        not null,
  is_current             boolean     not null    default false,
  source                 text        not null    check (source in ('initial', 'edit', 'new_request')),
  origin_consultation_id uuid                    references public.consultations(id) on delete set null,
  comment                text,
  previous_text          text,
  created_at             timestamptz not null    default now(),
  updated_at             timestamptz,
  deleted_at             timestamptz
);

-- ── 2. Indexes ────────────────────────────────────────────────────────────────

-- Fast lookup by client
create index if not exists client_requests_client_id_idx
  on public.client_requests (client_id)
  where deleted_at is null;

-- Chronological history per client
create index if not exists client_requests_client_id_created_at_idx
  on public.client_requests (client_id, created_at desc)
  where deleted_at is null;

-- Enforce: at most one current request per client
-- This fires at DB level — prevents race conditions from app layer.
create unique index if not exists client_requests_one_current_per_client_idx
  on public.client_requests (client_id)
  where is_current = true and deleted_at is null;

-- ── 3. RLS ────────────────────────────────────────────────────────────────────

alter table public.client_requests enable row level security;

-- Permissive policy for single-user mode (same pattern as other tables).
-- Tighten to user_id = auth.uid() when multi-tenant is implemented (v3).
create policy "allow all for now" on public.client_requests
  for all using (true) with check (true);

-- ── 4. Migrate clients.concern → client_requests ──────────────────────────────
--
-- Only for clients:
--   • with non-null, non-empty concern
--   • that are not soft-deleted
--   • that do NOT already have a current request (idempotent re-run safety)
--
-- clients.concern is intentionally NOT modified.

insert into public.client_requests (client_id, text, is_current, source, created_at)
select
  c.id                                                  as client_id,
  trim(c.concern)                                       as text,
  true                                                  as is_current,
  'initial'                                             as source,
  coalesce(c.created_at, now())                         as created_at
from public.clients c
where
  c.concern    is not null
  and trim(c.concern) != ''
  and c.deleted_at     is null
  -- idempotent: skip if this client already has a current request
  and not exists (
    select 1
    from   public.client_requests cr
    where  cr.client_id  = c.id
    and    cr.is_current = true
    and    cr.deleted_at is null
  );

-- ── 5. Verification queries (run manually after migration) ────────────────────
--
-- 5a. How many clients have a non-empty concern:
--     select count(*) from public.clients where concern is not null and trim(concern) != '' and deleted_at is null;
--
-- 5b. How many client_requests were created:
--     select count(*) from public.client_requests where source = 'initial';
--
-- 5c. Counts should match (clients with concern = initial requests):
--     select
--       (select count(*) from public.clients where concern is not null and trim(concern) != '' and deleted_at is null) as clients_with_concern,
--       (select count(*) from public.client_requests where source = 'initial')                                         as initial_requests,
--       (select count(*) from public.clients where concern is not null and trim(concern) != '' and deleted_at is null)
--         = (select count(*) from public.client_requests where source = 'initial')                                     as counts_match;
--
-- 5d. No client should have two is_current=true (unique index prevents this, but verify):
--     select client_id, count(*) from public.client_requests
--     where is_current = true and deleted_at is null
--     group by client_id having count(*) > 1;
--     -- should return 0 rows
--
-- 5e. No empty text:
--     select count(*) from public.client_requests where trim(text) = '' or text is null;
--     -- should return 0
--
-- 5f. Confirm clients.concern is untouched (spot-check):
--     select id, name, concern from public.clients where concern is not null limit 5;
