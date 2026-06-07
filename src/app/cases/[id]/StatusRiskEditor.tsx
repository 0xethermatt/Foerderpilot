'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { updateCaseStatusAction, type UpdateStatusState } from './actions';
import { STATUS_OPTIONS, RISK_LEVEL_OPTIONS } from '@/lib/constants/form-options';
import type { FundingCaseStatus, RiskLevel } from '@/lib/types';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? 'Speichern…' : 'Speichern'}
    </button>
  );
}

interface StatusRiskEditorProps {
  caseId: string;
  currentStatus: FundingCaseStatus;
  currentRisk: RiskLevel;
}

export default function StatusRiskEditor({
  caseId,
  currentStatus,
  currentRisk,
}: StatusRiskEditorProps) {
  const [state, formAction] = useFormState<UpdateStatusState, FormData>(
    updateCaseStatusAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="case_id" value={caseId} />

      <div>
        <label className="block text-xs text-gray-500 mb-1">Status</label>
        <select
          name="status"
          defaultValue={currentStatus}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Risikoeinschätzung</label>
        <select
          name="risk_level"
          defaultValue={currentRisk}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
        >
          {RISK_LEVEL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {state?.error && (
        <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1.5">{state.error}</p>
      )}
      {state?.success && (
        <p className="text-xs text-green-700 bg-green-50 rounded px-2 py-1.5">Gespeichert.</p>
      )}

      <SubmitButton />
    </form>
  );
}
