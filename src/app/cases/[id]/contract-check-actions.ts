'use server';

import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/service-client';
import { isServiceRoleConfigured } from '@/lib/supabase/safe-client';
import { extractPdfText } from '@/lib/documents/pdf-text';
import { getAIProvider } from '@/lib/ai/provider';
import {
  CONTRACT_CHECK_RULE_VERSION,
  CONTRACT_CHECK_SOURCES_USED,
  CONTRACT_CHECK_DISCLAIMER,
} from '@/lib/ai/prompts/contract-check';
import type { ContractCheckInput } from '@/lib/ai/contract-check/types';
import type { Database, Json } from '@/lib/supabase/database.types';

type FundingCaseRow = Database['public']['Tables']['funding_cases']['Row'];
type DocumentRow    = Database['public']['Tables']['documents']['Row'];

export type ContractCheckActionState = {
  error?: string;
  success?: boolean;
} | null;

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

export async function runContractCheckAction(
  _prev: ContractCheckActionState,
  formData: FormData,
): Promise<ContractCheckActionState> {
  if (!isServiceRoleConfigured()) {
    return { error: 'Datenbankzugang nicht konfiguriert.' };
  }

  const caseId     = formData.get('case_id')     as string;
  const documentId = formData.get('document_id') as string;

  if (!caseId || !/^[0-9a-f-]{36}$/i.test(caseId)) {
    return { error: 'Ungültige Fall-ID.' };
  }
  if (!documentId || !/^[0-9a-f-]{36}$/i.test(documentId)) {
    return { error: 'Ungültige Dokument-ID.' };
  }

  const supabase = createServiceClient();

  // Load case and document in parallel
  const [caseRes, docRes] = await Promise.all([
    supabase.from('funding_cases').select().eq('id', caseId).single<FundingCaseRow>(),
    supabase.from('documents').select().eq('id', documentId).single<DocumentRow>(),
  ]);

  if (caseRes.error || !caseRes.data) return { error: 'Förderfall nicht gefunden.' };
  if (docRes.error  || !docRes.data)  return { error: 'Dokument nicht gefunden.' };

  const fundingCase = caseRes.data;
  const doc         = docRes.data;

  // Verify document belongs to case
  if (doc.funding_case_id !== caseId) {
    return { error: 'Dokument gehört nicht zu diesem Förderfall.' };
  }

  // Verify document type is contract
  if (doc.type !== 'contract') {
    return { error: 'Nur Vertrags-Dokumente können geprüft werden.' };
  }

  // Download PDF from Supabase Storage
  const { data: fileBlob, error: downloadErr } = await supabase.storage
    .from('case-documents')
    .download(doc.storage_path);

  if (downloadErr || !fileBlob) {
    return { error: `Datei konnte nicht heruntergeladen werden: ${downloadErr?.message ?? 'unbekannter Fehler'}` };
  }

  // Convert Blob to Buffer and extract text
  const arrayBuffer = await fileBlob.arrayBuffer();
  const buffer      = Buffer.from(arrayBuffer);
  const extraction  = await extractPdfText(buffer);

  const provider = getAIProvider();
  let resultJson: Json;
  let summary: string | null                      = null;
  let riskLevel: 'green' | 'yellow' | 'red' | null = null;
  let confidence: 'low' | 'medium' | 'high' | null = null;
  let status: 'completed' | 'failed'               = 'completed';
  let aiError: string | undefined;

  const checkMeta = { document_id: documentId, document_type: 'contract' as const };

  if (extraction.extraction_status === 'empty') {
    // Store a low-confidence completed result rather than a hard failure
    resultJson = {
      extraction_failed: true,
      extraction_status: 'empty',
      message_de:
        'Aus dem PDF konnte kein Text gelesen werden. Für gescannte PDFs wird später OCR benötigt.',
      meta: checkMeta,
    } as unknown as Json;
    confidence = 'low';
    status     = 'failed';
    aiError    =
      'Aus dem PDF konnte kein Text gelesen werden. Für gescannte PDFs wird später OCR benötigt.';
  } else if (extraction.extraction_status === 'failed') {
    resultJson = {
      extraction_failed: true,
      extraction_status: 'failed',
      error: extraction.error ?? 'PDF-Extraktion fehlgeschlagen',
      meta: checkMeta,
    } as unknown as Json;
    confidence = 'low';
    status     = 'failed';
    aiError    = `PDF-Textextraktion fehlgeschlagen: ${extraction.error ?? 'unbekannter Fehler'}`;
  } else {
    // Extraction succeeded – run AI analysis
    const input: ContractCheckInput = {
      caseId,
      documentId,
      documentName:      doc.name,
      extractedText:     extraction.text,
      pageCount:         extraction.page_count,
      extractionStatus:  extraction.extraction_status,
      caseTitle:         fundingCase.title,
      projectCity:       fundingCase.project_address_city,
      projectPostalCode: fundingCase.project_address_postal_code,
    };

    try {
      const result = await provider.runContractCheck(input);
      resultJson = { ...(result as object), meta: checkMeta } as unknown as Json;
      summary    = result.summary_de;
      riskLevel  = result.risk_level;
      confidence = result.confidence;
    } catch (err) {
      status  = 'failed';
      const raw = err instanceof Error ? err.message : String(err);
      // ZodError messages are a raw JSON array – never show those to users
      const isZodError = raw.startsWith('[') && raw.includes('"code"');
      aiError = isZodError
        ? 'KI-Antwort hatte ein unerwartetes Format. Bitte erneut versuchen.'
        : raw;
      console.error('[ContractCheck] AI failed:', raw);
      resultJson = { error: aiError, meta: checkMeta } as unknown as Json;
    }
  }

  // Insert ai_checks row
  const { error: insertErr } = await supabase.from('ai_checks').insert({
    case_id:             caseId,
    check_type:          'contract_check',
    provider:            provider.providerName,
    model:               provider.modelName,
    status,
    result_json:         resultJson,
    summary,
    risk_level:          riskLevel,
    confidence,
    human_review_status: 'pending',
    rule_version:        CONTRACT_CHECK_RULE_VERSION,
    sources_used:        CONTRACT_CHECK_SOURCES_USED as unknown as Json,
    disclaimer:          CONTRACT_CHECK_DISCLAIMER,
  });

  if (insertErr) {
    return { error: `Fehler beim Speichern: ${insertErr.message}` };
  }

  await logAudit(
    caseId,
    'ai_contract_check_created',
    `${provider.providerName}/${provider.modelName} → ${status} · doc=${documentId}`,
  );

  revalidatePath(`/cases/${caseId}`);

  if (status === 'failed') {
    return { error: aiError };
  }

  return { success: true };
}
