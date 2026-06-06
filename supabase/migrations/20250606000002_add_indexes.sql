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
