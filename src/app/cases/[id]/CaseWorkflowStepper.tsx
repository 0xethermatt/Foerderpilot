import { Check } from 'lucide-react';
import type { ReadinessSummary } from '@/lib/documents/checklist';
import type { FundingCaseStatus } from '@/lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type StepKey = 'collect' | 'review' | 'bza' | 'kfw' | 'proof';

const STEPS: Array<{ key: StepKey; label: string }> = [
  { key: 'collect', label: 'Unterlagen sammeln' },
  { key: 'review',  label: 'Dokumente prüfen'  },
  { key: 'bza',     label: 'BzA vorbereiten'   },
  { key: 'kfw',     label: 'KfW-Antrag'        },
  { key: 'proof',   label: 'Nachweise'          },
];

const STEP_IDX: Record<StepKey, number> = {
  collect: 0, review: 1, bza: 2, kfw: 3, proof: 4,
};

const POST_SUBMIT_STATUSES = new Set<string>([
  'approval_received', 'execution_released', 'proof_documents_pending', 'proof_submitted', 'completed',
]);
const KFW_STATUSES = new Set<string>(['bza_prepared', 'application_submitted']);

function resolveStep(readiness: ReadinessSummary, status: string): StepKey {
  if (POST_SUBMIT_STATUSES.has(status)) return 'proof';
  if (KFW_STATUSES.has(status))         return 'kfw';
  if (readiness.blocking_count === 0 && readiness.needs_review_count === 0) return 'bza';
  if (readiness.blocking_count === 0)   return 'review';
  return 'collect';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CaseWorkflowStepper({
  readiness,
  status,
}: {
  readiness: ReadinessSummary;
  status: FundingCaseStatus;
}) {
  const activeKey = resolveStep(readiness, status);
  const activeIdx = STEP_IDX[activeKey];

  return (
    <nav aria-label="Workflow-Fortschritt" className="bg-white dark:bg-gray-900 rounded-lg border border-gray-300 dark:border-gray-800 px-4 py-3.5">
      <ol className="flex items-start overflow-x-auto pb-0.5">
        {STEPS.map((step, idx) => {
          const done   = idx < activeIdx;
          const active = idx === activeIdx;
          const last   = idx === STEPS.length - 1;

          return (
            <li key={step.key} className="flex items-center flex-shrink-0">
              <div className="flex flex-col items-center gap-1 px-1.5 sm:px-2.5">
                <div
                  className={[
                    'flex items-center justify-center h-6 w-6 rounded-full text-xs font-semibold transition-colors',
                    done   ? 'bg-green-500 text-white'
                           : active
                           ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                           : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500',
                  ].join(' ')}
                >
                  {done ? <Check className="h-3 w-3" /> : <span>{idx + 1}</span>}
                </div>
                <span
                  className={[
                    'text-xs font-medium whitespace-nowrap',
                    active ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500',
                  ].join(' ')}
                >
                  {step.label}
                </span>
              </div>
              {!last && (
                <div
                  className={[
                    'h-px w-4 sm:w-6 flex-shrink-0 mt-[-10px]',
                    idx < activeIdx ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-700',
                  ].join(' ')}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
