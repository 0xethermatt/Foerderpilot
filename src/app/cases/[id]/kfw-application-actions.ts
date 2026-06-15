'use server';

import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/service-client';
import { isServiceRoleConfigured } from '@/lib/supabase/safe-client';
import { requireUser, verifyCaseAccess } from '@/lib/auth/session';

export type KfwActionState = { success?: boolean; error?: string } | null;

function validCaseId(v: unknown): string | null {
  const s = typeof v === 'string' ? v : null;
  return s && /^[0-9a-f-]{36}$/i.test(s) ? s : null;
}

export async function updateBzaIdAction(
  _prev: KfwActionState,
  formData: FormData,
): Promise<KfwActionState> {
  if (!isServiceRoleConfigured()) return { error: 'Datenbankzugang nicht konfiguriert.' };
  const caseId = validCaseId(formData.get('case_id'));
  if (!caseId) return { error: 'Ungültige Fall-ID.' };

  const user = await requireUser();
  const accessError = await verifyCaseAccess(caseId, user.id);
  if (accessError) return { error: accessError };

  const bzaId       = (formData.get('bza_id') as string | null) ?? '';
  const bzaCreatedAt = (formData.get('bza_created_at') as string | null) ?? '';
  const normalId    = bzaId.replace(/[\s\-._]/g, '');

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('funding_cases')
    .update({
      bza_id:         normalId    || null,
      bza_created_at: bzaCreatedAt || null,
    })
    .eq('id', caseId);

  if (error) return { error: `Fehler: ${error.message}` };
  revalidatePath(`/cases/${caseId}`);
  return { success: true };
}

export async function markBzaRequestedAction(
  _prev: KfwActionState,
  formData: FormData,
): Promise<KfwActionState> {
  if (!isServiceRoleConfigured()) return { error: 'Datenbankzugang nicht konfiguriert.' };
  const caseId = validCaseId(formData.get('case_id'));
  if (!caseId) return { error: 'Ungültige Fall-ID.' };

  const user = await requireUser();
  const accessError = await verifyCaseAccess(caseId, user.id);
  if (accessError) return { error: accessError };

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('funding_cases')
    .update({ bza_status: 'requested' })
    .eq('id', caseId);

  if (error) return { error: `Fehler: ${error.message}` };
  revalidatePath(`/cases/${caseId}`);
  return { success: true };
}

export async function markBzaCreatedAction(
  _prev: KfwActionState,
  formData: FormData,
): Promise<KfwActionState> {
  if (!isServiceRoleConfigured()) return { error: 'Datenbankzugang nicht konfiguriert.' };
  const caseId = validCaseId(formData.get('case_id'));
  if (!caseId) return { error: 'Ungültige Fall-ID.' };

  const user = await requireUser();
  const accessError = await verifyCaseAccess(caseId, user.id);
  if (accessError) return { error: accessError };

  const rawId    = (formData.get('bza_id') as string | null) ?? '';
  const rawDate  = (formData.get('bza_created_at') as string | null) ?? '';
  const normalId = rawId.replace(/[\s\-._]/g, '');

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('funding_cases')
    .update({
      bza_status:     'created',
      bza_id:         normalId || undefined,
      bza_created_at: rawDate  || undefined,
    })
    .eq('id', caseId);

  if (error) return { error: `Fehler: ${error.message}` };
  revalidatePath(`/cases/${caseId}`);
  return { success: true };
}

export async function markKfwApplicationPreparedAction(
  _prev: KfwActionState,
  formData: FormData,
): Promise<KfwActionState> {
  if (!isServiceRoleConfigured()) return { error: 'Datenbankzugang nicht konfiguriert.' };
  const caseId = validCaseId(formData.get('case_id'));
  if (!caseId) return { error: 'Ungültige Fall-ID.' };

  const user = await requireUser();
  const accessError = await verifyCaseAccess(caseId, user.id);
  if (accessError) return { error: accessError };

  const reference = (formData.get('kfw_application_reference') as string | null) ?? '';

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('funding_cases')
    .update({
      kfw_application_status:      'prepared',
      kfw_application_prepared_at: new Date().toISOString(),
      kfw_application_reference:   reference || null,
    })
    .eq('id', caseId);

  if (error) return { error: `Fehler: ${error.message}` };
  revalidatePath(`/cases/${caseId}`);
  return { success: true };
}

export async function markKfwApplicationSubmittedAction(
  _prev: KfwActionState,
  formData: FormData,
): Promise<KfwActionState> {
  if (!isServiceRoleConfigured()) return { error: 'Datenbankzugang nicht konfiguriert.' };
  const caseId = validCaseId(formData.get('case_id'));
  if (!caseId) return { error: 'Ungültige Fall-ID.' };

  const user = await requireUser();
  const accessError = await verifyCaseAccess(caseId, user.id);
  if (accessError) return { error: accessError };

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('funding_cases')
    .update({ kfw_application_status: 'submitted' })
    .eq('id', caseId);

  if (error) return { error: `Fehler: ${error.message}` };
  revalidatePath(`/cases/${caseId}`);
  return { success: true };
}

export async function resetKfwApplicationPreparationAction(
  _prev: KfwActionState,
  formData: FormData,
): Promise<KfwActionState> {
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
      bza_status:                  'not_started',
      bza_id:                      null,
      bza_created_at:              null,
      kfw_application_status:      'not_started',
      kfw_application_prepared_at: null,
      kfw_application_reference:   null,
    })
    .eq('id', caseId);

  if (error) return { error: `Fehler: ${error.message}` };
  revalidatePath(`/cases/${caseId}`);
  return { success: true };
}
