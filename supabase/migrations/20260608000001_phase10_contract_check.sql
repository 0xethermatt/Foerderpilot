-- ============================================================
-- Förderpilot V0 – Phase 10: Add contract_check to ai_checks
-- ============================================================
-- Extends the check_type constraint to allow contract_check
-- alongside the existing funding_precheck value.
-- ============================================================

BEGIN;

ALTER TABLE ai_checks DROP CONSTRAINT IF EXISTS ai_checks_check_type_check;

ALTER TABLE ai_checks
  ADD CONSTRAINT ai_checks_check_type_check
    CHECK (check_type IN ('funding_precheck', 'contract_check'));

COMMIT;
