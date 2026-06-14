'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Download,
  ScanSearch,
  Upload,
  Plus,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Clock,
  MoreHorizontal,
} from 'lucide-react';
import { uploadCaseDocumentAction, updateDocumentStatusAction } from './document-actions';
import type { DocumentActionState, UpdateStatusState } from './document-actions';
import { runContractCheckAction } from './contract-check-actions';
import type { ContractCheckActionState } from './contract-check-actions';
import { runOfferCheckAction } from './offer-check-actions';
import type { OfferCheckActionState } from './offer-check-actions';
import { DOCUMENT_TYPE_OPTIONS, DOCUMENT_STATUS_OPTIONS } from '@/lib/constants/form-options';
import type { ChecklistItem } from '@/lib/documents/checklist';
import type { Database } from '@/lib/supabase/database.types';

type DocumentRow = Database['public']['Tables']['documents']['Row'];
type AICheckRow  = Database['public']['Tables']['ai_checks']['Row'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

// Missing = orange (normal, expected); Rejected = red (action required)
const STATUS_DOT: Record<string, string> = {
  missing:      'bg-orange-300 dark:bg-orange-600',
  needs_review: 'bg-yellow-400',
  reviewed:     'bg-green-500',
  rejected:     'bg-red-500',
};

const STATUS_BADGE: Record<string, string> = {
  missing:      'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  needs_review: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
  reviewed:     'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
  rejected:     'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
};

const STATUS_LABEL: Record<string, string> = {
  missing:      'Offen',
  needs_review: 'Ausstehend',
  reviewed:     'Geprüft',
  rejected:     'Abgelehnt',
};

// ─── Column grid class – shared between header + rows ──────────────────────────
// mobile: [name+status] [actions]
// sm+:    [name] [file] [status] [KI] [actions]
const COL_GRID = 'grid-cols-[1fr_auto] sm:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_5.5rem_8rem_auto]';

// ─── AI check summary ─────────────────────────────────────────────────────────

function AICheckBadge({ aiChecks, docType, hasDoc }: { aiChecks: AICheckRow[]; docType: string; hasDoc: boolean }) {
  const checkType =
    docType === 'contract' ? 'contract_check' :
    docType === 'offer'    ? 'offer_check'    : null;

  if (!checkType) return null;

  const latest = aiChecks
    .filter((c) => c.check_type === checkType && c.status === 'completed')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  if (!latest) {
    if (!hasDoc) return null;
    return <span className="text-xs text-gray-400 dark:text-gray-500">Keine KI-Prüfung</span>;
  }

  const review = latest.human_review_status;
  if (review === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
        <CheckCircle2 className="h-3 w-3 flex-shrink-0" />Freigegeben
      </span>
    );
  }
  if (review === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-700 dark:text-red-400">
        <XCircle className="h-3 w-3 flex-shrink-0" />Abgelehnt
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-yellow-700 dark:text-yellow-400">
      <Clock className="h-3 w-3 flex-shrink-0" />Prüfung offen
    </span>
  );
}

// ─── Status update form ───────────────────────────────────────────────────────

function StatusSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-xs rounded border border-gray-200 dark:border-gray-700 px-2 py-0.5 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
    >
      {pending ? '…' : 'OK'}
    </button>
  );
}

function StatusUpdateForm({ documentId, caseId, currentStatus }: {
  documentId: string; caseId: string; currentStatus: string;
}) {
  const [state, formAction] = useFormState<UpdateStatusState, FormData>(updateDocumentStatusAction, null);
  return (
    <div>
      <form action={formAction} className="flex items-center gap-1">
        <input type="hidden" name="document_id" value={documentId} />
        <input type="hidden" name="case_id" value={caseId} />
        <select
          name="status"
          defaultValue={currentStatus}
          className="text-xs rounded border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400"
        >
          {DOCUMENT_STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <StatusSubmitButton />
      </form>
      {state?.wasReviewed && (
        <p className="mt-0.5 text-xs text-green-700 dark:text-green-400">Gespeichert.</p>
      )}
      {state?.error && (
        <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </div>
  );
}

// ─── AI check inline buttons ──────────────────────────────────────────────────

function ContractCheckInlineButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1 rounded border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 disabled:opacity-50 transition-colors whitespace-nowrap"
    >
      <ScanSearch className="h-3 w-3 flex-shrink-0" />
      {pending ? 'Läuft…' : 'Vertrag prüfen'}
    </button>
  );
}

function OfferCheckInlineButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1 rounded border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950 px-2 py-0.5 text-xs font-medium text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900 disabled:opacity-50 transition-colors whitespace-nowrap"
    >
      <ScanSearch className="h-3 w-3 flex-shrink-0" />
      {pending ? 'Läuft…' : 'Angebot prüfen'}
    </button>
  );
}

// ─── Single document row (compact table row) ──────────────────────────────────

function DocRow({ item, doc, signedUrl, caseId, aiChecks, onUploadClick }: {
  item: ChecklistItem;
  doc: DocumentRow | undefined;
  signedUrl: string | undefined;
  caseId: string;
  aiChecks: AICheckRow[];
  onUploadClick: (docType: string) => void;
}) {
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const [contractState, contractFormAction] = useFormState<ContractCheckActionState, FormData>(runContractCheckAction, null);
  const [offerState, offerFormAction]       = useFormState<OfferCheckActionState, FormData>(runOfferCheckAction, null);

  useEffect(() => {
    if (contractState?.success || offerState?.success) router.refresh();
  }, [contractState?.success, offerState?.success, router]);

  const isContract = item.document_type === 'contract';
  const isOffer    = item.document_type === 'offer';
  const isMissing  = item.status === 'missing';
  const isRejected = item.status === 'rejected';

  return (
    <div className={`border-b border-gray-50 dark:border-gray-800 last:border-0 transition-colors ${moreOpen ? 'bg-gray-50/70 dark:bg-gray-800/30' : ''}`}>
      {/* ── Main compact row ── */}
      <div className={`grid ${COL_GRID} items-center gap-x-3 py-2 min-h-[44px]`}>

        {/* Col 1: dot + name (+ status + KI on mobile) */}
        <div className="flex items-center gap-2 min-w-0">
          <span className={`h-2 w-2 flex-shrink-0 rounded-full ${STATUS_DOT[item.status] ?? 'bg-gray-300'}`} />
          <div className="min-w-0">
            <span className="text-xs font-medium text-gray-800 dark:text-gray-200 block truncate leading-snug">
              {item.label_de}
            </span>
            <div className="flex flex-wrap items-center gap-1.5 mt-0.5 sm:hidden">
              <span className={`inline-flex rounded-full px-1.5 py-0.5 text-xs font-medium ${STATUS_BADGE[item.status] ?? ''}`}>
                {STATUS_LABEL[item.status] ?? item.status}
              </span>
              <AICheckBadge aiChecks={aiChecks} docType={item.document_type} hasDoc={!!doc} />
            </div>
          </div>
        </div>

        {/* Col 2: filename (sm+) */}
        <div className="hidden sm:block min-w-0">
          {doc ? (
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate block" title={doc.name}>
              {truncate(doc.name, 36)}
            </span>
          ) : item.hint_de ? (
            <span className="text-xs text-gray-400 dark:text-gray-500 italic truncate block">{item.hint_de}</span>
          ) : (
            <span className="text-xs text-gray-300 dark:text-gray-600">–</span>
          )}
        </div>

        {/* Col 3: Status badge (sm+) */}
        <div className="hidden sm:flex items-center">
          <span className={`inline-flex rounded-full px-1.5 py-0.5 text-xs font-medium ${STATUS_BADGE[item.status] ?? ''}`}>
            {STATUS_LABEL[item.status] ?? item.status}
          </span>
        </div>

        {/* Col 4: KI-Prüfung (sm+) */}
        <div className="hidden sm:flex items-center">
          <AICheckBadge aiChecks={aiChecks} docType={item.document_type} hasDoc={!!doc} />
        </div>

        {/* Col 5: Actions */}
        <div className="flex items-center gap-1 justify-end flex-shrink-0">
          {/* Upload for missing / rejected */}
          {(isMissing || isRejected) && (
            <button
              type="button"
              onClick={() => onUploadClick(item.document_type)}
              className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium transition-colors ${
                isRejected
                  ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900'
                  : 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900'
              }`}
            >
              <Upload className="h-3 w-3 flex-shrink-0" />
              <span className="hidden sm:inline">{isRejected ? 'Ersetzen' : 'Hochladen'}</span>
            </button>
          )}

          {/* AI check buttons */}
          {doc && isContract && (
            <form action={contractFormAction} className="inline">
              <input type="hidden" name="case_id" value={caseId} />
              <input type="hidden" name="document_id" value={doc.id} />
              <ContractCheckInlineButton />
            </form>
          )}
          {doc && isOffer && (
            <form action={offerFormAction} className="inline">
              <input type="hidden" name="case_id" value={caseId} />
              <input type="hidden" name="document_id" value={doc.id} />
              <OfferCheckInlineButton />
            </form>
          )}

          {/* Download */}
          {signedUrl && (
            <a
              href={signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Herunterladen"
              className="p-1 rounded text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
            </a>
          )}

          {/* More: status / replace */}
          {doc && (
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              title="Status ändern"
              className={`p-1 rounded transition-colors ${
                moreOpen
                  ? 'text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Expanded panel: status form + replace ── */}
      {moreOpen && doc && (
        <div className="pb-2 pl-6 pr-3 flex flex-wrap items-center gap-2">
          <StatusUpdateForm documentId={doc.id} caseId={caseId} currentStatus={doc.status} />
          <button
            type="button"
            onClick={() => { onUploadClick(item.document_type); setMoreOpen(false); }}
            className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors whitespace-nowrap"
          >
            Datei ersetzen
          </button>
          {contractState?.error && (
            <p className="w-full text-xs text-red-600 dark:text-red-400">{contractState.error}</p>
          )}
          {offerState?.error && (
            <p className="w-full text-xs text-red-600 dark:text-red-400">{offerState.error}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Upload form ──────────────────────────────────────────────────────────────

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

function UploadSection({ caseId, preSelectedType, onClose }: {
  caseId: string; preSelectedType: string; onClose: () => void;
}) {
  const [state, formAction] = useFormState<DocumentActionState, FormData>(uploadCaseDocumentAction, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) { router.refresh(); onClose(); }
  }, [state?.success, router, onClose]);

  return (
    <form
      action={formAction}
      className="mt-3 border-t border-gray-100 dark:border-gray-800 pt-4 space-y-3"
      encType="multipart/form-data"
    >
      <input type="hidden" name="case_id" value={caseId} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Dokumenttyp <span className="text-red-500">*</span>
          </label>
          <select
            name="document_type"
            required
            defaultValue={preSelectedType}
            className="w-full rounded-md border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400"
          >
            {DOCUMENT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
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
      {state?.error && <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          Abbrechen
        </button>
        <UploadSubmitButton />
      </div>
    </form>
  );
}

// ─── Table header row (desktop only) ──────────────────────────────────────────

function TableHeader() {
  return (
    <div className={`hidden sm:grid ${COL_GRID} gap-x-3 pb-1.5 mb-0.5 border-b border-gray-100 dark:border-gray-800`}>
      <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide pl-4">Dokument</span>
      <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Datei</span>
      <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Status</span>
      <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">KI-Prüfung</span>
      <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide text-right">Aktion</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CompactDocumentsTable({
  caseId,
  checklistItems,
  documents,
  signedUrls,
  aiChecks,
}: {
  caseId: string;
  checklistItems: ChecklistItem[];
  documents: DocumentRow[];
  signedUrls: Record<string, string>;
  aiChecks: AICheckRow[];
}) {
  const [uploadType, setUploadType] = useState<string | null>(null);
  const [laterOpen,  setLaterOpen]  = useState(false);
  const uploadRef = useRef<HTMLDivElement>(null);

  function handleUploadClick(docType: string) {
    setUploadType(docType);
    setTimeout(() => uploadRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
  }

  const docsById: Record<string, DocumentRow> = {};
  for (const doc of documents) docsById[doc.id] = doc;

  const docByType: Record<string, DocumentRow | undefined> = {};
  for (const item of checklistItems) {
    if (item.latest_document_id) docByType[item.document_type] = docsById[item.latest_document_id];
  }

  const beforeApp    = checklistItems.filter((i) => i.phase === 'before_application' && i.required);
  const laterItems   = checklistItems.filter((i) =>
    (i.phase === 'after_approval' || i.phase === 'after_completion') && i.required,
  );
  const otherUploaded = checklistItems.filter((i) => !i.required && i.latest_document_id);

  const openCount    = beforeApp.filter((i) => i.status !== 'reviewed').length;
  const uploadedAll  = documents.filter((d) => d.type !== 'other');
  const laterHasData = laterItems.some((i) => i.status !== 'missing') || otherUploaded.length > 0;

  function rowProps(item: ChecklistItem) {
    const doc = docByType[item.document_type];
    return {
      item,
      doc,
      signedUrl: doc ? signedUrls[doc.storage_path] : undefined,
      caseId,
      aiChecks,
      onUploadClick: handleUploadClick,
    };
  }

  return (
    <div id="documents" className="bg-white dark:bg-gray-900 rounded-lg border border-gray-300 dark:border-gray-800 p-4 sm:p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-gray-400 dark:text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Dokumente</h2>
          {openCount > 0 && (
            <span className="inline-flex items-center justify-center h-4 min-w-[1rem] rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 text-xs font-semibold px-1">
              {openCount}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setUploadType(uploadType === null ? 'offer' : null)}
          className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          {uploadType !== null
            ? <><ChevronUp className="h-3.5 w-3.5" />Schließen</>
            : <><Plus className="h-3.5 w-3.5" />Hochladen</>}
        </button>
      </div>

      {/* Before-application required docs + column headers */}
      <div>
        <TableHeader />
        {beforeApp.map((item) => (
          <DocRow key={item.document_type} {...rowProps(item)} />
        ))}
      </div>

      {/* Later-phase docs – collapsible */}
      {(laterItems.length > 0 || otherUploaded.length > 0) && (
        <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-800">
          <button
            type="button"
            onClick={() => setLaterOpen((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            {laterOpen
              ? <ChevronUp className="h-3.5 w-3.5" />
              : <ChevronDown className="h-3.5 w-3.5" />}
            Weitere Unterlagen später
            {laterHasData && (
              <span className="ml-0.5 text-xs font-normal">(teilweise vorhanden)</span>
            )}
          </button>

          {laterOpen && (
            <div className="mt-2">
              {[...laterItems, ...otherUploaded].map((item) => (
                <DocRow key={item.document_type} {...rowProps(item)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upload form */}
      <div ref={uploadRef}>
        {uploadType !== null && (
          <UploadSection
            caseId={caseId}
            preSelectedType={uploadType}
            onClose={() => setUploadType(null)}
          />
        )}
      </div>

      {uploadedAll.length > 0 && (
        <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
          {uploadedAll.length} Datei{uploadedAll.length !== 1 ? 'en' : ''} hochgeladen
        </p>
      )}
    </div>
  );
}
