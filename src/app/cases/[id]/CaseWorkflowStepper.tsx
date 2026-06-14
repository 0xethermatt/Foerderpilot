import { Check } from 'lucide-react';
import type { ReadinessSummary } from '@/lib/documents/checklist';
import type { FundingCaseStatus } from '@/lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type StepKey = 'collect' | 'review' | 'bza' | 'kfw' | 'proof';

const STEPS: Array<{ key: StepKey; label: string }> = [
  { key: 'collect', label: 'Unterlagen' },
  { key: 'review',  label: 'Prüfung'   },
  { key: 'bza',     label: 'BzA'       },
  { key: 'kfw',     label: 'KfW'       },
  { key: 'proof',   label: 'Nachweise' },
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

function getSublabel(key: StepKey, readiness: ReadinessSummary): string | null {
  if (key === 'collect') {
    const n = readiness.blocking_count;
    return n === 1 ? '1 Unterlage fehlt' : `${n} Unterlagen fehlen`;
  }
  if (key === 'review') {
    const n = readiness.needs_review_count;
    return n === 1 ? '1 Prüfung offen' : `${n} Prüfungen offen`;
  }
  return null;
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
  const sublabel  = getSublabel(activeKey, readiness);

  return (
    <nav aria-label="Workflow-Fortschritt" className="bg-white dark:bg-gray-900 rounded-lg border border-gray-300 dark:border-gray-800 px-4 py-3">
      <ol className="flex items-start overflow-x-auto">
        {STEPS.map((step, idx) => {
          const done   = idx < activeIdx;
          const active = idx === activeIdx;
          const last   = idx === STEPS.length - 1;

          return (
            <li key={step.key} className="flex items-center flex-shrink-0">
              <div className="flex flex-col items-center gap-0.5 px-1 sm:px-2">
                {/* Circle */}
                <div
                  className={[
                    'flex items-center justify-center h-6 w-6 rounded-full text-xs font-semibold transition-colors',
                    done   ? 'bg-green-500 text-white'
                           : active
                           ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                           : 'bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600',
                  ].join(' ')}
                >
                  {done ? <Check className="h-3 w-3" /> : <span>{idx + 1}</span>}
                </div>

                {/* Label */}
                <span
                  className={[
                    'text-xs font-medium whitespace-nowrap',
                    active   ? 'text-gray-900 dark:text-gray-100'
                             : done
                             ? 'text-gray-500 dark:text-gray-400'
                             : 'text-gray-300 dark:text-gray-600',
                  ].join(' ')}
                >
                  {step.label}
                </span>

                {/* Sublabel – only on active step */}
                {active && sublabel && (
                  <span className="text-xs text-orange-600 dark:text-orange-400 whitespace-nowrap font-normal">
                    {sublabel}
                  </span>
                )}
              </div>

              {!last && (
                <div
                  className={[
                    'h-px w-3 sm:w-5 flex-shrink-0',
                    done ? 'bg-green-400' : 'bg-gray-100 dark:bg-gray-800',
                  ].join(' ')}
                  style={{ marginTop: sublabel && active ? '-22px' : '-14px' }}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
