'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { ClipboardCheck } from 'lucide-react';
import { createMissingDocumentTasksAction } from './checklist-actions';
import type { CreateTasksState } from './checklist-actions';
import type { ChecklistItem, ReadinessSummary, DocumentPhase } from '@/lib/documents/checklist';

// ─── Constants ────────────────────────────────────────────────────────────────

const PHASE_ORDER: DocumentPhase[] = [
  'before_application',
  'after_approval',
  'after_completion',
  'other',
];

const PHASE_LABELS: Record<DocumentPhase, string> = {
  before_application: 'Vor Antragstellung',
  after_approval:     'Nach Förderzusage',
  after_completion:   'Nach Umsetzung',
  other:              'Sonstiges',
};

const READINESS_BADGE: Record<string, string> = {
  red:    'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
  green:  'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
};

const STATUS_DOT: Record<string, string> = {
  missing:      'bg-gray-300',
  needs_review: 'bg-yellow-400',
  reviewed:     'bg-green-500',
  rejected:     'bg-red-400',
};

const STATUS_BADGE: Record<string, string> = {
  missing:      'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  needs_review: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
  reviewed:     'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
  rejected:     'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
};

const STATUS_LABEL: Record<string, string> = {
  missing:      'Fehlend',
  needs_review: 'Ausstehend',
  reviewed:     'Geprüft',
  rejected:     'Abgelehnt',
};

// ─── Create tasks form ────────────────────────────────────────────────────────

function CreateTasksForm({ caseId }: { caseId: string }) {
  const [state, formAction] = useFormState<CreateTasksState, FormData>(
    createMissingDocumentTasksAction,
    null,
  );

  if (state?.success && !state.created) {
    return (
      <p className="text-xs text-gray-400 mt-3">Alle Aufgaben bereits vorhanden.</p>
    );
  }

  if (state?.success && state.created) {
    return (
      <p className="text-xs text-green-700 mt-3">
        {state.created} Aufgabe{state.created !== 1 ? 'n' : ''} erstellt.
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-3">
      <input type="hidden" name="case_id" value={caseId} />
      {state?.error && (
        <p className="text-xs text-red-600 dark:text-red-400 mb-1.5">{state.error}</p>
      )}
      <CreateTasksButton />
    </form>
  );
}

function CreateTasksButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
    >
      {pending ? 'Wird erstellt…' : 'Fehlende Aufgaben erstellen'}
    </button>
  );
}

// ─── Checklist row ────────────────────────────────────────────────────────────

function ChecklistRow({ item }: { item: ChecklistItem }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <span
        className={`mt-1.5 flex-shrink-0 h-2 w-2 rounded-full ${STATUS_DOT[item.status] ?? 'bg-gray-300'}`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`text-sm ${item.blocking ? 'font-medium text-red-700 dark:text-red-400' : 'text-gray-800 dark:text-gray-200'}`}
          >
            {item.label_de}
          </span>
          <span
            className={`inline-flex rounded-full px-1.5 py-0.5 text-xs font-medium ${STATUS_BADGE[item.status] ?? ''}`}
          >
            {STATUS_LABEL[item.status] ?? item.status}
          </span>
        </div>
        {item.latest_filename && (
          <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{item.latest_filename}</p>
        )}
        {item.hint_de && (
          <p className="text-xs text-gray-400 dark:text-gray-500 italic mt-0.5">{item.hint_de}</p>
        )}
      </div>
    </div>
  );
}

// ─── Phase group ──────────────────────────────────────────────────────────────

function PhaseGroup({ phase, items }: { phase: DocumentPhase; items: ChecklistItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">
        {PHASE_LABELS[phase]}
      </p>
      {items.map((item) => (
        <ChecklistRow key={item.document_type} item={item} />
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FundingChecklistSection({
  caseId,
  items,
  readiness,
}: {
  caseId: string;
  items: ChecklistItem[];
  readiness: ReadinessSummary;
}) {
  const grouped: Record<DocumentPhase, ChecklistItem[]> = {
    before_application: [],
    after_approval:     [],
    after_completion:   [],
    other:              [],
  };
  for (const item of items) {
    grouped[item.phase].push(item);
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-gray-400 dark:text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Förderakte-Checkliste</h2>
        </div>
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium flex-shrink-0 ${READINESS_BADGE[readiness.state] ?? ''}`}
        >
          {readiness.label_de}
        </span>
      </div>

      {/* Progress summary */}
      <div className="mt-2 text-xs space-y-0.5">
        <p className="text-gray-500 dark:text-gray-400">
          {readiness.reviewed_count}/{readiness.total_required_before_app} Pflichtunterlagen
          geprüft
        </p>
        {readiness.blocking_count > 0 && (
          <p className="text-red-600 dark:text-red-400">{readiness.blocking_count} fehlend / blockierend</p>
        )}
        {readiness.needs_review_count > 0 && (
          <p className="text-yellow-700 dark:text-yellow-400">{readiness.needs_review_count} ausstehend</p>
        )}
      </div>

      {/* Grouped checklist */}
      {PHASE_ORDER.map((phase) => (
        <PhaseGroup key={phase} phase={phase} items={grouped[phase]} />
      ))}

      {/* Create tasks button — only when blocking items exist */}
      {readiness.blocking_count > 0 && <CreateTasksForm caseId={caseId} />}
    </div>
  );
}
