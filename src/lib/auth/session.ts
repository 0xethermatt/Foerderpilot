import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service-client';

// Returns the authenticated user, or null if not signed in.
export async function getCurrentUser(): Promise<User | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Returns the authenticated user or redirects to /login.
// Call from Server Components and Server Actions that require authentication.
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

// Returns the company_id for the given user, or null if they have no membership.
export async function getUserCompanyId(userId: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', userId)
    .limit(1)
    .single();
  return data?.company_id ?? null;
}

// Verifies the authenticated user's company owns the given case.
// Returns null on success, or an error string that can be returned as { error }.
export async function verifyCaseAccess(
  caseId: string,
  userId: string,
): Promise<string | null> {
  const supabase = createServiceClient();

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', userId)
    .limit(1)
    .single();

  if (!membership) return 'Kein Unternehmen zugeordnet.';

  const { data: fundingCase } = await supabase
    .from('funding_cases')
    .select('id')
    .eq('id', caseId)
    .eq('company_id', membership.company_id)
    .single();

  if (!fundingCase) return 'Zugriff verweigert.';

  return null;
}

// Sign-out server action — called from the user menu form.
export async function signOutAction(): Promise<void> {
  'use server';
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
