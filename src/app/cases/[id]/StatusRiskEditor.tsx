'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { updateCaseStatusAction, type UpdateStatusState } from './actions';
import { STATUS_OPTIONS, RISK_LEVEL_OPTIONS } from '@/lib/constants/form-options';
import type { FundingCaseStatus, RiskLevel } from '@/lib/types';

const selectCls =
  'block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-gray-900 dark:bg-gray-100 px-3 py-2 text-sm font-medium text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? 'Speichern…' : 'Speichern'}
    </button>
  );
}

export default function StatusRiskEditor({
  caseId,
  currentStatus,
  currentRisk,
}: {
  caseId: string;
  currentStatus: FundingCaseStatus;
  currentRisk: RiskLevel;
}) {
  const [state, formAction] = useFormState<UpdateStatusState, FormData>(
    updateCaseStatusAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="case_id" value={caseId} />

      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
          Status
        </label>
        <select name="status" defaultValue={currentStatus} className={selectCls}>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
          Risikoeinschätzung
        </label>
        <select name="risk_level" defaultValue={currentRisk} className={selectCls}>
          {RISK_LEVEL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {state?.error && (
        <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 rounded-md px-2.5 py-1.5">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950 rounded-md px-2.5 py-1.5">
          Gespeichert.
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
