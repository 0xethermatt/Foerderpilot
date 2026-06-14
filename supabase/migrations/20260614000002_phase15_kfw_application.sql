-- ============================================================
-- Förderpilot V0 – Phase 15: KfW Application Preparation
-- ============================================================
-- Adds BzA-ID tracking and KfW application workflow fields
-- to funding_cases. All new fields are internal tracking only;
-- no automatic KfW submission, no guarantee of funding.
-- ============================================================

BEGIN;

ALTER TABLE public.funding_cases
  ADD COLUMN IF NOT EXISTS bza_id text,
  ADD COLUMN IF NOT EXISTS bza_created_at date,
  ADD COLUMN IF NOT EXISTS bza_status text NOT NULL DEFAULT 'not_started'
    CHECK (bza_status IN ('not_started', 'requested', 'created')),
  ADD COLUMN IF NOT EXISTS kfw_application_status text NOT NULL DEFAULT 'not_started'
    CHECK (kfw_application_status IN ('not_started', 'prepared', 'submitted', 'approved')),
  ADD COLUMN IF NOT EXISTS kfw_application_prepared_at timestamptz,
  ADD COLUMN IF NOT EXISTS kfw_application_reference text;

COMMENT ON COLUMN public.funding_cases.bza_id IS
  'BzA reference ID from the Fachunternehmen/Energieeffizienz-Experte (internal tracking only – not KfW-validated)';
COMMENT ON COLUMN public.funding_cases.bza_created_at IS
  'Date the BzA was created by the responsible party';
COMMENT ON COLUMN public.funding_cases.bza_status IS
  'BzA creation substep: not_started | requested | created';
COMMENT ON COLUMN public.funding_cases.kfw_application_status IS
  'KfW application internal substep: not_started | prepared | submitted | approved';
COMMENT ON COLUMN public.funding_cases.kfw_application_prepared_at IS
  'Timestamp when internal KfW application preparation was marked complete';
COMMENT ON COLUMN public.funding_cases.kfw_application_reference IS
  'Internal reference note for this application (NOT a KfW-validated application number)';

COMMIT;
