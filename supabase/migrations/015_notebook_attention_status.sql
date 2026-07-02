-- Notebook attention status.
--
-- Forward:
-- Adds a lightweight visual status for notebook entries.
-- Existing notes receive "none" and keep their current appearance.
alter table public.notebook
  add column if not exists deleted_at timestamptz default null;

alter table public.notebook
  add column if not exists attention_status text not null default 'none';

alter table public.notebook
  drop constraint if exists notebook_attention_status_check;

alter table public.notebook
  add constraint notebook_attention_status_check
  check (attention_status in ('none', 'later', 'important', 'urgent', 'done'));

create index if not exists notebook_attention_status_active_idx
  on public.notebook (attention_status)
  where deleted_at is null;

-- Rollback, if needed:
-- drop index if exists public.notebook_attention_status_active_idx;
-- alter table public.notebook drop constraint if exists notebook_attention_status_check;
-- alter table public.notebook drop column if exists attention_status;
--
-- Manual Supabase run:
-- 1. Open Supabase Dashboard -> SQL Editor.
-- 2. Paste this migration SQL.
-- 3. Run it once.
-- 4. Verify:
--    select attention_status, count(*) from public.notebook group by attention_status;
--
-- Risk notes:
-- - The column is non-null with a default, so old rows are safe.
-- - The check constraint rejects unsupported status values.
-- - No existing note text, tags, topics, clients, or dates are changed.
