-- Migration 005: Chat messages persistence per consultation
-- Run in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS public.consultation_chat_messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id uuid        NOT NULL,
  role            text        NOT NULL CHECK (role IN ('user', 'assistant')),
  content         text        NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  metadata        jsonb       NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_chat_msg_consultation_id
  ON public.consultation_chat_messages (consultation_id);

CREATE INDEX IF NOT EXISTS idx_chat_msg_consultation_created
  ON public.consultation_chat_messages (consultation_id, created_at);
