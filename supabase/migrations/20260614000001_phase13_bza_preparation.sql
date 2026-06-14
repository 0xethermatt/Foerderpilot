-- ============================================================
-- Förderpilot V0 – Phase 13: BzA Preparation Sheet
-- ============================================================
-- Adds bza_responsible_party to funding_cases to track who
-- is responsible for creating the BzA (Bestätigung zum Antrag).
-- ============================================================

BEGIN;

ALTER TABLE public.funding_cases
  ADD COLUMN IF NOT EXISTS bza_responsible_party text
  CHECK (bza_responsible_party IN ('specialist_company', 'energy_expert', 'unclear'));

COMMENT ON COLUMN public.funding_cases.bza_responsible_party IS
  'BzA responsible party: specialist_company | energy_expert | unclear (null = not yet set)';

COMMIT;
