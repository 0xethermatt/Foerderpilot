import { STATUS_LABELS, STATUS_PHASES } from '@/lib/constants';
import type { FundingCaseStatus } from '@/lib/types';

const PHASE_COLORS: Record<number, string> = {
  0: 'bg-slate-100 text-slate-700',
  1: 'bg-blue-50 text-blue-700',
  2: 'bg-violet-50 text-violet-700',
  3: 'bg-amber-50 text-amber-700',
  4: 'bg-green-50 text-green-700',
};

function getPhaseIndex(status: FundingCaseStatus): number {
  return STATUS_PHASES.findIndex((p) => p.statuses.includes(status));
}

interface StatusBadgeProps {
  status: FundingCaseStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const phaseIndex = getPhaseIndex(status);
  const colorClass = PHASE_COLORS[phaseIndex] ?? 'bg-slate-100 text-slate-700';

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
