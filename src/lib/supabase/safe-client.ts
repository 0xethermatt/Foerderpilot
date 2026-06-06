/**
 * Returns true when the required Supabase env vars are present.
 * Use this before calling createClient() in server actions and pages
 * so missing config surfaces as a clear German error instead of a crash.
 */
export function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
