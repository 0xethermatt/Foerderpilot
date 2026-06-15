'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { sendMagicLinkAction, passwordLoginAction } from './actions';
import type { MagicLinkState, PasswordLoginState } from './actions';

// ─── URL error messages from the /auth/confirm callback ───────────────────────

const URL_ERROR_MESSAGES: Record<string, string> = {
  link_expired: 'Dieser Link ist abgelaufen oder wurde bereits verwendet. Bitte erneut anmelden.',
  link_invalid: 'Ungültiger Anmelde-Link. Bitte fordern Sie einen neuen Link an.',
};

// ─── Shared input style ───────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:border-gray-500 dark:focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-500 dark:focus:ring-gray-400';

// ─── Submit buttons ───────────────────────────────────────────────────────────

function PasswordSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-gray-900 dark:bg-gray-100 px-4 py-2.5 text-sm font-medium text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-200 disabled:opacity-50 transition-colors"
    >
      {pending ? 'Anmelden…' : 'Mit Passwort anmelden'}
    </button>
  );
}

function MagicLinkSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
    >
      {pending ? 'Sende Link…' : 'Magic Link senden'}
    </button>
  );
}

// ─── Password login form ──────────────────────────────────────────────────────

function PasswordForm({ next, urlError }: { next?: string; urlError?: string }) {
  const [state, formAction] = useFormState<PasswordLoginState, FormData>(passwordLoginAction, null);

  const urlErrMsg = urlError
    ? (URL_ERROR_MESSAGES[urlError] ?? 'Anmeldung fehlgeschlagen. Bitte erneut versuchen.')
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

// ─── Magic link form ──────────────────────────────────────────────────────────

function MagicLinkForm() {
  const [state, formAction] = useFormState<MagicLinkState, FormData>(sendMagicLinkAction, null);

  if (state?.sent) {
    return (
      <p className="text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md px-3 py-2 text-center">
        Link gesendet — bitte Posteingang (und Spam) prüfen.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex gap-2">
      <input
        name="email"
        type="email"
        autoComplete="email"
        required
        placeholder="name@firma.de"
        className={`${inputCls} flex-1`}
      />
      <MagicLinkSubmitButton />
    </form>
  );
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function LoginForm({
  urlError,
  next,
}: {
  urlError?: string;
  next?: string;
}) {
  return (
    <div className="w-full max-w-sm space-y-6">
      {/* Brand */}
      <div className="text-center">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Förderpilot</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Interne Förderakte</p>
      </div>

      {/* Primary: password login */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-5 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          Demo-Login mit Passwort
        </p>
        <PasswordForm next={next} urlError={urlError} />
      </div>

      <p className="text-center text-xs text-gray-400 dark:text-gray-600">
        Nur für autorisierte Mitarbeiter. Kein öffentlicher Zugang.
      </p>
    </div>
  );
}
