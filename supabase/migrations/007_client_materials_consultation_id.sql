-- Migration 007: add consultation_id to client_materials
--
-- The column exists in schema.sql but was missing from the live table,
-- causing [DAL/addMaterial] "Could not find the 'consultation_id' column" errors.

ALTER TABLE public.client_materials
  ADD COLUMN IF NOT EXISTS consultation_id uuid REFERENCES public.consultations(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.client_materials.consultation_id IS
  'Optional link to a specific consultation this material was added from.';
