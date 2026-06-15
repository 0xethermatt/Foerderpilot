import { Clock, CheckCircle2, ArrowDown, Milestone, FolderOpen } from 'lucide-react';
import type { ReadinessSummary, ChecklistItem } from '@/lib/documents/checklist';
import type { Database } from '@/lib/supabase/database.types';
import { computeBzaPreparation } from '@/lib/bza/preparation';
import type { FundingCaseStatus } from '@/lib/types';

type DocumentRow    = Database['public']['Tables']['documents']['Row'];
type AICheckRow     = Database['public']['Tables']['ai_checks']['Row'];
type FundingCaseRow = Database['public']['Tables']['funding_cases']['Row'];

// ─── Post-application messages ────────────────────────────────────────────────

const NEXT_BY_STATUS: Partial<Record<string, { text: string; href?: string }>> = {
  bza_prepared:             { text: 'BzA erstellt – Antrag im KfW-Portal „Meine KfW" manuell einreichen.' },
  application_submitted:    { text: 'Auf Förderzusage von KfW warten. Kein Vorhabenbeginn vor Zusage.', href: '#proof-submission' },
  approval_received:        { text: 'Förderzusage liegt vor – Ausführung freigeben und mit Umsetzung beginnen.', href: '#proof-submission' },
  execution_released:       { text: 'Umsetzung läuft – Nachweise vorbereiten.', href: '#proof-submission' },
  proof_documents_pending:  { text: 'Nachweise hochladen und einreichen.', href: '#proof-submission' },
  proof_submitted:          { text: 'Auf Auszahlung von KfW warten.', href: '#proof-submission' },
  completed:                { text: 'Fall abgeschlossen.' },
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
  caseBzaStatus,
  caseKfwStatus,
}: {
  readiness: ReadinessSummary;
  bzaStatus: 'bereit' | 'fast_bereit' | 'nicht_bereit';
  blockingWarnings: number;
  caseBzaStatus: string;
  caseKfwStatus: string;
}) {
  // Context-aware headline + target section based on workflow sub-step
  const { headline, hint, href } = (() => {
    if (caseKfwStatus === 'approved')
      return { headline: 'Jetzt zu tun: Umsetzung starten', hint: 'Förderzusage erhalten – Umsetzung freigeben und Nachweisphase starten.', href: '#proof-submission' };
    if (caseKfwStatus === 'submitted')
      return { headline: 'Auf KfW-Förderzusage warten', hint: 'Kein Vorhabenbeginn vor schriftlicher Förderzusage.', href: '#proof-submission' };
    if (caseKfwStatus === 'prepared')
      return { headline: 'Jetzt zu tun: Kundenanweisung senden', hint: 'Antrag durch Kunden in „Meine KfW" einreichen lassen.', href: '#kfw-application' };
    if (caseBzaStatus === 'created')
      return { headline: 'Jetzt zu tun: KfW-Antrag vorbereiten', hint: 'BzA erstellt – Kundenanweisung generieren und Antrag vorbereiten.', href: '#kfw-application' };
    if (caseBzaStatus === 'requested')
      return { headline: 'Warte auf BzA-Erstellung', hint: 'Sobald das Fachunternehmen die BzA erstellt hat, Referenznummer eintragen.', href: '#kfw-application' };
    return {
      headline: 'Jetzt zu tun: BzA vorbereiten',
      hint: blockingWarnings > 0
        ? `${blockingWarnings} Problem${blockingWarnings !== 1 ? 'e' : ''} in der BzA-Vorbereitung klären.`
        : 'BzA beim Fachunternehmen / Energieexperten anfordern.',
      href: '#bza-preparation',
    };
  })();

  const borderCls =
    caseKfwStatus === 'submitted' ? 'border-blue-200 dark:border-blue-900' :
    bzaStatus === 'bereit' ? 'border-green-200 dark:border-green-900' :
    bzaStatus === 'fast_bereit' ? 'border-yellow-200 dark:border-yellow-900' :
    'border-orange-200 dark:border-orange-900';

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-lg border ${borderCls} p-5`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{headline}</h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">{hint}</p>
        </div>
        <span className="flex-shrink-0 text-xs text-gray-400 dark:text-gray-500">
          {readiness.reviewed_count}/{readiness.total_required_before_app} Unterlagen
        </span>
      </div>

      <a
        href={href}
        className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-3 py-1.5 text-xs font-medium hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors"
      >
        <ArrowDown className="h-3.5 w-3.5" />
        Öffnen
      </a>
    </div>
  );
}

function PostApplicationPanel({ status }: { status: string }) {
  const entry = NEXT_BY_STATUS[status] ?? { text: 'Weitere Schritte klären.' };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-300 dark:border-gray-800 p-5">
      <div className="flex items-center gap-2 mb-2">
        <Milestone className="h-4 w-4 text-gray-400 dark:text-gray-500" />
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Nächster Schritt</h2>
      </div>
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">{entry.text}</p>
      {entry.href && (
        <a
          href={entry.href}
          className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-3 py-1.5 text-xs font-medium hover:bg-gray-700 dark:hover:bg-gray-100 transition-colors"
        >
          <ArrowDown className="h-3.5 w-3.5" />
          Zur Nachweisphase
        </a>
      )}
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
      caseBzaStatus={fundingCase.bza_status ?? 'not_started'}
      caseKfwStatus={fundingCase.kfw_application_status ?? 'not_started'}
    />
  );
}
