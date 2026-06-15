'use client';

import Image from 'next/image';
import { useFormState, useFormStatus } from 'react-dom';
import { passwordLoginAction } from './actions';
import type { PasswordLoginState } from './actions';

// ─── URL error messages from /auth/confirm callback or Supabase redirect ──────

const URL_ERROR_MESSAGES: Record<string, string> = {
  link_expired:  'Dieser Link ist abgelaufen oder wurde bereits verwendet. Bitte erneut anmelden.',
  link_invalid:  'Ungültiger Anmelde-Link. Bitte fordern Sie einen neuen Link an.',
  otp_expired:   'Dieser Link ist abgelaufen oder wurde bereits verwendet. Bitte erneut anmelden.',
  access_denied: 'Zugriff verweigert. Bitte prüfen Sie Ihren Anmelde-Link.',
};

// ─── Shared input style ───────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:border-gray-500 dark:focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-500 dark:focus:ring-gray-400';

// ─── Submit button ────────────────────────────────────────────────────────────

function PasswordSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-gray-900 dark:bg-gray-100 px-4 py-2.5 text-sm font-medium text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-200 disabled:opacity-50 transition-colors"
    >
      {pending ? 'Anmelden…' : 'Anmelden'}
    </button>
  );
}

// ─── Password form ────────────────────────────────────────────────────────────

function PasswordForm({
  next,
  urlError,
  urlErrorDescription,
}: {
  next?: string;
  urlError?: string;
  urlErrorDescription?: string;
}) {
  const [state, formAction] = useFormState<PasswordLoginState, FormData>(passwordLoginAction, null);

  const urlErrMsg = urlError
    ? (URL_ERROR_MESSAGES[urlError] ?? urlErrorDescription ?? 'Anmeldung fehlgeschlagen. Bitte erneut versuchen.')
    : undefined;

  const errorMessage = state?.error ?? urlErrMsg;

  return (
    <form action={formAction} className="space-y-3">
      {next && <input type="hidden" name="next" value={next} />}

      <div>
        <label htmlFor="pw-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          E-Mail-Adresse
        </label>
        <input
          id="pw-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="name@firma.de"
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="pw-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Passwort
        </label>
        <input
          id="pw-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          className={inputCls}
        />
      </div>

      {errorMessage && (
        <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2">
          {errorMessage}
        </p>
      )}

      <PasswordSubmitButton />
    </form>
  );
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function LoginForm({
  urlError,
  urlErrorDescription,
  next,
}: {
  urlError?: string;
  urlErrorDescription?: string;
  next?: string;
}) {
  return (
    <div className="w-full max-w-sm space-y-6">
      {/* Brand */}
      <div className="text-center">
        <div className="mx-auto mb-5 inline-flex items-center justify-center bg-white dark:bg-white rounded-2xl shadow-md px-6 py-4">
          <Image
            src="/brand/foerderpilot-logo.png"
            alt="Förderpilot"
            width={192}
            height={128}
            className="block"
            priority
          />
        </div>
        <h1 className="sr-only">Förderpilot</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Interne Förderakte für Heizungsförderung</p>
      </div>

      {/* Login form */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-5 space-y-4">
        <PasswordForm next={next} urlError={urlError} urlErrorDescription={urlErrorDescription} />
      </div>

      <p className="text-center text-xs text-gray-400 dark:text-gray-600">
        Nur für autorisierte Mitarbeiter. Kein öffentlicher Zugang.
      </p>
    </div>
  );
}
