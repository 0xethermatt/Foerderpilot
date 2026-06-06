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
