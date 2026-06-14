import { Zap, FileUp, ScanSearch, Settings, ClipboardList, FileCheck, Archive } from 'lucide-react';
import type { ReadinessSummary, ChecklistItem } from '@/lib/documents/checklist';
import type { Database } from '@/lib/supabase/database.types';
import { isBndIdPlausible } from '@/lib/kfw/proof-submission';

type AICheckRow     = Database['public']['Tables']['ai_checks']['Row'];
type TaskRow        = Database['public']['Tables']['tasks']['Row'];
type FundingCaseRow = Database['public']['Tables']['funding_cases']['Row'];

// ─── Action derivation ────────────────────────────────────────────────────────

type ActionType = 'Dokument' | 'Prüfung' | 'BzA' | 'Nachweise' | 'Export' | 'Aufgabe';

interface DerivedAction {
  label: string;
  type: ActionType;
  href: string;
}

const PRIORITY_RANK: Record<string, number> = { high: 0, normal: 1, low: 2 };

function deriveActions(
  readiness: ReadinessSummary,
  checklistItems: ChecklistItem[],
  aiChecks: AICheckRow[],
  tasks: TaskRow[],
  fundingCase: FundingCaseRow,
): DerivedAction[] {
  const actions: DerivedAction[] = [];

  // 1. Missing / rejected required before-application docs – consolidate into one entry if multiple
  const missingItems = checklistItems.filter(
    (i) =>
      i.phase === 'before_application' &&
      i.required &&
      (i.status === 'missing' || i.status === 'rejected'),
  );
  const rejectedItems = missingItems.filter((i) => i.status === 'rejected');
  if (missingItems.length === 1) {
    const item = missingItems[0];
    actions.push({
      label: item.status === 'rejected'
        ? `${item.label_de} korrigieren und neu hochladen`
        : `${item.label_de} hochladen`,
      type: 'Dokument',
      href: '#documents',
    });
  } else if (rejectedItems.length > 0 && rejectedItems.length < missingItems.length) {
    actions.push({
      label: `${rejectedItems.length} Unterlage${rejectedItems.length !== 1 ? 'n' : ''} korrigieren, ${missingItems.length - rejectedItems.length} hochladen`,
      type: 'Dokument',
      href: '#documents',
    });
  } else if (missingItems.length > 1) {
    const verb = rejectedItems.length === missingItems.length ? 'korrigieren' : 'hochladen';
    actions.push({
      label: `${missingItems.length} Unterlagen ${verb}`,
      type: 'Dokument',
      href: '#documents',
    });
  }

  // 2. AI checks to start (contract/offer uploaded but no completed check yet)
  if (actions.length < 4) {
    const contractItem = checklistItems.find(
      (i) => i.document_type === 'contract' && i.status === 'needs_review',
    );
    const hasContractCheck = aiChecks.some(
      (c) => c.check_type === 'contract_check' && c.status === 'completed',
    );
    if (contractItem && !hasContractCheck) {
      actions.push({ label: 'Vertragsprüfung (KI) starten', type: 'Prüfung', href: '#documents' });
    }

    const offerItem = checklistItems.find(
      (i) => i.document_type === 'offer' && i.status === 'needs_review',
    );
    const hasOfferCheck = aiChecks.some(
      (c) => c.check_type === 'offer_check' && c.status === 'completed',
    );
    if (offerItem && !hasOfferCheck) {
      actions.push({ label: 'Angebotsprüfung (KI) starten', type: 'Prüfung', href: '#documents' });
    }
  }

  // 3. Pending AI check reviews
  if (actions.length < 4) {
    const pendingChecks = aiChecks.filter(
      (c) => c.status === 'completed' && c.human_review_status === 'pending',
    );
    for (const check of pendingChecks.slice(0, 2)) {
      const typeLabel =
        check.check_type === 'contract_check'
          ? 'Vertragsprüfung'
          : check.check_type === 'offer_check'
          ? 'Angebotsprüfung'
          : 'Fördercheck';
      actions.push({ label: `${typeLabel} freigeben oder ablehnen`, type: 'Prüfung', href: '#ai-checks' });
    }
  }

  // 4. BzA / KfW actions (once docs are reviewed)
  if (
    actions.length < 4 &&
    readiness.blocking_count === 0 &&
    readiness.needs_review_count === 0
  ) {
    const bzaStatus     = fundingCase.bza_status ?? 'not_started';
    const kfwStatus     = fundingCase.kfw_application_status ?? 'not_started';
    const bzaIdRaw      = fundingCase.bza_id ?? '';
    const bzaIdPlausible = /^\d{15}$/.test(bzaIdRaw.replace(/[\s\-._]/g, ''));

    if (!fundingCase.bza_responsible_party || fundingCase.bza_responsible_party === 'unclear') {
      actions.push({
        label: 'BzA-Verantwortlichen festlegen',
        type: 'BzA',
        href: '#bza-preparation',
      });
    }

    if (actions.length < 4) {
      if (bzaStatus === 'not_started') {
        actions.push({ label: 'BzA beim Fachunternehmen anfordern', type: 'BzA', href: '#kfw-application' });
      } else if (bzaStatus === 'requested') {
        actions.push({ label: 'BzA-ID eintragen', type: 'BzA', href: '#kfw-application' });
      } else if (bzaStatus === 'created' && !bzaIdPlausible) {
        actions.push({ label: 'BzA-ID eintragen', type: 'BzA', href: '#kfw-application' });
      } else if (bzaStatus === 'created' && bzaIdPlausible && kfwStatus === 'not_started') {
        actions.push({ label: 'KfW-Antrag vorbereiten', type: 'BzA', href: '#kfw-application' });
      } else if (kfwStatus === 'prepared') {
        actions.push({ label: 'Kundenanweisung senden', type: 'BzA', href: '#kfw-application' });
      }
    }
  }

  // 4b. Proof submission actions (once KfW application submitted or approved)
  if (actions.length < 4) {
    const kfwStatus2   = fundingCase.kfw_application_status ?? 'not_started';
    const implStatus   = fundingCase.implementation_status ?? 'not_started';
    const proofStatus  = fundingCase.proof_submission_status ?? 'not_started';
    const payoutStatus = fundingCase.payout_status ?? 'pending';
    const bndPlausible = isBndIdPlausible(fundingCase.bnd_id ?? '');

    if (kfwStatus2 === 'submitted' || kfwStatus2 === 'approved') {
      if (payoutStatus === 'paid') {
        // no further action needed
      } else if (proofStatus === 'submitted') {
        actions.push({ label: 'Auf KfW-Auszahlung warten', type: 'Nachweise', href: '#proof-submission' });
      } else if (proofStatus === 'prepared') {
        actions.push({ label: 'Nachweise durch Kunden einreichen lassen', type: 'Nachweise', href: '#proof-submission' });
      } else if (bndPlausible) {
        actions.push({ label: 'Nachweise intern vorbereiten', type: 'Nachweise', href: '#proof-submission' });
      } else if (implStatus === 'completed') {
        actions.push({ label: 'BnD-ID eintragen', type: 'Nachweise', href: '#proof-submission' });
      } else if (implStatus === 'started') {
        actions.push({ label: 'Umsetzung abwarten – BnD anfordern', type: 'Nachweise', href: '#proof-submission' });
      } else if (kfwStatus2 === 'approved') {
        actions.push({ label: 'Umsetzung starten', type: 'Nachweise', href: '#proof-submission' });
      } else {
        actions.push({ label: 'Auf KfW-Förderzusage warten', type: 'Nachweise', href: '#proof-submission' });
      }
    }
  }

  // 4c. Export CTA – final phases or BzA-ready
  if (actions.length < 4) {
    const payoutStatus = fundingCase.payout_status ?? 'pending';
    const proofStatus2 = fundingCase.proof_submission_status ?? 'not_started';
    const kfwStatus3   = fundingCase.kfw_application_status ?? 'not_started';

    if (payoutStatus === 'paid') {
      actions.push({ label: 'Förderakte exportieren / Fall abschließen', type: 'Export', href: '#export' });
    } else if (proofStatus2 === 'submitted') {
      actions.push({ label: 'Förderakte als Abschlussbericht exportieren', type: 'Export', href: '#export' });
    } else if (kfwStatus3 === 'approved' || kfwStatus3 === 'submitted') {
      actions.push({ label: 'Zwischenstatus exportieren', type: 'Export', href: '#export' });
    }
  }

  // 5. Open tasks (high priority first)
  if (actions.length < 4) {
    const openTasks = tasks
      .filter((t) => !t.completed)
      .sort(
        (a, b) =>
          (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1),
      );
    for (const task of openTasks.slice(0, 4 - actions.length)) {
      actions.push({ label: task.title, type: 'Aufgabe', href: '#tasks' });
    }
  }

  return actions.slice(0, 4);
}

// ─── Styling helpers ──────────────────────────────────────────────────────────

const TYPE_BADGE: Record<ActionType, string> = {
  Dokument:  'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  Prüfung:   'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  BzA:       'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  Nachweise: 'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
  Export:    'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  Aufgabe:   'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
};

const TYPE_ICON: Record<ActionType, React.ReactNode> = {
  Dokument:  <FileUp className="h-3.5 w-3.5" />,
  Prüfung:   <ScanSearch className="h-3.5 w-3.5" />,
  BzA:       <Settings className="h-3.5 w-3.5" />,
  Nachweise: <FileCheck className="h-3.5 w-3.5" />,
  Export:    <Archive className="h-3.5 w-3.5" />,
  Aufgabe:   <ClipboardList className="h-3.5 w-3.5" />,
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function CaseNextActionPanel({
  readiness,
  checklistItems,
  aiChecks,
  tasks,
  fundingCase,
}: {
  readiness: ReadinessSummary;
  checklistItems: ChecklistItem[];
  aiChecks: AICheckRow[];
  tasks: TaskRow[];
  fundingCase: FundingCaseRow;
}) {
  const actions = deriveActions(readiness, checklistItems, aiChecks, tasks, fundingCase);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-300 dark:border-gray-800 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="h-4 w-4 text-amber-500" />
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Nächste Aktionen</h2>
        {actions.length > 0 && (
          <span className="text-xs text-gray-400 dark:text-gray-500">{actions.length}</span>
        )}
      </div>

      {actions.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Alle erfassten Schritte abgeschlossen.
        </p>
      ) : (
        <ol className="space-y-0.5">
          {actions.map((action, idx) => (
            <li key={idx}>
              <a
                href={action.href}
                className="flex items-start gap-2 rounded-md px-2 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
              >
                <span className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 w-4 flex-shrink-0 tabular-nums">
                  {idx + 1}.
                </span>
                <span className="flex-shrink-0 mt-0.5 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300">
                  {TYPE_ICON[action.type]}
                </span>
                <span className="flex-1 min-w-0 text-xs font-medium text-gray-800 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white leading-snug">
                  {action.label}
                </span>
                <span
                  className={`inline-flex flex-shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${TYPE_BADGE[action.type]}`}
                >
                  {action.type}
                </span>
              </a>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
