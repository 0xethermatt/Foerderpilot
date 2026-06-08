-- ============================================================
-- Förderpilot V0 – Phase 9: Restructure ai_checks
-- ============================================================
-- The ai_checks table was created in the initial schema with a
-- minimal column set. Phase 9 needs a richer structure.
-- No production data exists in ai_checks yet, so we can safely
-- restructure: drop old constraints, rename/retype columns, add
-- new ones.
-- ============================================================

BEGIN;

-- ─── 1. Drop old CHECK constraints ───────────────────────────────────────────

ALTER TABLE ai_checks DROP CONSTRAINT IF EXISTS ai_checks_check_type_check;
ALTER TABLE ai_checks DROP CONSTRAINT IF EXISTS ai_checks_result_check;

-- ─── 2. Sanitize existing rows before type changes ───────────────────────────
-- Force all rows to values that will survive the new constraints.
-- Table is expected to be empty; this is a safety net.

UPDATE ai_checks SET check_type = 'funding_precheck';
UPDATE ai_checks SET result     = 'draft';
UPDATE ai_checks SET details    = '{}';

-- ─── 3. Rename columns ───────────────────────────────────────────────────────

ALTER TABLE ai_checks RENAME COLUMN funding_case_id TO case_id;
ALTER TABLE ai_checks RENAME COLUMN result          TO status;
ALTER TABLE ai_checks RENAME COLUMN details         TO result_json;

-- ─── 4. Change result_json from TEXT to JSONB ────────────────────────────────

ALTER TABLE ai_checks
  ALTER COLUMN result_json TYPE JSONB USING result_json::JSONB;

-- ─── 5. Fix status default ───────────────────────────────────────────────────

ALTER TABLE ai_checks ALTER COLUMN status SET DEFAULT 'draft';

-- ─── 6. Add new columns ──────────────────────────────────────────────────────

ALTER TABLE ai_checks
  ADD COLUMN IF NOT EXISTS provider            TEXT         NOT NULL DEFAULT 'mock',
  ADD COLUMN IF NOT EXISTS model               TEXT         NOT NULL DEFAULT 'mock-funding-precheck-v0',
  ADD COLUMN IF NOT EXISTS summary             TEXT,
  ADD COLUMN IF NOT EXISTS risk_level          TEXT,
  ADD COLUMN IF NOT EXISTS confidence          TEXT,
  ADD COLUMN IF NOT EXISTS human_review_status TEXT         NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS rule_version        TEXT         NOT NULL DEFAULT 'V0',
  ADD COLUMN IF NOT EXISTS sources_used        JSONB        NOT NULL DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS disclaimer          TEXT         NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now();

-- ─── 7. Add new CHECK constraints ────────────────────────────────────────────

ALTER TABLE ai_checks
  ADD CONSTRAINT ai_checks_check_type_check
    CHECK (check_type IN ('funding_precheck'));

ALTER TABLE ai_checks
  ADD CONSTRAINT ai_checks_status_check
    CHECK (status IN ('draft', 'completed', 'failed'));

ALTER TABLE ai_checks
  ADD CONSTRAINT ai_checks_risk_level_check
    CHECK (risk_level IN ('green', 'yellow', 'red') OR risk_level IS NULL);

ALTER TABLE ai_checks
  ADD CONSTRAINT ai_checks_confidence_check
    CHECK (confidence IN ('low', 'medium', 'high') OR confidence IS NULL);

ALTER TABLE ai_checks
  ADD CONSTRAINT ai_checks_human_review_status_check
    CHECK (human_review_status IN ('pending', 'approved', 'rejected'));

-- ─── 8. updated_at trigger ───────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_ai_checks_updated_at ON ai_checks;

CREATE TRIGGER trg_ai_checks_updated_at
  BEFORE UPDATE ON ai_checks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 9. Grants ───────────────────────────────────────────────────────────────
-- service_role already has GRANT ALL from migration 20250607000001, but we
-- add explicitly for future migrations that may reset grants.

GRANT ALL ON ai_checks TO service_role;

COMMIT;
