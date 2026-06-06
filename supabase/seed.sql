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
