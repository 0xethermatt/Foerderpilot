import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// ─── Service-role client ──────────────────────────────────────────────────────
// Bypasses RLS — use ONLY in server actions, Route Handlers, and Server
// Components. NEVER import or call this in client components or browser code.
// TODO (production): Replace mutations with auth-scoped anon client + policies.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL not set. ' +
        'Copy .env.local.example to .env.local and fill in the values.',
    );
  }

  return createSupabaseClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
