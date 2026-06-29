-- Notebook v2: metadata, client link, soft delete, and pagination indexes.
alter table public.notebook
  add column if not exists title text not null default '',
  add column if not exists client_id uuid references public.clients(id) on delete set null,
  add column if not exists topic text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz default null;

update public.notebook
set updated_at = created_at
where updated_at is null;

drop trigger if exists notebook_updated_at on public.notebook;
create trigger notebook_updated_at
  before update on public.notebook
  for each row execute function public.set_updated_at();

create index if not exists notebook_deleted_at_idx on public.notebook (deleted_at)
  where deleted_at is null;
create index if not exists notebook_created_at_active_idx on public.notebook (created_at desc)
  where deleted_at is null;
create index if not exists notebook_updated_at_active_idx on public.notebook (updated_at desc)
  where deleted_at is null;
create index if not exists notebook_client_id_idx on public.notebook (client_id)
  where deleted_at is null;
create index if not exists notebook_topic_idx on public.notebook (topic)
  where deleted_at is null;
create index if not exists notebook_tags_gin_idx on public.notebook using gin (tags);
