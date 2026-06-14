'use server';

import { createServiceClient } from '@/lib/supabase/service-client';
import { isServiceRoleConfigured } from '@/lib/supabase/safe-client';
import { buildFundingCaseExportData } from '@/lib/export/funding-case-export';
import { renderFundingCaseMarkdown, type ExportVariant } from '@/lib/export/funding-case-markdown';
import type { Database } from '@/lib/supabase/database.types';

type FundingCaseRow = Database['public']['Tables']['funding_cases']['Row'];
type CustomerRow    = Database['public']['Tables']['customers']['Row'];
type DocumentRow    = Database['public']['Tables']['documents']['Row'];
type TaskRow        = Database['public']['Tables']['tasks']['Row'];
type AICheckRow     = Database['public']['Tables']['ai_checks']['Row'];

export type ExportActionState = {
  success?: boolean;
  error?: string;
  markdown?: string;
  variant?: ExportVariant;
  customer_last_name?: string;
} | null;

function validCaseId(v: unknown): string | null {
  const s = typeof v === 'string' ? v : null;
  return s && /^[0-9a-f-]{36}$/i.test(s) ? s : null;
}

const ALLOWED_VARIANTS: ExportVariant[] = ['internal', 'customer', 'handover'];

export async function generateFundingCaseMarkdownAction(
  _prev: ExportActionState,
  formData: FormData,
): Promise<ExportActionState> {
  if (!isServiceRoleConfigured()) return { error: 'Datenbankzugang nicht konfiguriert.' };

  const caseId = validCaseId(formData.get('case_id'));
  if (!caseId) return { error: 'Ungültige Fall-ID.' };

  const rawVariant = (formData.get('variant') as string | null) ?? 'internal';
  const variant: ExportVariant = ALLOWED_VARIANTS.includes(rawVariant as ExportVariant)
    ? (rawVariant as ExportVariant)
    : 'internal';

  const includeAI        = formData.get('include_ai') !== 'false';
  const includeDoneTasks = formData.get('include_done_tasks') === 'true';
  const includeDisclaimer = formData.get('include_disclaimer') !== 'false';

  const supabase = createServiceClient();

  const [
    { data: fundingCase, error: caseErr },
    { data: customer },
    { data: documentsRaw },
    { data: tasksRaw },
    { data: aiChecksRaw },
  ] = await Promise.all([
    supabase.from('funding_cases').select().eq('id', caseId).single<FundingCaseRow>(),
    supabase.from('customers').select().eq('id', (await supabase.from('funding_cases').select('customer_id').eq('id', caseId).single()).data?.customer_id ?? '').single<CustomerRow>(),
    supabase.from('documents').select().eq('funding_case_id', caseId).order('uploaded_at', { ascending: false }).returns<DocumentRow[]>(),
    supabase.from('tasks').select().eq('funding_case_id', caseId).order('completed', { ascending: true }).returns<TaskRow[]>(),
    supabase.from('ai_checks').select().eq('case_id', caseId).order('created_at', { ascending: false }).returns<AICheckRow[]>(),
  ]);

  if (caseErr || !fundingCase) return { error: 'Fall nicht gefunden.' };

  const exportData = buildFundingCaseExportData({
    fundingCase,
    customer:  customer ?? null,
    documents: documentsRaw ?? [],
    tasks:     tasksRaw    ?? [],
    aiChecks:  aiChecksRaw ?? [],
  });

  const markdown = renderFundingCaseMarkdown(exportData, {
    variant,
    include_ai_details:      includeAI && variant === 'internal',
    include_completed_tasks: includeDoneTasks,
    include_disclaimers:     includeDisclaimer,
  });

  // Audit log
  await supabase.from('audit_log').insert({
    funding_case_id: caseId,
    field:           'export_generated',
    old_value:       null,
    new_value:       variant,
    changed_by:      'internal',
  });

  return {
    success:            true,
    markdown,
    variant,
    customer_last_name: customer?.last_name ?? undefined,
  };
}
