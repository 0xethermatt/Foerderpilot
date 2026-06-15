'use server';

import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/service-client';
import { isServiceRoleConfigured } from '@/lib/supabase/safe-client';
import { requireUser, verifyCaseAccess } from '@/lib/auth/session';

export type ProofActionState = { success?: boolean; error?: string } | null;
export type ProofTasksState  = { created?: number; skipped?: number; error?: string } | null;

function validCaseId(v: unknown): string | null {
  const s = typeof v === 'string' ? v : null;
  return s && /^[0-9a-f-]{36}$/i.test(s) ? s : null;
}

async function writeAuditLog(
  supabase: ReturnType<typeof createServiceClient>,
  caseId: string,
  field: string,
  oldValue: string | null,
  newValue: string | null,
) {
  await supabase.from('audit_log').insert({
    funding_case_id: caseId,
    field,
    old_value: oldValue,
    new_value: newValue,
    changed_by: 'internal',
  });
}

export async function markKfwApprovalReceivedAction(
  _prev: ProofActionState,
  formData: FormData,
): Promise<ProofActionState> {
  if (!isServiceRoleConfigured()) return { error: 'Datenbankzugang nicht konfiguriert.' };
  const caseId = validCaseId(formData.get('case_id'));
  if (!caseId) return { error: 'Ungültige Fall-ID.' };

  const user = await requireUser();
  const accessError = await verifyCaseAccess(caseId, user.id);
  if (accessError) return { error: accessError };

  const supabase = createServiceClient();

  const { data: current } = await supabase
    .from('funding_cases')
    .select('kfw_application_status')
    .eq('id', caseId)
    .single();

  const { error } = await supabase
    .from('funding_cases')
    .update({
      kfw_application_status:   'approved',
      kfw_approval_received_at: new Date().toISOString(),
    })
    .eq('id', caseId);

  if (error) return { error: `Fehler: ${error.message}` };

  await writeAuditLog(supabase, caseId, 'kfw_application_status', current?.kfw_application_status ?? null, 'approved');
  revalidatePath(`/cases/${caseId}`);
  return { success: true };
}

export async function markImplementationStartedAction(
  _prev: ProofActionState,
  formData: FormData,
): Promise<ProofActionState> {
  if (!isServiceRoleConfigured()) return { error: 'Datenbankzugang nicht konfiguriert.' };
  const caseId = validCaseId(formData.get('case_id'));
  if (!caseId) return { error: 'Ungültige Fall-ID.' };

  const user = await requireUser();
  const accessError = await verifyCaseAccess(caseId, user.id);
  if (accessError) return { error: accessError };

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('funding_cases')
    .update({
      implementation_status:     'started',
      implementation_started_at: new Date().toISOString(),
    })
    .eq('id', caseId);

  if (error) return { error: `Fehler: ${error.message}` };
  revalidatePath(`/cases/${caseId}`);
  return { success: true };
}

export async function markImplementationCompletedAction(
  _prev: ProofActionState,
  formData: FormData,
): Promise<ProofActionState> {
  if (!isServiceRoleConfigured()) return { error: 'Datenbankzugang nicht konfiguriert.' };
  const caseId = validCaseId(formData.get('case_id'));
  if (!caseId) return { error: 'Ungültige Fall-ID.' };

  const user = await requireUser();
  const accessError = await verifyCaseAccess(caseId, user.id);
  if (accessError) return { error: accessError };

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('funding_cases')
    .update({
      implementation_status:        'completed',
      implementation_completed_at:  new Date().toISOString(),
    })
    .eq('id', caseId);

  if (error) return { error: `Fehler: ${error.message}` };
  revalidatePath(`/cases/${caseId}`);
  return { success: true };
}

export async function updateBndIdAction(
  _prev: ProofActionState,
  formData: FormData,
): Promise<ProofActionState> {
  if (!isServiceRoleConfigured()) return { error: 'Datenbankzugang nicht konfiguriert.' };
  const caseId = validCaseId(formData.get('case_id'));
  if (!caseId) return { error: 'Ungültige Fall-ID.' };

  const user = await requireUser();
  const accessError = await verifyCaseAccess(caseId, user.id);
  if (accessError) return { error: accessError };

  const rawId  = (formData.get('bnd_id') as string | null) ?? '';
  const rawDate = (formData.get('bnd_created_at') as string | null) ?? '';
  const normalId = rawId.replace(/[\s\-._]/g, '');

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('funding_cases')
    .update({
      bnd_id:         normalId   || null,
      bnd_created_at: rawDate    || null,
    })
    .eq('id', caseId);

  if (error) return { error: `Fehler: ${error.message}` };
  revalidatePath(`/cases/${caseId}`);
  return { success: true };
}

export async function markProofPreparedAction(
  _prev: ProofActionState,
  formData: FormData,
): Promise<ProofActionState> {
  if (!isServiceRoleConfigured()) return { error: 'Datenbankzugang nicht konfiguriert.' };
  const caseId = validCaseId(formData.get('case_id'));
  if (!caseId) return { error: 'Ungültige Fall-ID.' };

  const user = await requireUser();
  const accessError = await verifyCaseAccess(caseId, user.id);
  if (accessError) return { error: accessError };

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('funding_cases')
    .update({ proof_submission_status: 'prepared' })
    .eq('id', caseId);

  if (error) return { error: `Fehler: ${error.message}` };
  revalidatePath(`/cases/${caseId}`);
  return { success: true };
}

export async function markProofSubmittedAction(
  _prev: ProofActionState,
  formData: FormData,
): Promise<ProofActionState> {
  if (!isServiceRoleConfigured()) return { error: 'Datenbankzugang nicht konfiguriert.' };
  const caseId = validCaseId(formData.get('case_id'));
  if (!caseId) return { error: 'Ungültige Fall-ID.' };

  const user = await requireUser();
  const accessError = await verifyCaseAccess(caseId, user.id);
  if (accessError) return { error: accessError };

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('funding_cases')
    .update({
      proof_submission_status: 'submitted',
      proof_submitted_at:      new Date().toISOString(),
    })
    .eq('id', caseId);

  if (error) return { error: `Fehler: ${error.message}` };

  await writeAuditLog(supabase, caseId, 'proof_submission_status', 'prepared', 'submitted');
  revalidatePath(`/cases/${caseId}`);
  return { success: true };
}

export async function markPayoutPaidAction(
  _prev: ProofActionState,
  formData: FormData,
): Promise<ProofActionState> {
  if (!isServiceRoleConfigured()) return { error: 'Datenbankzugang nicht konfiguriert.' };
  const caseId = validCaseId(formData.get('case_id'));
  if (!caseId) return { error: 'Ungültige Fall-ID.' };

  const user = await requireUser();
  const accessError = await verifyCaseAccess(caseId, user.id);
  if (accessError) return { error: accessError };

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('funding_cases')
    .update({ payout_status: 'paid' })
    .eq('id', caseId);

  if (error) return { error: `Fehler: ${error.message}` };

  await writeAuditLog(supabase, caseId, 'payout_status', 'pending', 'paid');
  revalidatePath(`/cases/${caseId}`);
  return { success: true };
}

export async function resetProofSubmissionAction(
  _prev: ProofActionState,
  formData: FormData,
): Promise<ProofActionState> {
  if (!isServiceRoleConfigured()) return { error: 'Datenbankzugang nicht konfiguriert.' };
  const caseId = validCaseId(formData.get('case_id'));
  if (!caseId) return { error: 'Ungültige Fall-ID.' };

  const user = await requireUser();
  const accessError = await verifyCaseAccess(caseId, user.id);
  if (accessError) return { error: accessError };

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('funding_cases')
    .update({
      kfw_approval_received_at:    null,
      implementation_status:       'not_started',
      implementation_started_at:   null,
      implementation_completed_at: null,
      bnd_id:                      null,
      bnd_created_at:              null,
      proof_submission_status:     'not_started',
      proof_submitted_at:          null,
      payout_status:               'pending',
    })
    .eq('id', caseId);

  if (error) return { error: `Fehler: ${error.message}` };

  await writeAuditLog(supabase, caseId, 'proof_submission_status', null, 'reset');
  revalidatePath(`/cases/${caseId}`);
  return { success: true };
}

const PROOF_TASK_DEFS = [
  {
    title:       'BnD vom Fachunternehmen anfordern',
    description: 'Bestätigung nach Durchführung (BnD) beim ausführenden Fachunternehmen anfordern. BnD-ID eintragen sobald vorhanden.',
    priority:    'high' as const,
  },
  {
    title:       'Rechnung prüfen und hochladen',
    description: 'Schlussrechnung des Fachunternehmens prüfen und als Nachweis hochladen.',
    priority:    'high' as const,
  },
  {
    title:       'Nachweise in „Meine KfW" einreichen',
    description: 'Kunden anweisen, Rechnung und BnD in „Meine KfW" hochzuladen und einzureichen. Keine automatische Einreichung.',
    priority:    'normal' as const,
  },
] as const;

export async function createProofTasksAction(
  _prev: ProofTasksState,
  formData: FormData,
): Promise<ProofTasksState> {
  if (!isServiceRoleConfigured()) return { error: 'Datenbankzugang nicht konfiguriert.' };

  const caseId = validCaseId(formData.get('case_id'));
  if (!caseId) return { error: 'Ungültige Fall-ID.' };

  const user = await requireUser();
  const accessError = await verifyCaseAccess(caseId, user.id);
  if (accessError) return { error: accessError };

  const supabase = createServiceClient();

  const { data: existingTasks } = await supabase
    .from('tasks')
    .select('title')
    .eq('funding_case_id', caseId)
    .eq('completed', false);

  const existingTitles = new Set((existingTasks ?? []).map((t) => t.title));

  let created = 0;
  let skipped = 0;

  for (const task of PROOF_TASK_DEFS) {
    if (existingTitles.has(task.title)) {
      skipped++;
      continue;
    }
    const { error } = await supabase.from('tasks').insert({
      funding_case_id: caseId,
      title:           task.title,
      description:     task.description,
      priority:        task.priority,
    });
    if (!error) created++;
  }

  revalidatePath(`/cases/${caseId}`);
  return { created, skipped };
}
