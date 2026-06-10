'use server';

import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/service-client';
import { isServiceRoleConfigured } from '@/lib/supabase/safe-client';
import type { DbDocumentStatus } from '@/lib/supabase/database.types';

// ─── Task specs ───────────────────────────────────────────────────────────────
// Keep document type → task title mapping in sync with document-actions.ts.

interface DocTaskSpec {
  uploadTaskTitles: string[];
  reviewTaskTitle?: string;
  correctionTaskTitle: string;
}

const DOC_TASK_SPEC: Record<string, DocTaskSpec> = {
  contract: {
    uploadTaskTitles:    ['Liefer-/Leistungsvertrag hochladen', 'Liefer-/Leistungsvertrag anfordern'],
    reviewTaskTitle:     'Liefer-/Leistungsvertrag prüfen',
    correctionTaskTitle: 'Liefer-/Leistungsvertrag korrigieren',
  },
  offer: {
    uploadTaskTitles:    ['Angebot hochladen'],
    reviewTaskTitle:     'Angebot prüfen',
    correctionTaskTitle: 'Angebot korrigieren',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function logAudit(caseId: string, field: string, value: string) {
  try {
    const supabase = createServiceClient();
    await supabase.from('audit_log').insert({
      funding_case_id: caseId,
      field,
      old_value: null,
      new_value: value,
      changed_by: 'admin',
    });
  } catch {
    // optional – never blocks main action
  }
}

function resolveDocumentId(resultJson: unknown): string | null {
  if (typeof resultJson !== 'object' || resultJson === null) return null;
  const meta = (resultJson as Record<string, unknown>).meta;
  if (typeof meta !== 'object' || meta === null) return null;
  const docId = (meta as Record<string, unknown>).document_id;
  return typeof docId === 'string' && /^[0-9a-f-]{36}$/i.test(docId) ? docId : null;
}

// ─── Mark document reviewed ───────────────────────────────────────────────────
// Requires: check belongs to case, check_type is contract_check or offer_check,
// human_review_status = 'approved'. Sets document.status = 'reviewed' and
// closes related review/upload tasks (same logic as updateDocumentStatusAction).

export async function markAICheckDocumentReviewedAction(formData: FormData): Promise<void> {
  if (!isServiceRoleConfigured()) return;

  const checkId = formData.get('check_id') as string;
  const caseId  = formData.get('case_id')  as string;
  if (!checkId || !caseId) return;

  const supabase = createServiceClient();

  const { data: aiCheck } = await supabase
    .from('ai_checks')
    .select('id, case_id, check_type, human_review_status, result_json')
    .eq('id', checkId)
    .eq('case_id', caseId)
    .single();

  if (!aiCheck) return;
  if (aiCheck.check_type !== 'contract_check' && aiCheck.check_type !== 'offer_check') return;
  if (aiCheck.human_review_status !== 'approved') return;

  const documentId = resolveDocumentId(aiCheck.result_json);
  if (!documentId) return;

  const { data: docRow } = await supabase
    .from('documents')
    .select('id, type, funding_case_id')
    .eq('id', documentId)
    .eq('funding_case_id', caseId)
    .single();

  if (!docRow) return;

  const { error } = await supabase
    .from('documents')
    .update({ status: 'reviewed' as DbDocumentStatus })
    .eq('id', documentId)
    .eq('funding_case_id', caseId);

  if (error) return;

  await logAudit(caseId, 'document_marked_reviewed_from_ai_check', `doc=${documentId} check=${checkId}`);

  // Close upload + review tasks (mirrors updateDocumentStatusAction for status='reviewed')
  const spec = DOC_TASK_SPEC[docRow.type];
  if (spec) {
    const allTitles = [
      ...spec.uploadTaskTitles,
      ...(spec.reviewTaskTitle ? [spec.reviewTaskTitle] : []),
    ];
    if (allTitles.length > 0) {
      const { data: openTasks } = await supabase
        .from('tasks')
        .select('id')
        .eq('funding_case_id', caseId)
        .eq('completed', false)
        .in('title', allTitles);

      if (openTasks && openTasks.length > 0) {
        const now = new Date().toISOString();
        await supabase
          .from('tasks')
          .update({ completed: true, completed_at: now })
          .in('id', openTasks.map((t) => t.id));

        await logAudit(
          caseId,
          'task_auto_completed_by_document_review',
          `doc_type=${docRow.type} tasks=${openTasks.map((t) => t.id).join(',')}`,
        );
      }
    }
  }

  revalidatePath(`/cases/${caseId}`);
}

// ─── Mark document rejected ───────────────────────────────────────────────────
// Requires: check belongs to case, check_type is contract_check or offer_check,
// human_review_status = 'rejected'. Sets document.status = 'rejected' and
// creates a high-priority correction task (duplicate-safe).

export async function markAICheckDocumentRejectedAction(formData: FormData): Promise<void> {
  if (!isServiceRoleConfigured()) return;

  const checkId = formData.get('check_id') as string;
  const caseId  = formData.get('case_id')  as string;
  if (!checkId || !caseId) return;

  const supabase = createServiceClient();

  const { data: aiCheck } = await supabase
    .from('ai_checks')
    .select('id, case_id, check_type, human_review_status, result_json')
    .eq('id', checkId)
    .eq('case_id', caseId)
    .single();

  if (!aiCheck) return;
  if (aiCheck.check_type !== 'contract_check' && aiCheck.check_type !== 'offer_check') return;
  if (aiCheck.human_review_status !== 'rejected') return;

  const documentId = resolveDocumentId(aiCheck.result_json);
  if (!documentId) return;

  const { data: docRow } = await supabase
    .from('documents')
    .select('id, type, funding_case_id')
    .eq('id', documentId)
    .eq('funding_case_id', caseId)
    .single();

  if (!docRow) return;

  const { error } = await supabase
    .from('documents')
    .update({ status: 'rejected' as DbDocumentStatus })
    .eq('id', documentId)
    .eq('funding_case_id', caseId);

  if (error) return;

  await logAudit(caseId, 'document_marked_rejected_from_ai_check', `doc=${documentId} check=${checkId}`);

  // Create correction task if no open one exists already (duplicate prevention)
  const spec = DOC_TASK_SPEC[docRow.type];
  if (spec?.correctionTaskTitle) {
    const { data: existingTask } = await supabase
      .from('tasks')
      .select('id')
      .eq('funding_case_id', caseId)
      .eq('completed', false)
      .eq('title', spec.correctionTaskTitle)
      .maybeSingle();

    if (!existingTask) {
      await supabase.from('tasks').insert({
        funding_case_id: caseId,
        title:           spec.correctionTaskTitle,
        priority:        'high',
      });

      await logAudit(caseId, 'task_created', spec.correctionTaskTitle);
    }
  }

  revalidatePath(`/cases/${caseId}`);
}
