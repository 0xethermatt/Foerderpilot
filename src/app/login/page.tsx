'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { sendMagicLinkAction } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-gray-900 dark:bg-gray-100 px-4 py-2.5 text-sm font-medium text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-200 disabled:opacity-50 transition-colors"
    >
      {pending ? 'Sende Link…' : 'Anmelde-Link senden'}
    </button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useFormState(sendMagicLinkAction, null);

  if (state?.sent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <div className="rounded-full bg-green-100 dark:bg-green-900/40 p-3 inline-flex mx-auto">
            <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            E-Mail gesendet
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Falls die Adresse bekannt ist, erhalten Sie einen Anmelde-Link per E-Mail.
            Bitte prüfen Sie auch Ihren Spam-Ordner.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand */}
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Förderpilot
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Anmelden mit Magic Link
          </p>
        </div>

        {/* Form */}
        <form action={formAction} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
            >
              E-Mail-Adresse
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="name@firma.de"
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:border-gray-500 dark:focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-500 dark:focus:ring-gray-400"
            />
          </div>

          {state?.error && (
            <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
          )}

          <SubmitButton />
        </form>

        <p className="text-center text-xs text-gray-400 dark:text-gray-600">
          Nur für autorisierte Mitarbeiter. Kein öffentlicher Zugang.
        </p>
      </div>
    </div>
  );
}
