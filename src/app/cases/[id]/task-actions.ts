'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/service-client';
import { isServiceRoleConfigured } from '@/lib/supabase/safe-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TaskActionState = {
  error?: string;
  success?: boolean;
} | null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function logAudit(
  caseId: string,
  field: string,
  newValue: string,
) {
  try {
    const supabase = createServiceClient();
    await supabase.from('audit_log').insert({
      funding_case_id: caseId,
      field,
      old_value: null,
      new_value: newValue,
      changed_by: 'admin',
    });
  } catch {
    // Audit log is optional — never blocks the main action
  }
}

// ─── Create task ──────────────────────────────────────────────────────────────

const createSchema = z.object({
  case_id: z.string().uuid(),
  title: z.string().min(1, 'Pflichtfeld'),
  description: z.string().optional(),
  due_date: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
});

export async function createTaskAction(
  _prev: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  if (!isServiceRoleConfigured()) {
    return { error: 'Datenbankzugang nicht konfiguriert.' };
  }

  const raw = Object.fromEntries(formData);
  const parsed = createSchema.safeParse({
    ...raw,
    description: raw.description || undefined,
    due_date: raw.due_date || undefined,
  });

  if (!parsed.success) {
    return {
      error: parsed.error.flatten().fieldErrors.title?.[0] ?? 'Ungültige Eingabe.',
    };
  }

  const { case_id, title, description, due_date, priority } = parsed.data;
  const supabase = createServiceClient();

  const { error } = await supabase.from('tasks').insert({
    funding_case_id: case_id,
    title,
    description: description ?? null,
    due_date: due_date ?? null,
    priority,
  });

  if (error) return { error: `Fehler: ${error.message}` };

  await logAudit(case_id, 'task_created', title);

  revalidatePath(`/cases/${case_id}`);
  revalidatePath('/dashboard');

  return { success: true };
}

// ─── Complete task ────────────────────────────────────────────────────────────

export async function completeTaskAction(formData: FormData): Promise<void> {
  if (!isServiceRoleConfigured()) return;

  const task_id = formData.get('task_id') as string;
  const case_id = formData.get('case_id') as string;
  if (!task_id || !case_id) return;

  const supabase = createServiceClient();

  await supabase
    .from('tasks')
    .update({ completed: true, completed_at: new Date().toISOString() })
    .eq('id', task_id);

  await logAudit(case_id, 'task_completed', task_id);

  revalidatePath(`/cases/${case_id}`);
  revalidatePath('/dashboard');
}

// ─── Reopen task ──────────────────────────────────────────────────────────────

export async function reopenTaskAction(formData: FormData): Promise<void> {
  if (!isServiceRoleConfigured()) return;

  const task_id = formData.get('task_id') as string;
  const case_id = formData.get('case_id') as string;
  if (!task_id || !case_id) return;

  const supabase = createServiceClient();

  await supabase
    .from('tasks')
    .update({ completed: false, completed_at: null })
    .eq('id', task_id);

  await logAudit(case_id, 'task_reopened', task_id);

  revalidatePath(`/cases/${case_id}`);
  revalidatePath('/dashboard');
}
