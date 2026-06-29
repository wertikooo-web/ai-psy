-- Migration 012: add missing ai_model column to user_profile
-- Root cause: DAL writes ai_model on every save but column was never created.
-- Run in Supabase Dashboard → SQL Editor

ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS ai_model text NOT NULL DEFAULT 'gpt-4o';
