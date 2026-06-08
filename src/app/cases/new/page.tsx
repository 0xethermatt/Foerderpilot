import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import NewCaseForm from './NewCaseForm';

export const metadata = { title: 'Neuer Förderfall – Förderpilot' };

export default function NewCasePage() {
  return (
    <div className="max-w-3xl space-y-6">
      {/* Breadcrumb */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
      >
        <ChevronLeft className="h-4 w-4" />
        Zurück zur Übersicht
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Neuer Förderfall
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Kundendaten und Projektinformationen erfassen. Der Antrag wird
          nicht automatisch eingereicht.
        </p>
      </div>

      <NewCaseForm />
    </div>
  );
}
