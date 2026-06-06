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
