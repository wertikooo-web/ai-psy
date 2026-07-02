-- Migration 020: ensure profile fields used by Settings/Profile exist.
-- Safe to run repeatedly.

alter table public.user_profile
  add column if not exists specialization text not null default '',
  add column if not exists approach text,
  add column if not exists email text,
  add column if not exists photo_url text;
