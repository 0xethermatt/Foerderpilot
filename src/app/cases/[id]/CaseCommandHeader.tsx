import Link from 'next/link';
import { ChevronLeft, ClipboardList, FileUp, Sparkles } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';
import RiskBadge from '@/components/ui/RiskBadge';
import type { FundingCaseStatus, RiskLevel } from '@/lib/types';
import type { ReadinessSummary } from '@/lib/documents/checklist';
import type { Database } from '@/lib/supabase/database.types';

type FundingCaseRow = Database['public']['Tables']['funding_cases']['Row'];
type CustomerRow = Database['public']['Tables']['customers']['Row'];
type TaskRow = Database['public']['Tables']['tasks']['Row'];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function ReadinessBadge({ readiness }: { readiness: ReadinessSummary }) {
  const cls = {
    red: 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
    yellow: 'bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
    green: 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
  }[readiness.state];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {readiness.label_de}
    </span>
  );
}

function deriveNextAction(readiness: ReadinessSummary, status: FundingCaseStatus): string {
  if (status === 'completed') return 'Fall ist abgeschlossen.';
  if (readiness.blocking_count > 0) {
    const n = readiness.blocking_count;
    return `${n} Pflichtunterlage${n > 1 ? 'n fehlen' : ' fehlt'} – bitte beim Kunden anfordern.`;
  }
  if (readiness.needs_review_count > 0) {
    const n = readiness.needs_review_count;
    return `${n} Dokument${n > 1 ? 'e warten' : ' wartet'} auf Prüfung.`;
  }
  if (status === 'lead_received' || status === 'data_missing') return 'Kundendaten vervollständigen.';
  if (status === 'funding_check_done') return 'Angebot erstellen und Vertrag vorbereiten.';
  if (status === 'offer_created' || status === 'contract_review_needed') return 'Vertrag prüfen und unterzeichnen.';
  if (status === 'contract_signed') return 'BZA vorbereiten und Antrag stellen.';
  if (status === 'bza_prepared') return 'Antrag bei KfW/BAFA einreichen.';
  if (status === 'application_submitted') return 'Auf Genehmigung von KfW/BAFA warten.';
  if (status === 'approval_received') return 'Ausführung freigeben.';
  if (status === 'execution_released') return 'Ausführung läuft – Nachweise vorbereiten.';
  if (status === 'proof_documents_pending') return 'Nachweise hochladen und einreichen.';
  if (status === 'proof_submitted') return 'Auf Auszahlung warten.';
  return 'Unterlagen vollständig – Antrag vorbereiten.';
}

export default function CaseCommandHeader({
  fundingCase,
  customer,
  tasks,
  readiness,
}: {
  fundingCase: FundingCaseRow;
  customer: CustomerRow | null;
  tasks: TaskRow[];
  readiness: ReadinessSummary;
}) {
  const openTaskCount = tasks.filter((t) => !t.completed).length;
  const nextAction = deriveNextAction(readiness, fundingCase.status as FundingCaseStatus);

  const projectAddress = [
    fundingCase.project_address_street,
    fundingCase.project_address_postal_code && fundingCase.project_address_city
      ? `${fundingCase.project_address_postal_code} ${fundingCase.project_address_city}`
      : fundingCase.project_address_city ?? fundingCase.project_address_postal_code,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
      >
        <ChevronLeft className="h-4 w-4" />
        Zurück zur Übersicht
      </Link>

      {/* Command card */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-300 dark:border-gray-800 p-5">
        {/* Title + badges */}
        <div className="flex flex-wrap items-start gap-3 mb-3">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex-1 min-w-0">
            {fundingCase.title}
          </h1>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            <StatusBadge status={fundingCase.status as FundingCaseStatus} />
            <RiskBadge risk={fundingCase.risk_level as RiskLevel} />
            <ReadinessBadge readiness={readiness} />
          </div>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400 mb-4">
          {customer && (
            <span>{customer.first_name} {customer.last_name}</span>
          )}
          {projectAddress && <span>{projectAddress}</span>}
          <span>
            {readiness.reviewed_count}/{readiness.total_required_before_app} Pflichtunterlagen geprüft
          </span>
          {openTaskCount > 0 && (
            <span className="text-orange-600 dark:text-orange-400 font-medium">
              {openTaskCount} offene Aufgabe{openTaskCount !== 1 ? 'n' : ''}
            </span>
          )}
          <span>Zuletzt geändert {formatDate(fundingCase.updated_at)}</span>
        </div>

        {/* Next action banner */}
        <div className="flex flex-wrap items-center gap-2 mb-5 px-3 py-2.5 rounded-md bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/60">
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 flex-shrink-0 uppercase tracking-wide">
            Nächste Aktion
          </p>
          <p className="text-sm text-gray-800 dark:text-gray-200 flex-1">{nextAction}</p>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2">
          <a
            href="#tasks"
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <ClipboardList className="h-3.5 w-3.5" />
            Aufgaben
          </a>
          <a
            href="#documents"
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <FileUp className="h-3.5 w-3.5" />
            Dokument hochladen
          </a>
          <a
            href="#ai-checks"
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" />
            KI-Fördercheck
          </a>
        </div>
      </div>
    </div>
  );
}
