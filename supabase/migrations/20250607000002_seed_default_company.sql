-- ============================================================
-- Förderpilot V0 – seed default company
--
-- supabase db push only runs migrations, not seed.sql.
-- Insert the dev default company so the foreign key on
-- customers.company_id is satisfied.
-- ============================================================

INSERT INTO companies (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Muster SHK GmbH')
ON CONFLICT (id) DO NOTHING;
