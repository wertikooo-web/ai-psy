-- Migration 003: AI settings fields in user_profile
-- Run in Supabase Dashboard → SQL Editor

ALTER TABLE user_profile
  ADD COLUMN IF NOT EXISTS analysis_style  text NOT NULL DEFAULT 'professional',
  ADD COLUMN IF NOT EXISTS analysis_length text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS chat_style      text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS ai_instructions text NOT NULL DEFAULT '';
