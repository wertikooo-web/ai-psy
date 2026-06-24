-- ============================================================
-- TRANSCRIPT AI · PSY — Supabase schema
-- Phase 1: clients only
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- ── clients ──────────────────────────────────────────────────────────────────
create table if not exists public.clients (
  id           uuid        primary key default gen_random_uuid(),
  created_at   timestamptz not null    default now(),
  updated_at   timestamptz not null    default now(),
  deleted_at   timestamptz             default null,

  -- Identity
  full_name    text        not null,
  first_name   text,
  last_name    text,
  initials     text,
  color        text        default '#6088ff',
  age          int,

  -- Clinical
  status       text        not null    default 'active',
  concern      text,
  main_topics  text[]      not null    default '{}',

  -- Sessions
  sessions_count      int  not null    default 0,
  last_session_date   date,

  -- Free-form
  notes        text,
  metadata     jsonb       not null    default '{}'::jsonb,

  constraint clients_status_check
    check (status in ('active', 'paused', 'archived', 'completed'))
);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists clients_updated_at on public.clients;
create trigger clients_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Enable RLS — no public policies for clients.
-- All access goes through service role key (server API routes only).
alter table public.clients enable row level security;

-- No public policies intentionally.
-- Service role bypasses RLS by default.

-- ── Index on deleted_at for soft-delete queries ───────────────────────────────
create index if not exists clients_deleted_at_idx on public.clients (deleted_at)
  where deleted_at is null;

create index if not exists clients_status_idx on public.clients (status)
  where deleted_at is null;
