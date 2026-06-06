-- ============================================================
-- Förderpilot V0 – full schema + seed
-- Paste this entire file into:
--   Supabase Dashboard → SQL Editor → New query → Run
-- URL: https://supabase.com/dashboard/project/hruglvnuwidlumyfvowx/sql/new
-- Safe to re-run: all statements use IF NOT EXISTS / ON CONFLICT
-- ============================================================

-- ──── supabase/migrations/20250606000001_create_schema.sql ────
-- ============================================================
-- Förderpilot V0 – core schema
-- Run order: 1 of 3
-- ============================================================

-- ─── updated_at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── companies ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS companies (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── customers ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customers (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  first_name  TEXT        NOT NULL,
  last_name   TEXT        NOT NULL,
  email       TEXT        NOT NULL,
  phone       TEXT,
  street      TEXT        NOT NULL,
  city        TEXT        NOT NULL,
  postal_code TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── funding_cases ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS funding_cases (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id     UUID        NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  title           TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'lead_received'
    CHECK (status IN (
      'lead_received',
      'data_missing',
      'funding_check_done',
      'offer_created',
      'contract_review_needed',
      'contract_signed',
      'bza_prepared',
      'application_submitted',
      'approval_received',
      'execution_released',
      'proof_documents_pending',
      'proof_submitted',
      'completed'
    )),
  risk_level      TEXT        NOT NULL DEFAULT 'green'
    CHECK (risk_level IN ('green', 'yellow', 'red')),
  heat_pump_type  TEXT,
  estimated_cost  NUMERIC(12, 2),
  funding_amount  NUMERIC(12, 2),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_funding_cases_updated_at
  BEFORE UPDATE ON funding_cases
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── documents ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS documents (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  funding_case_id  UUID        NOT NULL REFERENCES funding_cases(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  type             TEXT        NOT NULL
    CHECK (type IN (
      'energy_certificate',
      'building_permit',
      'offer',
      'contract',
      'proof_of_completion',
      'bank_statement',
      'other'
    )),
  storage_path     TEXT        NOT NULL,
  file_size_bytes  BIGINT,
  uploaded_by      TEXT        NOT NULL,
  uploaded_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── tasks ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tasks (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  funding_case_id  UUID        NOT NULL REFERENCES funding_cases(id) ON DELETE CASCADE,
  title            TEXT        NOT NULL,
  description      TEXT,
  assigned_to      TEXT,
  due_date         DATE,
  completed        BOOLEAN     NOT NULL DEFAULT false,
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── ai_checks ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_checks (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  funding_case_id  UUID        NOT NULL REFERENCES funding_cases(id) ON DELETE CASCADE,
  check_type       TEXT        NOT NULL
    CHECK (check_type IN (
      'eligibility_check',
      'document_review',
      'cost_plausibility',
      'deadline_check'
    )),
  result           TEXT        NOT NULL DEFAULT 'pending'
    CHECK (result IN ('passed', 'warning', 'failed', 'pending')),
  details          TEXT        NOT NULL,
  reviewed_by      TEXT,
  reviewed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ──── supabase/migrations/20250606000002_add_indexes.sql ────
-- ============================================================
-- Förderpilot V0 – indexes
-- Run order: 2 of 3  (after create_schema)
-- ============================================================

-- customers
CREATE INDEX IF NOT EXISTS idx_customers_company_id
  ON customers (company_id);

-- funding_cases – the most-queried table
CREATE INDEX IF NOT EXISTS idx_funding_cases_company_id
  ON funding_cases (company_id);

CREATE INDEX IF NOT EXISTS idx_funding_cases_customer_id
  ON funding_cases (customer_id);

CREATE INDEX IF NOT EXISTS idx_funding_cases_status
  ON funding_cases (status);

CREATE INDEX IF NOT EXISTS idx_funding_cases_risk_level
  ON funding_cases (risk_level);

-- tasks
CREATE INDEX IF NOT EXISTS idx_tasks_funding_case_id
  ON tasks (funding_case_id);

CREATE INDEX IF NOT EXISTS idx_tasks_due_date
  ON tasks (due_date);

-- Partial index: only open tasks (skips completed rows)
CREATE INDEX IF NOT EXISTS idx_tasks_open_due_date
  ON tasks (due_date)
  WHERE completed = false;

-- documents
CREATE INDEX IF NOT EXISTS idx_documents_funding_case_id
  ON documents (funding_case_id);

-- ai_checks
CREATE INDEX IF NOT EXISTS idx_ai_checks_funding_case_id
  ON ai_checks (funding_case_id);

-- ──── supabase/migrations/20250606000003_enable_rls.sql ────
-- ============================================================
-- Förderpilot V0 – Row Level Security
-- Run order: 3 of 3  (after add_indexes)
--
-- Production plan:
--   Replace the dev_allow_all_* policies below with company-scoped
--   policies once auth is wired up. Example pattern:
--
--     CREATE POLICY "company_members_only" ON funding_cases
--       FOR ALL
--       USING (
--         company_id = (
--           SELECT company_id FROM profiles WHERE id = auth.uid()
--         )
--       );
--
-- WARNING: The "dev_allow_all_*" policies below are intentionally
--   permissive. They must be dropped or replaced before production.
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE companies      ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE funding_cases  ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_checks      ENABLE ROW LEVEL SECURITY;

-- DEV-ONLY permissive policies (local testing / staging)
-- TODO: Remove before production — replace with company-scoped policies

CREATE POLICY "dev_allow_all_companies" ON companies
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "dev_allow_all_customers" ON customers
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "dev_allow_all_funding_cases" ON funding_cases
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "dev_allow_all_documents" ON documents
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "dev_allow_all_tasks" ON tasks
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "dev_allow_all_ai_checks" ON ai_checks
  FOR ALL USING (true) WITH CHECK (true);

-- ──── supabase/migrations/20250606000004_add_case_detail_fields.sql ────
-- ============================================================
-- Förderpilot V0 – extend funding_cases with detail fields
-- Run order: 4 of 4  (after enable_rls)
-- ============================================================

ALTER TABLE funding_cases
  ADD COLUMN IF NOT EXISTS project_address_street       TEXT,
  ADD COLUMN IF NOT EXISTS project_address_postal_code  TEXT,
  ADD COLUMN IF NOT EXISTS project_address_city         TEXT,

  ADD COLUMN IF NOT EXISTS building_type  TEXT
    CHECK (building_type IS NULL OR building_type IN ('EFH', 'MFH', 'DHH', 'RH', 'WHG')),

  ADD COLUMN IF NOT EXISTS housing_units  INTEGER
    CHECK (housing_units IS NULL OR housing_units >= 1),

  ADD COLUMN IF NOT EXISTS owner_status   TEXT
    CHECK (owner_status IS NULL OR owner_status IN (
      'owner', 'owner_community', 'other'
    )),

  ADD COLUMN IF NOT EXISTS self_occupied  BOOLEAN,

  ADD COLUMN IF NOT EXISTS current_heating_type  TEXT
    CHECK (current_heating_type IS NULL OR current_heating_type IN (
      'gas', 'oil', 'electric', 'district_heat', 'heat_pump', 'pellet', 'other'
    )),

  ADD COLUMN IF NOT EXISTS current_heating_year  INTEGER
    CHECK (current_heating_year IS NULL OR (current_heating_year >= 1900 AND current_heating_year <= 2030)),

  ADD COLUMN IF NOT EXISTS planned_heating_type  TEXT
    CHECK (planned_heating_type IS NULL OR planned_heating_type IN (
      'air_water', 'brine_water', 'water_water'
    )),

  ADD COLUMN IF NOT EXISTS planned_heat_pump_model  TEXT;

-- Index: filter open cases by building type (useful for reporting)
CREATE INDEX IF NOT EXISTS idx_funding_cases_building_type
  ON funding_cases (building_type)
  WHERE building_type IS NOT NULL;

-- ──── supabase/migrations/20250606000005_grant_permissions.sql ────
-- ============================================================
-- Förderpilot V0 – explicit table/sequence grants
-- Run order: 5 of 5  (after enable_rls)
--
-- Supabase does NOT auto-grant public-schema tables that are
-- created via raw SQL migrations (only via dashboard UI).
-- This migration restores the standard Supabase grants so that:
--   anon        → SELECT (read-only via dev_allow_all policies)
--   authenticated → full CRUD (for future auth integration)
--   service_role  → full CRUD (already bypasses RLS)
-- ============================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Tables
GRANT SELECT                          ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE  ON ALL TABLES IN SCHEMA public TO authenticated;

-- Sequences (needed for INSERT with generated PKs)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Ensure future tables also get the grants automatically
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;

-- ──── supabase/seed.sql ────
-- ============================================================
-- Förderpilot V0 – development seed data
--
-- Run with:  supabase db reset   (local)
-- or:        supabase db seed    (Supabase CLI ≥ 1.138)
--
-- The company UUID below matches DEFAULT_COMPANY_ID in .env.local.
-- ============================================================

INSERT INTO companies (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Muster SHK GmbH')
ON CONFLICT (id) DO NOTHING;
