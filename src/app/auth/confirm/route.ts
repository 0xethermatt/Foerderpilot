import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type       = searchParams.get('type') as 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'email' | null;
  const next       = searchParams.get('next') ?? '/dashboard';

  if (!token_hash || !type) {
    return NextResponse.redirect(new URL('/login?error=link_invalid', request.url));
  }

  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Route Handlers can set cookies; this catch is defensive.
          }
        },
      },
    },
  );

  const { error } = await supabase.auth.verifyOtp({ token_hash, type });

  if (error) {
    console.error('[auth/confirm]', error.message);
    return NextResponse.redirect(new URL('/login?error=link_expired', request.url));
  }

  // Redirect to the originally requested path (or dashboard).
  const safeNext = next.startsWith('/') ? next : '/dashboard';
  return NextResponse.redirect(new URL(safeNext, request.url));
}
