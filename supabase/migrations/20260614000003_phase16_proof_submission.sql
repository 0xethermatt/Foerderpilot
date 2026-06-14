BEGIN;

ALTER TABLE public.funding_cases
  ADD COLUMN IF NOT EXISTS kfw_approval_received_at    timestamptz,
  ADD COLUMN IF NOT EXISTS implementation_status       text NOT NULL DEFAULT 'not_started'
    CHECK (implementation_status IN ('not_started', 'started', 'completed')),
  ADD COLUMN IF NOT EXISTS implementation_started_at   timestamptz,
  ADD COLUMN IF NOT EXISTS implementation_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS bnd_id                      text,
  ADD COLUMN IF NOT EXISTS bnd_created_at              date,
  ADD COLUMN IF NOT EXISTS proof_submission_status     text NOT NULL DEFAULT 'not_started'
    CHECK (proof_submission_status IN ('not_started', 'prepared', 'submitted')),
  ADD COLUMN IF NOT EXISTS proof_submitted_at          timestamptz,
  ADD COLUMN IF NOT EXISTS payout_status               text NOT NULL DEFAULT 'pending'
    CHECK (payout_status IN ('pending', 'paid'));

COMMIT;
