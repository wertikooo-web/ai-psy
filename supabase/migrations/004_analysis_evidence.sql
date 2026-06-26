-- Migration 004: Add analysis_evidence JSONB column to consultations
-- Run in Supabase Dashboard → SQL Editor

ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS analysis_evidence jsonb;
