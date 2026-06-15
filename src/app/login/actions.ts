'use server';

import { createClient } from '@/lib/supabase/server';

export type LoginState = {
  sent?: boolean;
  error?: string;
} | null;

export async function sendMagicLinkAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
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
    // Don't leak whether the email exists — always show a success message.
    // Log server-side only.
    console.error('[magic-link]', error.message);
  }

  // Return sent=true regardless to prevent email enumeration.
  return { sent: true };
}
