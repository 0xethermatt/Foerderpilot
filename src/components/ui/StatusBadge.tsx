import { STATUS_LABELS, STATUS_PHASES } from '@/lib/constants';
import type { FundingCaseStatus } from '@/lib/types';

const PHASE_COLORS: Record<number, string> = {
  0: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  1: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  2: 'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  3: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  4: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
};

function getPhaseIndex(status: FundingCaseStatus): number {
  return STATUS_PHASES.findIndex((p) => p.statuses.includes(status));
}

export default function StatusBadge({ status }: { status: FundingCaseStatus }) {
  const phaseIndex = getPhaseIndex(status);
  const colorClass = PHASE_COLORS[phaseIndex] ?? PHASE_COLORS[0];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
