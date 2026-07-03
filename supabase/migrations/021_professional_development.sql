-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 021: Professional Development — core tables + RLS
-- Creates: professional_courses, professional_sessions,
--          professional_personal_therapy, professional_goals,
--          professional_goal_courses, professional_documents
-- ═══════════════════════════════════════════════════════════════════════════

-- ── professional_courses ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.professional_courses (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid        NOT NULL,
  title                text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
  provider             text        CHECK (char_length(provider) <= 200),
  teacher              text        CHECK (char_length(teacher) <= 200),
  category             text        NOT NULL DEFAULT 'other'
                         CHECK (category IN (
                           'long_program','qualification','specialization',
                           'intensive','webinar','seminar','conference',
                           'masterclass','online_course','other'
                         )),
  format               text        NOT NULL DEFAULT 'online'
                         CHECK (format IN ('online','offline','hybrid')),
  status               text        NOT NULL DEFAULT 'planned'
                         CHECK (status IN (
                           'planned','in_progress','completed','paused','not_completed'
                         )),
  start_date           date,
  end_date             date,
  total_hours          numeric     CHECK (total_hours >= 0),
  completed_hours      numeric     CHECK (completed_hours >= 0),
  cost                 numeric     CHECK (cost >= 0),
  currency             text        DEFAULT 'RUB' CHECK (char_length(currency) <= 3),
  url                  text        CHECK (char_length(url) <= 1000),
  description          text,
  skills               text,
  notes                text,
  certificate_received boolean     NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT end_after_start
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
  CONSTRAINT completed_le_total
    CHECK (completed_hours IS NULL OR total_hours IS NULL OR completed_hours <= total_hours)
);

CREATE INDEX IF NOT EXISTS prof_courses_user_id_idx    ON public.professional_courses (user_id);
CREATE INDEX IF NOT EXISTS prof_courses_status_idx     ON public.professional_courses (user_id, status);
CREATE INDEX IF NOT EXISTS prof_courses_start_date_idx ON public.professional_courses (user_id, start_date);
CREATE INDEX IF NOT EXISTS prof_courses_created_at_idx ON public.professional_courses (user_id, created_at DESC);

CREATE TRIGGER set_professional_courses_updated_at
  BEFORE UPDATE ON public.professional_courses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.professional_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prof_courses_select" ON public.professional_courses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "prof_courses_insert" ON public.professional_courses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "prof_courses_update" ON public.professional_courses
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "prof_courses_delete" ON public.professional_courses
  FOR DELETE USING (auth.uid() = user_id);

-- ── professional_sessions ─────────────────────────────────────────────────────
-- Covers: supervisions, intervisions, balint groups, clinical cases, etc.

CREATE TABLE IF NOT EXISTS public.professional_sessions (
  id                         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                    uuid        NOT NULL,
  session_type               text        NOT NULL
                               CHECK (session_type IN (
                                 'supervision','intervision','balint_group',
                                 'clinical_case','methodology_group','other'
                               )),
  session_date               timestamptz NOT NULL,
  duration_minutes           integer     CHECK (duration_minutes > 0 AND duration_minutes <= 1440),
  supervisor_name            text        CHECK (char_length(supervisor_name) <= 200),
  organization               text        CHECK (char_length(organization) <= 200),
  format                     text        NOT NULL DEFAULT 'online'
                               CHECK (format IN ('online','offline','hybrid')),
  group_or_individual        text        NOT NULL DEFAULT 'individual'
                               CHECK (group_or_individual IN ('individual','group')),
  cost                       numeric     CHECK (cost >= 0),
  currency                   text        DEFAULT 'RUB' CHECK (char_length(currency) <= 3),
  topic                      text        CHECK (char_length(topic) <= 500),
  request_summary            text,
  main_insights              text,
  supervisor_recommendations text,
  next_steps                 text,
  next_session_date          timestamptz,
  related_client_id          uuid        REFERENCES public.clients(id) ON DELETE SET NULL,
  confidentiality_mode       text        NOT NULL DEFAULT 'anonymous'
                               CHECK (confidentiality_mode IN (
                                 'anonymous','initials','linked_client'
                               )),
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prof_sessions_user_id_idx      ON public.professional_sessions (user_id);
CREATE INDEX IF NOT EXISTS prof_sessions_type_idx         ON public.professional_sessions (user_id, session_type);
CREATE INDEX IF NOT EXISTS prof_sessions_date_idx         ON public.professional_sessions (user_id, session_date DESC);
CREATE INDEX IF NOT EXISTS prof_sessions_client_idx       ON public.professional_sessions (related_client_id)
  WHERE related_client_id IS NOT NULL;

CREATE TRIGGER set_professional_sessions_updated_at
  BEFORE UPDATE ON public.professional_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.professional_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prof_sessions_select" ON public.professional_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "prof_sessions_insert" ON public.professional_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "prof_sessions_update" ON public.professional_sessions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "prof_sessions_delete" ON public.professional_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- ── professional_personal_therapy ─────────────────────────────────────────────
-- Tracks only hours/metadata of personal therapy (NOT session content).

CREATE TABLE IF NOT EXISTS public.professional_personal_therapy (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL,
  session_date     timestamptz NOT NULL,
  duration_minutes integer     CHECK (duration_minutes > 0 AND duration_minutes <= 1440),
  therapist_name   text        CHECK (char_length(therapist_name) <= 200),
  format           text        NOT NULL DEFAULT 'offline'
                     CHECK (format IN ('online','offline','hybrid')),
  cost             numeric     CHECK (cost >= 0),
  currency         text        DEFAULT 'RUB' CHECK (char_length(currency) <= 3),
  notes            text        CHECK (char_length(notes) <= 1000),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prof_therapy_user_id_idx  ON public.professional_personal_therapy (user_id);
CREATE INDEX IF NOT EXISTS prof_therapy_date_idx     ON public.professional_personal_therapy (user_id, session_date DESC);

CREATE TRIGGER set_professional_therapy_updated_at
  BEFORE UPDATE ON public.professional_personal_therapy
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.professional_personal_therapy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prof_therapy_select" ON public.professional_personal_therapy
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "prof_therapy_insert" ON public.professional_personal_therapy
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "prof_therapy_update" ON public.professional_personal_therapy
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "prof_therapy_delete" ON public.professional_personal_therapy
  FOR DELETE USING (auth.uid() = user_id);

-- ── professional_goals ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.professional_goals (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL,
  title        text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
  description  text,
  motivation   text,
  status       text        NOT NULL DEFAULT 'planned'
                 CHECK (status IN ('planned','in_progress','completed','postponed')),
  target_date  date,
  completed_at timestamptz,
  progress     integer     NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prof_goals_user_id_idx ON public.professional_goals (user_id);
CREATE INDEX IF NOT EXISTS prof_goals_status_idx  ON public.professional_goals (user_id, status);
CREATE INDEX IF NOT EXISTS prof_goals_date_idx    ON public.professional_goals (user_id, target_date);

CREATE TRIGGER set_professional_goals_updated_at
  BEFORE UPDATE ON public.professional_goals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.professional_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prof_goals_select" ON public.professional_goals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "prof_goals_insert" ON public.professional_goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "prof_goals_update" ON public.professional_goals
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "prof_goals_delete" ON public.professional_goals
  FOR DELETE USING (auth.uid() = user_id);

-- ── professional_goal_courses ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.professional_goal_courses (
  goal_id    uuid        NOT NULL REFERENCES public.professional_goals(id)   ON DELETE CASCADE,
  course_id  uuid        NOT NULL REFERENCES public.professional_courses(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (goal_id, course_id)
);

CREATE INDEX IF NOT EXISTS prof_goal_courses_user_idx   ON public.professional_goal_courses (user_id);
CREATE INDEX IF NOT EXISTS prof_goal_courses_course_idx ON public.professional_goal_courses (course_id);

ALTER TABLE public.professional_goal_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prof_goal_courses_select" ON public.professional_goal_courses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "prof_goal_courses_insert" ON public.professional_goal_courses
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.professional_goals   WHERE id = goal_id   AND user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.professional_courses WHERE id = course_id AND user_id = auth.uid())
  );

CREATE POLICY "prof_goal_courses_delete" ON public.professional_goal_courses
  FOR DELETE USING (auth.uid() = user_id);

-- ── professional_documents ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.professional_documents (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL,
  document_type text        NOT NULL DEFAULT 'certificate'
                  CHECK (document_type IN (
                    'certificate','diploma','qualification','program',
                    'receipt','contract','supervision_confirmation','other'
                  )),
  title         text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
  organization  text        CHECK (char_length(organization) <= 200),
  issued_date   date,
  expires_at    date,
  hours         numeric     CHECK (hours >= 0),
  course_id     uuid        REFERENCES public.professional_courses(id)  ON DELETE SET NULL,
  session_id    uuid        REFERENCES public.professional_sessions(id) ON DELETE SET NULL,
  storage_path  text        NOT NULL,
  file_name     text        NOT NULL CHECK (char_length(file_name) <= 500),
  mime_type     text,
  file_size     bigint      CHECK (file_size > 0),
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prof_docs_user_id_idx   ON public.professional_documents (user_id);
CREATE INDEX IF NOT EXISTS prof_docs_type_idx      ON public.professional_documents (user_id, document_type);
CREATE INDEX IF NOT EXISTS prof_docs_course_idx    ON public.professional_documents (course_id) WHERE course_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS prof_docs_expires_idx   ON public.professional_documents (user_id, expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS prof_docs_created_idx   ON public.professional_documents (user_id, created_at DESC);

CREATE TRIGGER set_professional_documents_updated_at
  BEFORE UPDATE ON public.professional_documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.professional_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prof_docs_select" ON public.professional_documents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "prof_docs_insert" ON public.professional_documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "prof_docs_update" ON public.professional_documents
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "prof_docs_delete" ON public.professional_documents
  FOR DELETE USING (auth.uid() = user_id);
