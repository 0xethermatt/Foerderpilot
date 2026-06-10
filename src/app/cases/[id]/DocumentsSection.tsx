'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useEffect, useState } from 'react';
import { FileText, Plus, ChevronUp, Download, ScanSearch } from 'lucide-react';
import {
  uploadCaseDocumentAction,
  updateDocumentStatusAction,
} from './document-actions';
import type { DocumentActionState, UpdateStatusState } from './document-actions';
import { runContractCheckAction } from './contract-check-actions';
import type { ContractCheckActionState } from './contract-check-actions';
import { runOfferCheckAction } from './offer-check-actions';
import type { OfferCheckActionState } from './offer-check-actions';
import {
  DOCUMENT_TYPE_OPTIONS,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUS_OPTIONS,
} from '@/lib/constants/form-options';
import type { Database } from '@/lib/supabase/database.types';

type DocumentRow = Database['public']['Tables']['documents']['Row'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

const STATUS_COLORS: Record<string, string> = {
  uploaded:     'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  needs_review: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
  reviewed:     'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
  missing:      'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  rejected:     'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
};

// ─── Status update form ───────────────────────────────────────────────────────

function StatusUpdateForm({
  documentId,
  caseId,
  currentStatus,
}: {
  documentId: string;
  caseId: string;
  currentStatus: string;
}) {
  const [state, formAction] = useFormState<UpdateStatusState, FormData>(
    updateDocumentStatusAction,
    null,
  );

  return (
    <div>
      <form action={formAction} className="flex items-center gap-1.5 mt-1.5">
        <input type="hidden" name="document_id" value={documentId} />
        <input type="hidden" name="case_id" value={caseId} />
        <select
          name="status"
          defaultValue={currentStatus}
          className="text-xs rounded border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400"
        >
          {DOCUMENT_STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <StatusSubmitButton />
      </form>
      {state?.wasReviewed && (
        <p className="mt-1 text-xs text-green-700 dark:text-green-400">
          {state.tasksCompleted > 0
            ? `Dokument geprüft. ${state.tasksCompleted === 1 ? 'Passende Aufgabe wurde' : `${state.tasksCompleted} passende Aufgaben wurden`} automatisch erledigt.`
            : 'Dokument geprüft.'}
        </p>
      )}
      {state?.error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </div>
  );
}

function StatusSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-xs rounded border border-gray-200 dark:border-gray-700 px-2 py-0.5 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
    >
      {pending ? '…' : 'Speichern'}
    </button>
  );
}

// ─── Upload form ──────────────────────────────────────────────────────────────

function UploadForm({
  caseId,
  onSuccess,
}: {
  caseId: string;
  onSuccess: () => void;
}) {
  const [state, formAction] = useFormState<DocumentActionState, FormData>(
    uploadCaseDocumentAction,
    null,
  );

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state?.success, onSuccess]);

  return (
    <form
      action={formAction}
      className="mt-4 space-y-3 border-t border-gray-100 dark:border-gray-800 pt-4"
      encType="multipart/form-data"
    >
      <input type="hidden" name="case_id" value={caseId} />

      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          Dokumenttyp <span className="text-red-500">*</span>
        </label>
        <select
          name="document_type"
          required
          className="w-full rounded-md border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400"
        >
          {DOCUMENT_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          Datei <span className="text-red-500">*</span>
        </label>
        <input
          name="file"
          type="file"
          required
          accept=".pdf,.jpg,.jpeg,.png,.heic,.heif"
          className="w-full text-sm text-gray-700 dark:text-gray-300 file:mr-3 file:rounded file:border-0 file:bg-gray-100 dark:file:bg-gray-700 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-gray-700 dark:file:text-gray-200 hover:file:bg-gray-200 dark:hover:file:bg-gray-600"
        />
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">PDF, JPG, PNG, HEIC · max. 15 MB</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Notiz</label>
        <input
          name="notes"
          type="text"
          placeholder="Optional…"
          className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400 placeholder:text-gray-400 dark:placeholder:text-gray-500"
        />
      </div>

      {state?.error && (
        <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <div className="flex justify-end">
        <UploadSubmitButton />
      </div>
    </form>
  );
}

function UploadSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-gray-900 dark:bg-gray-100 px-3 py-1.5 text-xs font-medium text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-200 disabled:opacity-50 transition-colors"
    >
      {pending ? 'Hochladen…' : 'Hochladen'}
    </button>
  );
}

// ─── Contract check button ────────────────────────────────────────────────────

function ContractCheckSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1 rounded border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 disabled:opacity-50 transition-colors"
    >
      <ScanSearch className="h-3 w-3" />
      {pending ? 'Vertrag wird geprüft…' : 'Vertrag prüfen'}
    </button>
  );
}

function ContractCheckForm({ documentId, caseId }: { documentId: string; caseId: string }) {
  const [state, formAction] = useFormState<ContractCheckActionState, FormData>(
    runContractCheckAction,
    null,
  );
  return (
    <div className="mt-1.5">
      <form action={formAction}>
        <input type="hidden" name="case_id" value={caseId} />
        <input type="hidden" name="document_id" value={documentId} />
        <ContractCheckSubmitButton />
      </form>
      {state?.success && (
        <p className="mt-1 text-xs text-green-700 dark:text-green-400">
          Vertragsprüfung gestartet – Ergebnis in KI-Prüfungen.
        </p>
      )}
      {state?.error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </div>
  );
}

// ─── Offer check button ───────────────────────────────────────────────────────

function OfferCheckSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1 rounded border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950 px-2 py-0.5 text-xs font-medium text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900 disabled:opacity-50 transition-colors"
    >
      <ScanSearch className="h-3 w-3" />
      {pending ? 'Angebot wird geprüft…' : 'Angebot prüfen'}
    </button>
  );
}

function OfferCheckForm({ documentId, caseId }: { documentId: string; caseId: string }) {
  const [state, formAction] = useFormState<OfferCheckActionState, FormData>(
    runOfferCheckAction,
    null,
  );
  return (
    <div className="mt-1.5">
      <form action={formAction}>
        <input type="hidden" name="case_id" value={caseId} />
        <input type="hidden" name="document_id" value={documentId} />
        <OfferCheckSubmitButton />
      </form>
      {state?.success && (
        <p className="mt-1 text-xs text-green-700 dark:text-green-400">
          Angebotsprüfung gestartet – Ergebnis in KI-Prüfungen.
        </p>
      )}
      {state?.error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </div>
  );
}

// ─── Document item ────────────────────────────────────────────────────────────

function DocumentItem({
  doc,
  signedUrl,
  caseId,
}: {
  doc: DocumentRow;
  signedUrl?: string;
  caseId: string;
}) {
  return (
    <div className="py-2.5 border-b border-gray-50 dark:border-gray-800 last:border-0" data-doc-type={doc.type} data-doc-status={doc.status}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {DOCUMENT_TYPE_LABELS[doc.type] ?? doc.type}
          </p>
          <p className="text-sm text-gray-900 dark:text-gray-100 truncate mt-0.5" title={doc.name}>
            {doc.name}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {formatDate(doc.uploaded_at)}
            {doc.file_size_bytes ? ` · ${formatFileSize(doc.file_size_bytes)}` : ''}
          </p>
          {doc.notes && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 italic">{doc.notes}</p>
          )}
        </div>

        {signedUrl && (
          <a
            href={signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Herunterladen"
            className="flex-shrink-0 mt-1 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <Download className="h-4 w-4" />
          </a>
        )}
      </div>

      <div className="flex items-center gap-2 mt-1.5">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[doc.status] ?? 'bg-gray-100 text-gray-600'}`}
        >
          {DOCUMENT_STATUS_LABELS[doc.status] ?? doc.status}
        </span>
      </div>

      <StatusUpdateForm
        documentId={doc.id}
        caseId={caseId}
        currentStatus={doc.status}
      />

      {doc.type === 'contract' &&
        (doc.status === 'uploaded' || doc.status === 'needs_review' || doc.status === 'reviewed') && (
        <ContractCheckForm documentId={doc.id} caseId={caseId} />
      )}
      {doc.type === 'offer' && doc.status !== 'missing' && (
        <OfferCheckForm documentId={doc.id} caseId={caseId} />
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DocumentsSection({
  caseId,
  initialDocuments,
  signedUrls,
}: {
  caseId: string;
  initialDocuments: DocumentRow[];
  signedUrls: Record<string, string>;
}) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-300 dark:border-gray-800 p-5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-gray-400 dark:text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Dokumente</h2>
          {initialDocuments.length > 0 && (
            <span className="text-xs text-gray-400 dark:text-gray-500">{initialDocuments.length}</span>
          )}
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          {showForm ? (
            <><ChevronUp className="h-3.5 w-3.5" />Schließen</>
          ) : (
            <><Plus className="h-3.5 w-3.5" />Hochladen</>
          )}
        </button>
      </div>

      {initialDocuments.length === 0 && !showForm && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">Noch keine Dokumente hochgeladen.</p>
      )}

      {initialDocuments.map((doc) => (
        <DocumentItem
          key={doc.id}
          doc={doc}
          signedUrl={signedUrls[doc.storage_path]}
          caseId={caseId}
        />
      ))}

      {showForm && (
        <UploadForm caseId={caseId} onSuccess={() => setShowForm(false)} />
      )}
    </div>
  );
}
