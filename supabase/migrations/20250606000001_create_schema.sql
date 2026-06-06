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
