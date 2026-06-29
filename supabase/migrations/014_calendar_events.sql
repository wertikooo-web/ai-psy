-- Calendar events table for scheduling consultations.
-- Intentionally separate from consultations: planning vs. actual session are different lifecycles.
-- A calendar_event may exist without a consultation (not-yet-transcribed or cancelled).
-- A consultation may exist without a calendar_event (created ad-hoc from audio upload).

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           uuid        REFERENCES public.clients(id)       ON DELETE SET NULL,
  client_name         text        NOT NULL DEFAULT '',
  consultation_id     uuid        REFERENCES public.consultations(id) ON DELETE SET NULL,
  title               text        NOT NULL DEFAULT '',
  starts_at           timestamptz NOT NULL,
  ends_at             timestamptz NOT NULL,
  timezone            text        NOT NULL DEFAULT 'Europe/Chisinau',
  status              text        NOT NULL DEFAULT 'planned'
                        CHECK (status IN ('planned', 'completed', 'cancelled', 'no_show')),
  format              text        NOT NULL DEFAULT 'online'
                        CHECK (format IN ('online', 'offline')),
  location            text,
  notes               text,

  -- Google Calendar sync fields (Stage 2 — all null until connected)
  google_calendar_id  text,
  google_event_id     text,
  google_event_etag   text,
  google_updated_at   timestamptz,
  sync_status         text        NOT NULL DEFAULT 'none'
                        CHECK (sync_status IN ('none', 'synced', 'pending', 'error', 'missing_remote')),

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

-- Fast queries: date range, client filter, status filter
CREATE INDEX IF NOT EXISTS calendar_events_starts_at_idx
  ON public.calendar_events (starts_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS calendar_events_client_id_idx
  ON public.calendar_events (client_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS calendar_events_status_idx
  ON public.calendar_events (status)
  WHERE deleted_at IS NULL;

-- set_updated_at() trigger function already exists from migration 001
CREATE TRIGGER set_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
