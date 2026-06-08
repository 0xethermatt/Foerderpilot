import { RISK_LABELS } from '@/lib/constants';
import type { RiskLevel } from '@/lib/types';

const RISK_STYLES: Record<RiskLevel, string> = {
  green:  'bg-green-50 text-green-700 ring-green-200 dark:bg-green-950 dark:text-green-300 dark:ring-green-800',
  yellow: 'bg-yellow-50 text-yellow-700 ring-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:ring-yellow-800',
  red:    'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950 dark:text-red-300 dark:ring-red-800',
};

const DOT_STYLES: Record<RiskLevel, string> = {
  green:  'bg-green-500',
  yellow: 'bg-yellow-500',
  red:    'bg-red-500',
};

export default function RiskBadge({ risk }: { risk: RiskLevel }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${RISK_STYLES[risk]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_STYLES[risk]}`} />
      {RISK_LABELS[risk]}
    </span>
  );
}
