-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 022: Extend calendar_events for professional development events
-- Adds: event_category, professional_course_id, professional_session_id
-- Existing rows default to 'client_session' — no data loss.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS event_category text NOT NULL DEFAULT 'client_session'
    CHECK (event_category IN (
      'client_session',
      'professional_course',
      'supervision',
      'intervision',
      'conference',
      'learning_deadline',
      'personal_therapy',
      'other_professional'
    )),
  ADD COLUMN IF NOT EXISTS professional_course_id  uuid
    REFERENCES public.professional_courses(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS professional_session_id uuid
    REFERENCES public.professional_sessions(id) ON DELETE SET NULL;

-- Index for filtering professional events quickly
CREATE INDEX IF NOT EXISTS calendar_events_category_idx
  ON public.calendar_events (event_category)
  WHERE deleted_at IS NULL AND event_category != 'client_session';
