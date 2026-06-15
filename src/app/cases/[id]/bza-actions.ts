'use server';

import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/service-client';
import { isServiceRoleConfigured } from '@/lib/supabase/safe-client';
import { requireUser, verifyCaseAccess } from '@/lib/auth/session';

export type BzaResponsiblePartyState = { success?: boolean; error?: string } | null;
export type BzaTasksState            = { created?: number; skipped?: number; error?: string } | null;

const ALLOWED_RESPONSIBLE = ['specialist_company', 'energy_expert', 'unclear'] as const;

export async function updateBzaResponsiblePartyAction(
  _prev: BzaResponsiblePartyState,
  formData: FormData,
): Promise<BzaResponsiblePartyState> {
  if (!isServiceRoleConfigured()) return { error: 'Datenbankzugang nicht konfiguriert.' };

  const caseId = formData.get('case_id') as string;
  const value  = formData.get('bza_responsible_party') as string;

  if (!caseId || !/^[0-9a-f-]{36}$/i.test(caseId)) return { error: 'Ungültige Fall-ID.' };
  if (!ALLOWED_RESPONSIBLE.includes(value as typeof ALLOWED_RESPONSIBLE[number])) {
    return { error: 'Ungültiger Wert.' };
  }

  const user = await requireUser();
  const accessError = await verifyCaseAccess(caseId, user.id);
  if (accessError) return { error: accessError };

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('funding_cases')
    .update({ bza_responsible_party: value })
    .eq('id', caseId);

  if (error) return { error: `Fehler beim Speichern: ${error.message}` };

  revalidatePath(`/cases/${caseId}`);
  return { success: true };
}

const BZA_TASK_DEFS = [
  {
    title:       'BzA-Verantwortlichen festlegen',
    description: 'Zuständige Person oder Stelle für die Erstellung der BzA (Bestätigung zum Antrag) festlegen.',
    priority:    'high' as const,
  },
  {
    title:       'BzA-Daten prüfen',
    description: 'Alle Angaben für die BzA-Erstellung prüfen und vervollständigen.',
    priority:    'high' as const,
  },
  {
    title:       'KfW-Antrag vorbereiten',
    description: 'Antrag in „Meine KfW" vorbereiten. Keine automatische Einreichung – manuell in „Meine KfW" erforderlich.',
    priority:    'high' as const,
  },
] as const;

export async function createBzaTasksAction(
  _prev: BzaTasksState,
  formData: FormData,
): Promise<BzaTasksState> {
  if (!isServiceRoleConfigured()) return { error: 'Datenbankzugang nicht konfiguriert.' };

  const caseId = formData.get('case_id') as string;
  if (!caseId || !/^[0-9a-f-]{36}$/i.test(caseId)) return { error: 'Ungültige Fall-ID.' };

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

  for (const task of BZA_TASK_DEFS) {
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
