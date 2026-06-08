'use server';

import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/service-client';
import { isServiceRoleConfigured } from '@/lib/supabase/safe-client';
import { computeChecklist, getBlockingTaskTitles, getNeedsReviewTaskTitles } from '@/lib/documents/checklist';
import type { Database } from '@/lib/supabase/database.types';

type DocumentRow = Database['public']['Tables']['documents']['Row'];

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreateTasksState = {
  error?: string;
  success?: boolean;
  created?: number;
  message?: string;
} | null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function logAudit(caseId: string, field: string, newValue: string) {
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

// ─── Create missing document tasks ───────────────────────────────────────────

export async function createMissingDocumentTasksAction(
  _prev: CreateTasksState,
  formData: FormData,
): Promise<CreateTasksState> {
  if (!isServiceRoleConfigured()) {
    return { error: 'Datenbankzugang nicht konfiguriert.' };
  }

  const case_id = formData.get('case_id') as string;
  if (!case_id || !/^[0-9a-f-]{36}$/i.test(case_id)) {
    return { error: 'Ungültige Fall-ID.' };
  }

  const supabase = createServiceClient();

  // Fetch documents and open tasks in parallel
  const [docsResult, tasksResult] = await Promise.all([
    supabase
      .from('documents')
      .select()
      .eq('funding_case_id', case_id)
      .returns<DocumentRow[]>(),
    supabase
      .from('tasks')
      .select('title')
      .eq('funding_case_id', case_id)
      .eq('completed', false),
  ]);

  const documents = docsResult.data ?? [];
  const existingTitles = new Set((tasksResult.data ?? []).map((t) => t.title));

  const items = computeChecklist(documents);

  // Upload tasks (high priority) for blocking/missing documents
  const uploadRows = getBlockingTaskTitles(items)
    .filter((b) => !existingTitles.has(b.task_title))
    .map((b) => ({
      funding_case_id: case_id,
      title: b.task_title,
      priority: 'high' as const,
    }));

  // Review tasks (normal priority) for uploaded-but-unreviewed documents
  const reviewRows = getNeedsReviewTaskTitles(items)
    .filter((b) => !existingTitles.has(b.task_title))
    .map((b) => ({
      funding_case_id: case_id,
      title: b.task_title,
      priority: 'normal' as const,
    }));

  const toCreate = [...uploadRows, ...reviewRows];

  if (toCreate.length === 0) {
    return {
      success: true,
      created: 0,
      message: 'Alle Aufgaben sind bereits vorhanden.',
    };
  }

  const { error } = await supabase.from('tasks').insert(toCreate);

  if (error) return { error: `Fehler: ${error.message}` };

  await logAudit(case_id, 'missing_document_tasks_created', String(toCreate.length));

  revalidatePath(`/cases/${case_id}`);
  return { success: true, created: toCreate.length };
}
