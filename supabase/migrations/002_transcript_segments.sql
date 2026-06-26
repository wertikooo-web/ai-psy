-- Migration 002: Add transcript segments, formatted transcript, and deletion timestamps
-- Run in Supabase SQL Editor

alter table public.consultations
  add column if not exists transcript_segments             jsonb,
  add column if not exists transcript_formatted            jsonb,
  add column if not exists audio_deleted_at                timestamptz,
  add column if not exists transcript_raw_deleted_at       timestamptz,
  add column if not exists transcript_formatted_deleted_at timestamptz;
