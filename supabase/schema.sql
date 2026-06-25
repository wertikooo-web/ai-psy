-- ============================================================
-- TRANSCRIPT AI · PSY — Supabase schema
-- Run each section in Supabase SQL Editor if adding incrementally,
-- or run the whole file at once for a fresh setup.
-- ============================================================

-- ── Shared trigger: auto-update updated_at ────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ── clients ───────────────────────────────────────────────────────────────────
create table if not exists public.clients (
  id                uuid        primary key default gen_random_uuid(),
  created_at        timestamptz not null    default now(),
  updated_at        timestamptz not null    default now(),
  deleted_at        timestamptz             default null,

  full_name         text        not null,
  first_name        text,
  last_name         text,
  initials          text,
  color             text        default '#6088ff',
  age               int,

  status            text        not null    default 'active',
  concern           text,
  main_topics       text[]      not null    default '{}',

  sessions_count    int         not null    default 0,
  last_session_date date,

  notes             text,
  metadata          jsonb       not null    default '{}'::jsonb,

  constraint clients_status_check
    check (status in ('active', 'paused', 'archived', 'completed'))
);

drop trigger if exists clients_updated_at on public.clients;
create trigger clients_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

alter table public.clients enable row level security;

create index if not exists clients_deleted_at_idx on public.clients (deleted_at)
  where deleted_at is null;
create index if not exists clients_status_idx on public.clients (status)
  where deleted_at is null;

-- ── consultations ─────────────────────────────────────────────────────────────
create table if not exists public.consultations (
  id               uuid        primary key default gen_random_uuid(),
  created_at       timestamptz not null    default now(),
  updated_at       timestamptz not null    default now(),
  deleted_at       timestamptz             default null,

  client_id        uuid        references public.clients(id) on delete set null,
  client_name      text        not null    default '',
  client_initials  text        not null    default '',
  client_color     text        not null    default '#6088ff',

  title            text        not null    default '',
  source           text        not null    default 'audio',
  status           text        not null    default 'created',

  -- Audio upload info
  audio_file_name  text,
  audio_file_url   text,
  audio_file_size  int,

  -- Transcript
  transcript_text     text,
  transcript_origin   text,
  transcript_file_name text,
  transcript_created_at timestamptz,

  -- All analysis runs stored as JSONB array
  analyses         jsonb       not null    default '[]'::jsonb,

  metadata         jsonb       not null    default '{}'::jsonb,

  constraint consultations_source_check
    check (source in ('audio', 'transcript', 'notes')),
  constraint consultations_status_check
    check (status in ('created', 'transcribing', 'ready', 'analyzing', 'done', 'error'))
);

drop trigger if exists consultations_updated_at on public.consultations;
create trigger consultations_updated_at
  before update on public.consultations
  for each row execute function public.set_updated_at();

alter table public.consultations enable row level security;

create index if not exists consultations_client_id_idx on public.consultations (client_id)
  where deleted_at is null;
create index if not exists consultations_created_at_idx on public.consultations (created_at desc)
  where deleted_at is null;

-- ── voice_notes ───────────────────────────────────────────────────────────────
create table if not exists public.voice_notes (
  id                  uuid        primary key default gen_random_uuid(),
  created_at          timestamptz not null    default now(),
  deleted_at          timestamptz             default null,

  duration_sec        int         not null    default 0,
  audio_path          text,       -- Supabase Storage path or legacy /uploads/ URL
  text                text,       -- transcription or typed note

  client_id           uuid        references public.clients(id) on delete set null,
  client_name         text,
  consultation_id     uuid        references public.consultations(id) on delete set null,
  consultation_title  text
);

alter table public.voice_notes enable row level security;

create index if not exists voice_notes_client_id_idx on public.voice_notes (client_id)
  where deleted_at is null;
create index if not exists voice_notes_consultation_id_idx on public.voice_notes (consultation_id)
  where deleted_at is null;

-- ── client_history ────────────────────────────────────────────────────────────
create table if not exists public.client_history (
  id             uuid        primary key default gen_random_uuid(),
  created_at     timestamptz not null    default now(),

  client_id      uuid        not null    references public.clients(id) on delete cascade,
  section        text        not null,
  text           text        not null    default '',
  source         text        not null    default 'manual',
  session_id     uuid,       -- references consultations(id), nullable

  constraint client_history_source_check
    check (source in ('ai', 'manual')),
  constraint client_history_section_check
    check (section in (
      'main_topics', 'hypotheses', 'resources',
      'significant_events', 'explored', 'needs_clarification', 'notes'
    ))
);

alter table public.client_history enable row level security;

create index if not exists client_history_client_id_idx on public.client_history (client_id);
create index if not exists client_history_section_idx  on public.client_history (client_id, section);

-- ── client_materials ──────────────────────────────────────────────────────────
create table if not exists public.client_materials (
  id          uuid        primary key default gen_random_uuid(),
  created_at  timestamptz not null    default now(),

  client_id   uuid        not null    references public.clients(id) on delete cascade,
  type        text        not null    default 'other',
  title       text        not null    default '',
  content     text        not null    default '',
  file_name       text,
  file_url        text,           -- Supabase Storage URL
  consultation_id uuid,           -- optional: links observation to a specific consultation

  constraint client_materials_type_check
    check (type in (
      'general_history', 'therapist_notes', 'gpt_analysis',
      'past_transcript', 'other', 'observation'
    ))
);

alter table public.client_materials enable row level security;

create index if not exists client_materials_client_id_idx on public.client_materials (client_id);

-- ── notebook ─────────────────────────────────────────────────────────────────
-- Psychologist's personal notebook entries (cross-client free text).
create table if not exists public.notebook (
  id          uuid        primary key default gen_random_uuid(),
  created_at  timestamptz not null    default now(),
  text        text        not null    default ''
);

alter table public.notebook enable row level security;

create index if not exists notebook_created_at_idx on public.notebook (created_at desc);

-- ── user_profile ──────────────────────────────────────────────────────────────
-- Single row per installation, id = 'default'
create table if not exists public.user_profile (
  id                    text        primary key default 'default',
  updated_at            timestamptz not null    default now(),

  first_name            text        not null    default '',
  last_name             text        not null    default '',
  display_name          text        not null    default '',
  specialization        text        not null    default '',
  approach              text,
  email                 text,
  default_analysis_mode text        not null    default 'working',
  photo_url             text        -- base64 data URL
);

alter table public.user_profile enable row level security;

-- Insert default row if not exists
insert into public.user_profile (id) values ('default')
  on conflict (id) do nothing;
