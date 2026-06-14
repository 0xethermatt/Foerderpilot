import { Clock, CheckCircle2, ArrowDown, Milestone, FolderOpen } from 'lucide-react';
import type { ReadinessSummary, ChecklistItem } from '@/lib/documents/checklist';
import type { Database } from '@/lib/supabase/database.types';
import { computeBzaPreparation } from '@/lib/bza/preparation';
import type { FundingCaseStatus } from '@/lib/types';

type DocumentRow    = Database['public']['Tables']['documents']['Row'];
type AICheckRow     = Database['public']['Tables']['ai_checks']['Row'];
type FundingCaseRow = Database['public']['Tables']['funding_cases']['Row'];

// ─── Post-application messages ────────────────────────────────────────────────

const NEXT_BY_STATUS: Partial<Record<string, string>> = {
  bza_prepared:             'BzA erstellt – Antrag im KfW-Portal „Meine KfW" manuell einreichen.',
  application_submitted:    'Auf Förderzusage von KfW warten. Kein Vorhabenbeginn vor Zusage.',
  approval_received:        'Förderzusage liegt vor – Ausführung freigeben und mit Umsetzung beginnen.',
  execution_released:       'Umsetzung läuft – Nachweise vorbereiten.',
  proof_documents_pending:  'Nachweise hochladen und einreichen.',
  proof_submitted:          'Auf Auszahlung von KfW warten.',
  completed:                'Fall abgeschlossen.',
};

const POST_STATUSES = new Set([
  'bza_prepared', 'application_submitted', 'approval_received',
  'execution_released', 'proof_documents_pending', 'proof_submitted', 'completed',
]);

// ─── Sub-panels ───────────────────────────────────────────────────────────────

function MissingDocsPanel({ checklistItems }: { checklistItems: ChecklistItem[] }) {
  const missing  = checklistItems.filter(
    (i) => i.phase === 'before_application' && i.required && i.status === 'missing',
  );
  const rejected = checklistItems.filter(
    (i) => i.phase === 'before_application' && i.required && i.status === 'rejected',
  );
  const total = missing.length + rejected.length;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-orange-200 dark:border-orange-900 p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-orange-500 flex-shrink-0" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Jetzt zu tun: Unterlagen vervollständigen
          </h2>
        </div>
        <span className="flex-shrink-0 text-xs font-medium text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950 rounded-full px-2 py-0.5">
          {total} offen
        </span>
      </div>

      <ul className="space-y-1.5 mb-4">
        {rejected.map((item) => (
          <li key={item.document_type} className="flex items-start gap-2 text-sm">
            <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-red-500" />
            <span className="text-red-700 dark:text-red-400">
              {item.label_de} – abgelehnt, bitte korrigieren und neu hochladen
            </span>
          </li>
        ))}
        {missing.map((item) => (
          <li key={item.document_type} className="flex items-start gap-2 text-sm">
            <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-orange-300 dark:bg-orange-600" />
            <span className="text-gray-700 dark:text-gray-300">{item.label_de}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        <a
          href="#documents"
          className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-3 py-1.5 text-xs font-medium hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors"
        >
          <ArrowDown className="h-3.5 w-3.5" />
          Dokument hochladen
        </a>
        <a
          href="#tasks"
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Aufgaben erstellen
        </a>
      </div>
    </div>
  );
}

function ReviewNeededPanel({ checklistItems, aiChecks }: { checklistItems: ChecklistItem[]; aiChecks: AICheckRow[] }) {
  const items = checklistItems.filter(
    (i) => i.phase === 'before_application' && i.required && i.status === 'needs_review',
  );

  const latestContractCheck = aiChecks
    .filter((c) => c.check_type === 'contract_check' && c.status === 'completed')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  const latestOfferCheck = aiChecks
    .filter((c) => c.check_type === 'offer_check' && c.status === 'completed')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-yellow-200 dark:border-yellow-900 p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-yellow-500 flex-shrink-0" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Jetzt zu tun: Unterlagen prüfen
          </h2>
        </div>
        <span className="flex-shrink-0 text-xs font-medium text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950 rounded-full px-2 py-0.5">
          {items.length} ausstehend
        </span>
      </div>

      <ul className="space-y-1.5 mb-4">
        {items.map((item) => {
          const checkPending =
            (item.document_type === 'contract' && latestContractCheck?.human_review_status === 'pending') ||
            (item.document_type === 'offer' && latestOfferCheck?.human_review_status === 'pending');
          const hasCheck =
            (item.document_type === 'contract' && latestContractCheck) ||
            (item.document_type === 'offer' && latestOfferCheck);
          return (
            <li key={item.document_type} className="flex items-start gap-2 text-sm">
              <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-yellow-400" />
              <span className="text-gray-700 dark:text-gray-300">
                {item.label_de}
                {checkPending && ' – KI-Prüfung offen, bitte freigeben'}
                {hasCheck && !checkPending && ' – KI-Prüfung vorhanden'}
                {!hasCheck && (item.document_type === 'contract' || item.document_type === 'offer') &&
                  ' – KI-Prüfung empfohlen'}
              </span>
            </li>
          );
        })}
      </ul>

      <a
        href="#documents"
        className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-3 py-1.5 text-xs font-medium hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors"
      >
        <ArrowDown className="h-3.5 w-3.5" />
        Zu den Dokumenten
      </a>
    </div>
  );
}

function BzaReadyPanel({
  readiness,
  bzaStatus,
  blockingWarnings,
}: {
  readiness: ReadinessSummary;
  bzaStatus: 'bereit' | 'fast_bereit' | 'nicht_bereit';
  blockingWarnings: number;
}) {
  const cfg = {
    bereit: {
      border: 'border-green-200 dark:border-green-900',
      badge:  'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      label:  'BzA-Bereit',
    },
    fast_bereit: {
      border: 'border-yellow-200 dark:border-yellow-900',
      badge:  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      label:  'Fast BzA-Bereit',
    },
    nicht_bereit: {
      border: 'border-orange-200 dark:border-orange-900',
      badge:  'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      label:  'Punkte klären',
    },
  }[bzaStatus];

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-lg border ${cfg.border} p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Jetzt zu tun: BzA vorbereiten
            </h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            {readiness.reviewed_count}/{readiness.total_required_before_app} Pflichtunterlagen geprüft.{' '}
            {blockingWarnings > 0
              ? `${blockingWarnings} Problem${blockingWarnings !== 1 ? 'e' : ''} in der BzA-Vorbereitung klären.`
              : 'BzA-Vorbereitung kann gestartet werden.'}
          </p>
        </div>
        <span className={`inline-flex flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.badge}`}>
          {cfg.label}
        </span>
      </div>

      <a
        href="#bza-preparation"
        className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-3 py-1.5 text-xs font-medium hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors"
      >
        <ArrowDown className="h-3.5 w-3.5" />
        BzA-Vorbereitung öffnen
      </a>
    </div>
  );
}

function PostApplicationPanel({ status }: { status: string }) {
  const nextAction = NEXT_BY_STATUS[status] ?? 'Weitere Schritte klären.';

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-300 dark:border-gray-800 p-5">
      <div className="flex items-center gap-2 mb-2">
        <Milestone className="h-4 w-4 text-gray-400 dark:text-gray-500" />
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Nächster Schritt</h2>
      </div>
      <p className="text-sm text-gray-700 dark:text-gray-300">{nextAction}</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CaseWorkspace({
  checklistItems,
  readiness,
  documents,
  aiChecks,
  fundingCase,
}: {
  caseId: string;
  checklistItems: ChecklistItem[];
  readiness: ReadinessSummary;
  documents: DocumentRow[];
  aiChecks: AICheckRow[];
  fundingCase: FundingCaseRow;
}) {
  const status = fundingCase.status as FundingCaseStatus;

  if (POST_STATUSES.has(status)) {
    return <PostApplicationPanel status={status} />;
  }

  if (readiness.blocking_count > 0) {
    return <MissingDocsPanel checklistItems={checklistItems} />;
  }

  if (readiness.needs_review_count > 0) {
    return <ReviewNeededPanel checklistItems={checklistItems} aiChecks={aiChecks} />;
  }

  const bzaPrep       = computeBzaPreparation(checklistItems, readiness, documents, aiChecks);
  const blockingWarns = bzaPrep.warnings.filter((w) => w.level === 'error').length;

  return (
    <BzaReadyPanel
      readiness={readiness}
      bzaStatus={bzaPrep.readinessStatus}
      blockingWarnings={blockingWarns}
    />
  );
}
