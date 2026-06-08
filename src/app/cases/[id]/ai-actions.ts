'use server';

import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/service-client';
import { isServiceRoleConfigured } from '@/lib/supabase/safe-client';
import { computeChecklist, computeReadiness } from '@/lib/documents/checklist';
import { getAIProvider } from '@/lib/ai/provider';
import { RULE_VERSION, SOURCES_USED, DISCLAIMER } from '@/lib/ai/prompts/funding-precheck';
import type { FundingPrecheckInput } from '@/lib/ai/types';
import type { Database, Json } from '@/lib/supabase/database.types';

type FundingCaseRow = Database['public']['Tables']['funding_cases']['Row'];
type CustomerRow    = Database['public']['Tables']['customers']['Row'];
type DocumentRow    = Database['public']['Tables']['documents']['Row'];
type TaskRow        = Database['public']['Tables']['tasks']['Row'];

// ─── Types ────────────────────────────────────────────────────────────────────

export type AICheckActionState = {
  error?: string;
  success?: boolean;
} | null;

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
    // Audit log is optional — never blocks the main action
  }
}

// ─── Run funding precheck ─────────────────────────────────────────────────────

export async function runFundingPrecheckAction(
  _prev: AICheckActionState,
  formData: FormData,
): Promise<AICheckActionState> {
  if (!isServiceRoleConfigured()) {
    return { error: 'Datenbankzugang nicht konfiguriert.' };
  }

  const caseId = formData.get('case_id') as string;
  if (!caseId || !/^[0-9a-f-]{36}$/i.test(caseId)) {
    return { error: 'Ungültige Fall-ID.' };
  }

  const supabase = createServiceClient();

  // Load case
  const { data: fundingCase, error: caseErr } = await supabase
    .from('funding_cases')
    .select()
    .eq('id', caseId)
    .single<FundingCaseRow>();

  if (caseErr || !fundingCase) {
    return { error: 'Förderfall nicht gefunden.' };
  }

  // Load customer + documents + open tasks in parallel
  const [customerRes, docsRes, tasksRes] = await Promise.all([
    supabase
      .from('customers')
      .select()
      .eq('id', fundingCase.customer_id)
      .single<CustomerRow>(),
    supabase
      .from('documents')
      .select()
      .eq('funding_case_id', caseId)
      .returns<DocumentRow[]>(),
    supabase
      .from('tasks')
      .select()
      .eq('funding_case_id', caseId)
      .eq('completed', false)
      .returns<TaskRow[]>(),
  ]);

  const customer  = customerRes.data;
  const documents = docsRes.data ?? [];
  const tasks     = tasksRes.data ?? [];

  // Compute checklist
  const checklistItems = computeChecklist(documents);
  const readiness      = computeReadiness(checklistItems);

  const uploadedDocumentTypes = checklistItems
    .filter((i) => i.status !== 'missing')
    .map((i) => i.label_de);

  const missingDocumentTypes = checklistItems
    .filter((i) => i.blocking || (i.required && i.status === 'missing'))
    .map((i) => i.label_de);

  // Build AI input
  const input: FundingPrecheckInput = {
    caseId:               fundingCase.id,
    caseTitle:            fundingCase.title,
    caseStatus:           fundingCase.status,
    caseRiskLevel:        fundingCase.risk_level,
    projectCity:          fundingCase.project_address_city,
    projectPostalCode:    fundingCase.project_address_postal_code,
    buildingType:         fundingCase.building_type,
    housingUnits:         fundingCase.housing_units,
    ownerStatus:          fundingCase.owner_status,
    selfOccupied:         fundingCase.self_occupied,
    currentHeatingType:   fundingCase.current_heating_type,
    currentHeatingYear:   fundingCase.current_heating_year,
    plannedHeatingType:   fundingCase.planned_heating_type,
    plannedHeatPumpModel: fundingCase.planned_heat_pump_model,
    estimatedCost:        fundingCase.estimated_cost != null ? Number(fundingCase.estimated_cost) : null,
    fundingAmount:        fundingCase.funding_amount  != null ? Number(fundingCase.funding_amount)  : null,
    notes:                fundingCase.notes,
    customerCity:         customer?.city         ?? '',
    customerPostalCode:   customer?.postal_code  ?? '',
    readinessState:       readiness.state,
    reviewedCount:        readiness.reviewed_count,
    totalRequiredBeforeApp: readiness.total_required_before_app,
    blockingCount:        readiness.blocking_count,
    uploadedDocumentTypes,
    missingDocumentTypes,
    openTaskTitles:       tasks.map((t) => t.title),
  };

  // Run AI provider
  const provider = getAIProvider();
  let resultJson: Json;
  let summary: string | null = null;
  let riskLevel: 'green' | 'yellow' | 'red' | null = null;
  let confidence: 'low' | 'medium' | 'high' | null = null;
  let status: 'completed' | 'failed' = 'completed';
  let aiError: string | undefined;

  try {
    const result = await provider.runFundingPrecheck(input);
    resultJson = result as unknown as Json;
    summary    = result.summary_de;
    riskLevel  = result.risk_level;
    confidence = result.confidence;
  } catch (err) {
    status    = 'failed';
    aiError   = err instanceof Error ? err.message : String(err);
    resultJson = { error: aiError } as unknown as Json;
  }

  // Insert ai_checks row
  const { error: insertErr } = await supabase.from('ai_checks').insert({
    case_id:              caseId,
    check_type:           'funding_precheck',
    provider:             provider.providerName,
    model:                provider.modelName,
    status,
    result_json:          resultJson,
    summary,
    risk_level:           riskLevel,
    confidence,
    human_review_status:  'pending',
    rule_version:         RULE_VERSION,
    sources_used:         SOURCES_USED as unknown as Json,
    disclaimer:           DISCLAIMER,
  });

  if (insertErr) {
    return { error: `Fehler beim Speichern: ${insertErr.message}` };
  }

  await logAudit(
    caseId,
    'ai_funding_precheck_created',
    `${provider.providerName}/${provider.modelName} → ${status}`,
  );

  revalidatePath(`/cases/${caseId}`);

  if (status === 'failed') {
    return { error: `KI-Prüfung fehlgeschlagen: ${aiError}` };
  }

  return { success: true };
}

// ─── Human review actions ─────────────────────────────────────────────────────

export async function markAICheckApprovedAction(formData: FormData): Promise<void> {
  if (!isServiceRoleConfigured()) return;

  const checkId = formData.get('check_id') as string;
  const caseId  = formData.get('case_id')  as string;
  if (!checkId || !caseId) return;

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('ai_checks')
    .update({
      human_review_status: 'approved',
      reviewed_at:         new Date().toISOString(),
      reviewed_by:         'local_dev',
    })
    .eq('id', checkId)
    .eq('case_id', caseId);

  if (error) return;

  await logAudit(caseId, 'ai_check_approved', checkId);
  revalidatePath(`/cases/${caseId}`);
}

export async function markAICheckRejectedAction(formData: FormData): Promise<void> {
  if (!isServiceRoleConfigured()) return;

  const checkId = formData.get('check_id') as string;
  const caseId  = formData.get('case_id')  as string;
  if (!checkId || !caseId) return;

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('ai_checks')
    .update({
      human_review_status: 'rejected',
      reviewed_at:         new Date().toISOString(),
      reviewed_by:         'local_dev',
    })
    .eq('id', checkId)
    .eq('case_id', caseId);

  if (error) return;

  await logAudit(caseId, 'ai_check_rejected', checkId);
  revalidatePath(`/cases/${caseId}`);
}
