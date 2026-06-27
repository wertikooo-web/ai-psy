-- 010_consultations_request_id.sql
-- Link each consultation to the client_request that was active when it was created.
-- nullable: old consultations have no request.

ALTER TABLE consultations
  ADD COLUMN IF NOT EXISTS request_id uuid
    REFERENCES client_requests(id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_consultations_request_id
  ON consultations(request_id)
  WHERE request_id IS NOT NULL;
