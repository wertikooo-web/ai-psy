-- Migration 011: add ai_chat to client_materials type constraint
-- Saved consultation AI-chat dialogs are stored with type = 'ai_chat'

ALTER TABLE public.client_materials
  DROP CONSTRAINT IF EXISTS client_materials_type_check;

ALTER TABLE public.client_materials
  ADD CONSTRAINT client_materials_type_check
    CHECK (type IN (
      'general_history', 'therapist_notes', 'gpt_analysis',
      'past_transcript', 'other', 'observation', 'ai_chat'
    ));
