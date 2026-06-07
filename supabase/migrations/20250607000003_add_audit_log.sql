-- ============================================================
-- Förderpilot V0 – audit_log table
-- Tracks status/risk changes on funding_cases.
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  funding_case_id  UUID        NOT NULL REFERENCES funding_cases(id) ON DELETE CASCADE,
  field            TEXT        NOT NULL,
  old_value        TEXT,
  new_value        TEXT,
  changed_by       TEXT        NOT NULL DEFAULT 'system',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON audit_log TO service_role;
GRANT SELECT ON audit_log TO anon;
GRANT SELECT, INSERT ON audit_log TO authenticated;
