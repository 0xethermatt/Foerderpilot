'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// ─── Magic link ───────────────────────────────────────────────────────────────

export type MagicLinkState = {
  sent?: boolean;
  error?: string;
} | null;

export async function sendMagicLinkAction(
  _prev: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const email = (formData.get('email') as string | null)?.trim() ?? '';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Bitte eine gültige E-Mail-Adresse eingeben.' };
  }

  const supabase = createClient();

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${siteUrl}/auth/confirm`,
    },
  });

  if (error) {
    console.error('[magic-link]', error.message);
    const isRateLimited =
      error.status === 429 || /rate.?limit|too many/i.test(error.message);
    if (isRateLimited) {
      return {
        error:
          'Der Anmelde-Link konnte nicht gesendet werden. Bitte später erneut versuchen oder Passwort-Login nutzen.',
      };
    }
  }

  // Return sent=true for all other cases to prevent email enumeration.
  return { sent: true };
}

// ─── Password login ───────────────────────────────────────────────────────────

export type PasswordLoginState = {
  error?: string;
} | null;

export async function passwordLoginAction(
  _prev: PasswordLoginState,
  formData: FormData,
): Promise<PasswordLoginState> {
  const email    = (formData.get('email') as string | null)?.trim() ?? '';
  const password = (formData.get('password') as string | null) ?? '';
  const next     = (formData.get('next') as string | null) ?? '/dashboard';

  if (!email || !password) {
    return { error: 'E-Mail und Passwort sind erforderlich.' };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error('[password-login]', error.message);
    return { error: 'Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen.' };
  }

  // In a server action, cookies().set() calls made by the Supabase client
  // (via setAll) are automatically included in the redirect response by Next.js.
  const safeNext = next.startsWith('/') ? next : '/dashboard';
  redirect(safeNext);
}
