import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const code       = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type       = searchParams.get('type') as
    | 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'email'
    | null;
  const next       = searchParams.get('next') ?? '/dashboard';
  const safeNext   = next.startsWith('/') ? next : '/dashboard';

  console.log('[auth/confirm] reached — has code:', !!code, '| has token_hash:', !!token_hash, '| type:', type);

  if (!code && (!token_hash || !type)) {
    console.error('[auth/confirm] missing params — redirecting to /login?error=link_invalid');
    return NextResponse.redirect(new URL('/login?error=link_invalid', request.url));
  }

  // Collect cookies to set so we can attach them to the redirect response.
  const pendingCookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Read from the incoming request (carries PKCE verifier if set during sign-in).
        getAll() {
          return request.cookies.getAll();
        },
        // Buffer cookies — we'll write them onto the redirect response below.
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            pendingCookies.push({ name, value, options: options ?? {} });
          }
        },
      },
    },
  );

  let authErrorMsg: string | null = null;

  if (code) {
    // PKCE flow — exchange authorization code for session.
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) authErrorMsg = error.message;
  } else {
    // OTP / token-hash flow.
    const { error } = await supabase.auth.verifyOtp({ token_hash: token_hash!, type: type! });
    if (error) authErrorMsg = error.message;
  }

  if (authErrorMsg) {
    console.error('[auth/confirm] auth failed:', authErrorMsg);
    return NextResponse.redirect(new URL('/login?error=link_expired', request.url));
  }

  // Verify a session was actually created.
  const { data: { user } } = await supabase.auth.getUser();
  console.log('[auth/confirm] auth success:', !authErrorMsg, '| user id exists:', !!user?.id);

  if (!user) {
    console.error('[auth/confirm] no user after auth — redirecting to /login?error=link_expired');
    return NextResponse.redirect(new URL('/login?error=link_expired', request.url));
  }

  // Build the redirect response and attach all session cookies to it.
  // This is critical: NextResponse.redirect() does NOT inherit cookies set via
  // cookies().set() from next/headers — they must be set on the response object.
  const response = NextResponse.redirect(new URL(safeNext, request.url));
  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
  }

  return response;
}
