-- ============================================================
-- Förderpilot V0 – Phase 19: Supabase Auth & RLS Hardening
--
-- What this migration does:
--   1. Creates profiles and company_members tables
--   2. Adds a trigger to auto-create a profile on new user signup
--   3. Adds a SECURITY DEFINER helper used in RLS policies
--   4. Drops the permissive dev_allow_all_* policies
--   5. Creates company-scoped RLS policies for all tables
--   6. Enables RLS on audit_log (was missing)
--   7. Adds RLS on profiles and company_members
--   8. Grants anon/authenticated access to new tables
-- ============================================================

BEGIN;

-- ─── 1. profiles ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text        NOT NULL,
  full_name   text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS
  'Mirror of auth.users — app-visible user data (email, display name).';

-- ─── 2. company_members ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.company_members (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text        NOT NULL DEFAULT 'member'
                CHECK (role IN ('owner', 'admin', 'member')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);

COMMENT ON TABLE public.company_members IS
  'Maps auth users to companies. One user can belong to exactly one company in V1.';

-- ─── 3. Trigger: auto-create profile on signup ───────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    email      = EXCLUDED.email,
    full_name  = COALESCE(EXCLUDED.full_name, profiles.full_name),
    updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── 4. Helper: returns company_ids for the current auth user ─────────────────

CREATE OR REPLACE FUNCTION public.auth_user_company_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT company_id
  FROM   public.company_members
  WHERE  user_id = auth.uid();
$$;

COMMENT ON FUNCTION public.auth_user_company_ids() IS
  'Returns the set of company UUIDs the current auth user belongs to. Used in RLS policies.';

-- ─── 5. Drop dev_allow_all_* policies ────────────────────────────────────────

DROP POLICY IF EXISTS "dev_allow_all_companies"     ON companies;
DROP POLICY IF EXISTS "dev_allow_all_customers"     ON customers;
DROP POLICY IF EXISTS "dev_allow_all_funding_cases" ON funding_cases;
DROP POLICY IF EXISTS "dev_allow_all_documents"     ON documents;
DROP POLICY IF EXISTS "dev_allow_all_tasks"         ON tasks;
DROP POLICY IF EXISTS "dev_allow_all_ai_checks"     ON ai_checks;

-- ─── 6. Enable RLS on audit_log (was missing) ────────────────────────────────

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ─── 7. Company-scoped RLS policies ──────────────────────────────────────────

-- companies: members can read their own company
CREATE POLICY "members_select_companies" ON companies
  FOR SELECT
  USING (id IN (SELECT auth_user_company_ids()));

-- customers: company-scoped full access
CREATE POLICY "members_all_customers" ON customers
  FOR ALL
  USING     (company_id IN (SELECT auth_user_company_ids()))
  WITH CHECK (company_id IN (SELECT auth_user_company_ids()));

-- funding_cases: company-scoped full access
CREATE POLICY "members_all_funding_cases" ON funding_cases
  FOR ALL
  USING     (company_id IN (SELECT auth_user_company_ids()))
  WITH CHECK (company_id IN (SELECT auth_user_company_ids()));

-- documents: accessible if the parent case belongs to the user's company
CREATE POLICY "members_all_documents" ON documents
  FOR ALL
  USING (
    funding_case_id IN (
      SELECT id FROM funding_cases
      WHERE  company_id IN (SELECT auth_user_company_ids())
    )
  )
  WITH CHECK (
    funding_case_id IN (
      SELECT id FROM funding_cases
      WHERE  company_id IN (SELECT auth_user_company_ids())
    )
  );

-- tasks: same as documents
CREATE POLICY "members_all_tasks" ON tasks
  FOR ALL
  USING (
    funding_case_id IN (
      SELECT id FROM funding_cases
      WHERE  company_id IN (SELECT auth_user_company_ids())
    )
  )
  WITH CHECK (
    funding_case_id IN (
      SELECT id FROM funding_cases
      WHERE  company_id IN (SELECT auth_user_company_ids())
    )
  );

-- ai_checks: accessible if the parent case belongs to the user's company
CREATE POLICY "members_all_ai_checks" ON ai_checks
  FOR ALL
  USING (
    case_id IN (
      SELECT id FROM funding_cases
      WHERE  company_id IN (SELECT auth_user_company_ids())
    )
  )
  WITH CHECK (
    case_id IN (
      SELECT id FROM funding_cases
      WHERE  company_id IN (SELECT auth_user_company_ids())
    )
  );

-- audit_log: read-only for company members
CREATE POLICY "members_select_audit_log" ON audit_log
  FOR SELECT
  USING (
    funding_case_id IN (
      SELECT id FROM funding_cases
      WHERE  company_id IN (SELECT auth_user_company_ids())
    )
  );

-- ─── 8. RLS on profiles ───────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_profile_select" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "own_profile_update" ON profiles
  FOR UPDATE
  USING     (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ─── 9. RLS on company_members ───────────────────────────────────────────────

ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

-- Members can see their own membership row
CREATE POLICY "own_membership_select" ON company_members
  FOR SELECT USING (user_id = auth.uid());

-- ─── 10. Grants ───────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE ON public.profiles      TO anon, authenticated;
GRANT SELECT                  ON public.company_members TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_company_ids() TO authenticated;

COMMIT;
