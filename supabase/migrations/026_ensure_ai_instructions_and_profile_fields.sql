-- Migration 026: ensure ai_instructions and all profile fields exist.
-- Safe to run repeatedly (IF NOT EXISTS).
-- Apply in: Supabase Dashboard → SQL Editor → New query → Run.

ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS analysis_style  text NOT NULL DEFAULT 'professional',
  ADD COLUMN IF NOT EXISTS analysis_length text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS chat_style      text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS ai_instructions text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS specialization  text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS approach        text,
  ADD COLUMN IF NOT EXISTS email           text,
  ADD COLUMN IF NOT EXISTS photo_url       text;
