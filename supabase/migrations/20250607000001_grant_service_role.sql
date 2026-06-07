-- ============================================================
-- Förderpilot V0 – service_role table grants
--
-- Tables created via raw SQL migrations do NOT automatically
-- receive grants for the service_role (unlike dashboard-created
-- tables). Without these, the service-role Supabase client gets
-- "permission denied for table X" even though it has BYPASSRLS.
-- ============================================================

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO service_role;
