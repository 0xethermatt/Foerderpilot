-- ============================================================
-- Förderpilot V0 – Phase 11: Add offer_check to ai_checks
-- ============================================================
-- Extends the check_type constraint to allow offer_check
-- alongside funding_precheck and contract_check.
-- ============================================================

BEGIN;

ALTER TABLE ai_checks DROP CONSTRAINT IF EXISTS ai_checks_check_type_check;

ALTER TABLE ai_checks
  ADD CONSTRAINT ai_checks_check_type_check
    CHECK (check_type IN ('funding_precheck', 'contract_check', 'offer_check'));

COMMIT;
