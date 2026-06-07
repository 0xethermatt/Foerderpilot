'use server';

import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/service-client';
import { isServiceRoleConfigured } from '@/lib/supabase/safe-client';
import type { DbDocumentType, DbDocumentStatus } from '@/lib/supabase/database.types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DocumentActionState = {
  error?: string;
  success?: boolean;
} | null;

// ─── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
];

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB

const VALID_DOCUMENT_TYPES = new Set([
  'offer', 'contract', 'old_heating_photo', 'old_heating_nameplate',
  'owner_proof', 'bza', 'kfw_approval', 'invoice', 'bnd', 'other',
]);

const VALID_STATUSES = new Set([
  'uploaded', 'needs_review', 'reviewed', 'missing', 'rejected',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeFilename(raw: string): string {
  return raw
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120);
}

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

// ─── Upload document ──────────────────────────────────────────────────────────

export async function uploadCaseDocumentAction(
  _prev: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  if (!isServiceRoleConfigured()) {
    return { error: 'Datenbankzugang nicht konfiguriert.' };
  }

  const case_id = formData.get('case_id') as string;
  const document_type = formData.get('document_type') as string;
  const notes = (formData.get('notes') as string | null) || undefined;
  const file = formData.get('file') as File | null;

  // Validate inputs
  if (!case_id || !/^[0-9a-f-]{36}$/i.test(case_id)) {
    return { error: 'Ungültige Fall-ID.' };
  }
  if (!VALID_DOCUMENT_TYPES.has(document_type)) {
    return { error: 'Ungültiger Dokumenttyp.' };
  }
  if (!file || file.size === 0) {
    return { error: 'Bitte eine Datei auswählen.' };
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { error: 'Ungültiges Dateiformat. Erlaubt: PDF, JPG, PNG, HEIC.' };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { error: 'Datei zu groß. Maximal 15 MB erlaubt.' };
  }

  const supabase = createServiceClient();

  // Verify case exists
  const { data: caseRow } = await supabase
    .from('funding_cases')
    .select('id')
    .eq('id', case_id)
    .single();
  if (!caseRow) {
    return { error: 'Förderfall nicht gefunden.' };
  }

  // Build storage path
  const timestamp = Date.now();
  const safeFilename = sanitizeFilename(file.name);
  const storagePath = `cases/${case_id}/${document_type}/${timestamp}-${safeFilename}`;

  // Upload file to Supabase Storage
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: storageError } = await supabase.storage
    .from('case-documents')
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (storageError) {
    return { error: `Upload fehlgeschlagen: ${storageError.message}` };
  }

  // Insert document row
  const { error: dbError } = await supabase.from('documents').insert({
    funding_case_id: case_id,
    name: file.name,
    type: document_type as DbDocumentType,
    storage_path: storagePath,
    file_size_bytes: file.size,
    mime_type: file.type,
    status: 'needs_review' as DbDocumentStatus,
    notes: notes ?? null,
    uploaded_by: 'admin',
  });

  if (dbError) {
    // Clean up the orphaned storage object
    await supabase.storage.from('case-documents').remove([storagePath]);
    return { error: `Datenbankfehler: ${dbError.message}` };
  }

  await logAudit(case_id, 'document_uploaded', `${document_type}: ${file.name}`);

  revalidatePath(`/cases/${case_id}`);
  return { success: true };
}

// ─── Update document status ───────────────────────────────────────────────────

export async function updateDocumentStatusAction(formData: FormData): Promise<void> {
  if (!isServiceRoleConfigured()) return;

  const document_id = formData.get('document_id') as string;
  const case_id = formData.get('case_id') as string;
  const status = formData.get('status') as string;

  if (!document_id || !case_id || !VALID_STATUSES.has(status)) return;

  const supabase = createServiceClient();

  const { error } = await supabase
    .from('documents')
    .update({ status: status as DbDocumentStatus })
    .eq('id', document_id)
    .eq('funding_case_id', case_id);

  if (error) return;

  await logAudit(case_id, 'document_status_updated', `${document_id}: ${status}`);

  revalidatePath(`/cases/${case_id}`);
}
