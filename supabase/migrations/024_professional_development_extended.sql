-- Migration 024: Extended professional development
-- Adds: associations, accreditation requirements, expenses, reading list, annual reflection
-- Also adds cost fields to professional_courses

-- ── Add cost tracking to courses ──────────────────────────────────────────────
ALTER TABLE professional_courses
  ADD COLUMN IF NOT EXISTS cost_amount   numeric(10,2),
  ADD COLUMN IF NOT EXISTS cost_currency text NOT NULL DEFAULT 'EUR';

-- ── Professional associations / memberships ───────────────────────────────────
CREATE TABLE IF NOT EXISTS professional_associations (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        NOT NULL,
  name               text        NOT NULL,
  acronym            text,
  website            text,
  member_since       date,
  membership_expires date,
  fee_amount         numeric(10,2),
  fee_currency       text        NOT NULL DEFAULT 'EUR',
  fee_period         text        NOT NULL DEFAULT 'annual'
    CHECK (fee_period IN ('annual','biennial','monthly','one_time')),
  status             text        NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','inactive','pending','expired')),
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- ── Accreditation requirements per association per year ───────────────────────
CREATE TABLE IF NOT EXISTS accreditation_requirements (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid        NOT NULL,
  association_id              uuid        REFERENCES professional_associations(id) ON DELETE CASCADE,
  year                        integer     NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  supervision_hours_required  numeric(6,1) NOT NULL DEFAULT 0 CHECK (supervision_hours_required >= 0),
  learning_hours_required     numeric(6,1) NOT NULL DEFAULT 0 CHECK (learning_hours_required >= 0),
  therapy_hours_required      numeric(6,1) NOT NULL DEFAULT 0 CHECK (therapy_hours_required >= 0),
  conference_hours_required   numeric(6,1) NOT NULL DEFAULT 0 CHECK (conference_hours_required >= 0),
  deadline                    date,
  notes                       text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, association_id, year)
);

-- ── Financial tracking ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS professional_expenses (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL,
  title             text        NOT NULL,
  expense_type      text        NOT NULL DEFAULT 'other'
    CHECK (expense_type IN ('course','supervision','therapy','membership','book','conference','other')),
  amount            numeric(10,2) NOT NULL CHECK (amount >= 0),
  currency          text        NOT NULL DEFAULT 'EUR',
  paid_date         date,
  is_paid           boolean     NOT NULL DEFAULT false,
  is_tax_deductible boolean     NOT NULL DEFAULT true,
  notes             text,
  course_id         uuid        REFERENCES professional_courses(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ── Reading list ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS professional_reading (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL,
  title          text        NOT NULL,
  author         text,
  reading_type   text        NOT NULL DEFAULT 'book'
    CHECK (reading_type IN ('book','article','paper','manual','other')),
  status         text        NOT NULL DEFAULT 'want_to_read'
    CHECK (status IN ('want_to_read','reading','completed','abandoned')),
  started_date   date,
  completed_date date,
  rating         smallint    CHECK (rating BETWEEN 1 AND 5),
  notes          text,
  url            text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ── Annual reflection ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS professional_reflections (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL,
  year             integer     NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  key_learnings    text,
  main_direction   text,
  challenges       text,
  proud_of         text,
  next_year_focus  text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, year)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_prof_associations_user      ON professional_associations(user_id);
CREATE INDEX IF NOT EXISTS idx_prof_associations_expires   ON professional_associations(membership_expires);
CREATE INDEX IF NOT EXISTS idx_accreditation_req_user_year ON accreditation_requirements(user_id, year);
CREATE INDEX IF NOT EXISTS idx_prof_expenses_user          ON professional_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_prof_expenses_paid_date     ON professional_expenses(paid_date);
CREATE INDEX IF NOT EXISTS idx_prof_reading_user           ON professional_reading(user_id, status);
CREATE INDEX IF NOT EXISTS idx_prof_reflections_user_year  ON professional_reflections(user_id, year);

-- ── updated_at triggers ───────────────────────────────────────────────────────
CREATE TRIGGER set_professional_associations_updated_at
  BEFORE UPDATE ON professional_associations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_accreditation_requirements_updated_at
  BEFORE UPDATE ON accreditation_requirements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_professional_expenses_updated_at
  BEFORE UPDATE ON professional_expenses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_professional_reading_updated_at
  BEFORE UPDATE ON professional_reading
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_professional_reflections_updated_at
  BEFORE UPDATE ON professional_reflections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE professional_associations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE accreditation_requirements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_expenses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_reading         ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_reflections     ENABLE ROW LEVEL SECURITY;

-- professional_associations
CREATE POLICY "assoc_select" ON professional_associations FOR SELECT USING (true);
CREATE POLICY "assoc_insert" ON professional_associations FOR INSERT WITH CHECK (true);
CREATE POLICY "assoc_update" ON professional_associations FOR UPDATE USING (true);
CREATE POLICY "assoc_delete" ON professional_associations FOR DELETE USING (true);

-- accreditation_requirements
CREATE POLICY "acc_req_select" ON accreditation_requirements FOR SELECT USING (true);
CREATE POLICY "acc_req_insert" ON accreditation_requirements FOR INSERT WITH CHECK (true);
CREATE POLICY "acc_req_update" ON accreditation_requirements FOR UPDATE USING (true);
CREATE POLICY "acc_req_delete" ON accreditation_requirements FOR DELETE USING (true);

-- professional_expenses
CREATE POLICY "expense_select" ON professional_expenses FOR SELECT USING (true);
CREATE POLICY "expense_insert" ON professional_expenses FOR INSERT WITH CHECK (true);
CREATE POLICY "expense_update" ON professional_expenses FOR UPDATE USING (true);
CREATE POLICY "expense_delete" ON professional_expenses FOR DELETE USING (true);

-- professional_reading
CREATE POLICY "reading_select" ON professional_reading FOR SELECT USING (true);
CREATE POLICY "reading_insert" ON professional_reading FOR INSERT WITH CHECK (true);
CREATE POLICY "reading_update" ON professional_reading FOR UPDATE USING (true);
CREATE POLICY "reading_delete" ON professional_reading FOR DELETE USING (true);

-- professional_reflections
CREATE POLICY "reflection_select" ON professional_reflections FOR SELECT USING (true);
CREATE POLICY "reflection_insert" ON professional_reflections FOR INSERT WITH CHECK (true);
CREATE POLICY "reflection_update" ON professional_reflections FOR UPDATE USING (true);
CREATE POLICY "reflection_delete" ON professional_reflections FOR DELETE USING (true);
