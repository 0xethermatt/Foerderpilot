'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/service-client';
import { isServiceRoleConfigured } from '@/lib/supabase/safe-client';

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  case_id: z.string().uuid(),
  status: z.enum([
    'lead_received',
    'data_missing',
    'funding_check_done',
    'offer_created',
    'contract_review_needed',
    'contract_signed',
    'bza_prepared',
    'application_submitted',
    'approval_received',
    'execution_released',
    'proof_documents_pending',
    'proof_submitted',
    'completed',
  ]),
  risk_level: z.enum(['green', 'yellow', 'red']),
});

// ─── State type ───────────────────────────────────────────────────────────────

export type UpdateStatusState = {
  error?: string;
  success?: boolean;
} | null;

// ─── Action ───────────────────────────────────────────────────────────────────

export async function updateCaseStatusAction(
  _prev: UpdateStatusState,
  formData: FormData,
): Promise<UpdateStatusState> {
  if (!isServiceRoleConfigured()) {
    return { error: 'Datenbankzugang nicht konfiguriert.' };
  }

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: 'Ungültige Eingabe.' };
  }

  const { case_id, status, risk_level } = parsed.data;
  const supabase = createServiceClient();

  // Fetch current values for audit log
  const { data: current } = await supabase
    .from('funding_cases')
    .select('status, risk_level')
    .eq('id', case_id)
    .single();

  // Apply update
  const { error } = await supabase
    .from('funding_cases')
    .update({ status, risk_level })
    .eq('id', case_id);

  if (error) {
    return { error: `Fehler beim Speichern: ${error.message}` };
  }

  // Audit log — best effort, never blocks the main update
  try {
    const entries: {
      funding_case_id: string;
      field: string;
      old_value: string | null;
      new_value: string;
      changed_by: string;
    }[] = [];

    if (current && current.status !== status) {
      entries.push({
        funding_case_id: case_id,
        field: 'status',
        old_value: current.status,
        new_value: status,
        changed_by: 'admin',
      });
    }
    if (current && current.risk_level !== risk_level) {
      entries.push({
        funding_case_id: case_id,
        field: 'risk_level',
        old_value: current.risk_level,
        new_value: risk_level,
        changed_by: 'admin',
      });
    }

    if (entries.length > 0) {
      await supabase.from('audit_log').insert(entries);
    }
  } catch {
    // Intentionally ignored — audit log is optional
  }

  revalidatePath(`/cases/${case_id}`);
  revalidatePath('/dashboard');

  return { success: true };
}
