'use server';

import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/service-client';
import { isServiceRoleConfigured } from '@/lib/supabase/safe-client';
import { extractPdfText } from '@/lib/documents/pdf-text';
import { getAIProvider } from '@/lib/ai/provider';
import {
  OFFER_CHECK_RULE_VERSION,
  OFFER_CHECK_SOURCES_USED,
  OFFER_CHECK_DISCLAIMER,
} from '@/lib/ai/prompts/offer-check';
import type { OfferCheckInput } from '@/lib/ai/offer-check/types';
import type { Database, Json } from '@/lib/supabase/database.types';

type FundingCaseRow = Database['public']['Tables']['funding_cases']['Row'];
type DocumentRow    = Database['public']['Tables']['documents']['Row'];

export type OfferCheckActionState = {
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

export async function runOfferCheckAction(
  _prev: OfferCheckActionState,
  formData: FormData,
): Promise<OfferCheckActionState> {
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

  const [caseRes, docRes] = await Promise.all([
    supabase.from('funding_cases').select().eq('id', caseId).single<FundingCaseRow>(),
    supabase.from('documents').select().eq('id', documentId).single<DocumentRow>(),
  ]);

  if (caseRes.error || !caseRes.data) return { error: 'Förderfall nicht gefunden.' };
  if (docRes.error  || !docRes.data)  return { error: 'Dokument nicht gefunden.' };

  const fundingCase = caseRes.data;
  const doc         = docRes.data;

  if (doc.funding_case_id !== caseId) {
    return { error: 'Dokument gehört nicht zu diesem Förderfall.' };
  }

  if (doc.type !== 'offer') {
    return { error: 'Nur Angebots-Dokumente können geprüft werden.' };
  }

  // Download PDF from Supabase Storage
  const { data: fileBlob, error: downloadErr } = await supabase.storage
    .from('case-documents')
    .download(doc.storage_path);

  if (downloadErr || !fileBlob) {
    return {
      error: `Datei konnte nicht heruntergeladen werden: ${downloadErr?.message ?? 'unbekannter Fehler'}`,
    };
  }

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

  if (extraction.extraction_status === 'empty') {
    resultJson = {
      extraction_failed: true,
      extraction_status: 'empty',
      message_de:
        'Aus dem PDF konnte kein Text gelesen werden. Für gescannte PDFs wird später OCR benötigt.',
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
    } as unknown as Json;
    confidence = 'low';
    status     = 'failed';
    aiError    = `PDF-Textextraktion fehlgeschlagen: ${extraction.error ?? 'unbekannter Fehler'}`;
  } else {
    const input: OfferCheckInput = {
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
      const result = await provider.runOfferCheck(input);
      resultJson = result as unknown as Json;
      summary    = result.summary_de;
      riskLevel  = result.risk_level;
      confidence = result.confidence;
    } catch (err) {
      status    = 'failed';
      aiError   = err instanceof Error ? err.message : String(err);
      resultJson = { error: aiError } as unknown as Json;
    }
  }

  const { error: insertErr } = await supabase.from('ai_checks').insert({
    case_id:             caseId,
    check_type:          'offer_check',
    provider:            provider.providerName,
    model:               provider.modelName,
    status,
    result_json:         resultJson,
    summary,
    risk_level:          riskLevel,
    confidence,
    human_review_status: 'pending',
    rule_version:        OFFER_CHECK_RULE_VERSION,
    sources_used:        OFFER_CHECK_SOURCES_USED as unknown as Json,
    disclaimer:          OFFER_CHECK_DISCLAIMER,
  });

  if (insertErr) {
    return { error: `Fehler beim Speichern: ${insertErr.message}` };
  }

  await logAudit(
    caseId,
    'ai_offer_check_created',
    `${provider.providerName}/${provider.modelName} → ${status} · doc=${documentId}`,
  );

  revalidatePath(`/cases/${caseId}`);

  if (status === 'failed') {
    return { error: aiError };
  }

  return { success: true };
}
