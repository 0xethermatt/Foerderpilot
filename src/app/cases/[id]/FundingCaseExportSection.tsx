'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useState } from 'react';
import { Download, Copy, Check, FileText } from 'lucide-react';
import { generateFundingCaseMarkdownAction } from './export-actions';
import type { ExportActionState } from './export-actions';
import type { ExportVariant } from '@/lib/export/funding-case-markdown';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function GenerateBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-3 py-1.5 text-xs font-medium hover:bg-gray-700 dark:hover:bg-gray-100 disabled:opacity-50 transition-colors"
    >
      <FileText className="h-3.5 w-3.5" />
      {pending ? 'Generiere …' : 'Export generieren'}
    </button>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
    >
      {copied
        ? <><Check className="h-3.5 w-3.5 text-green-600" /><span className="text-green-700 dark:text-green-400">Kopiert!</span></>
        : <><Copy className="h-3.5 w-3.5" />Markdown kopieren</>
      }
    </button>
  );
}

function DownloadButton({
  markdown,
  customerLastName,
}: {
  markdown: string;
  customerLastName: string | undefined;
}) {
  function handleDownload() {
    const date = new Date().toISOString().slice(0, 10);
    const name = customerLastName?.toLowerCase().replace(/[^a-z0-9]+/g, '-') ?? 'export';
    const filename = `foerderakte-${name}-${date}.md`;
    const blob = new Blob([markdown], { type: 'text/markdown; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <button
      onClick={handleDownload}
      className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
    >
      <Download className="h-3.5 w-3.5" />
      .md herunterladen
    </button>
  );
}

// ─── Option toggle ─────────────────────────────────────────────────────────────

function Toggle({
  name,
  value,
  label,
  checked,
  onChange,
}: {
  name: string;
  value: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        name={name}
        value={value}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-gray-400"
      />
      <span className="text-xs text-gray-600 dark:text-gray-400">{label}</span>
    </label>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FundingCaseExportSection({
  caseId,
  readinessLabel,
  hasBlockers,
}: {
  caseId: string;
  readinessLabel: string;
  hasBlockers: boolean;
}) {
  const [state, formAction] = useFormState<ExportActionState, FormData>(
    generateFundingCaseMarkdownAction,
    null,
  );

  const [variant,         setVariant]         = useState<ExportVariant>('internal');
  const [includeAI,       setIncludeAI]       = useState(true);
  const [includeDone,     setIncludeDone]      = useState(false);
  const [includeDiscl,    setIncludeDiscl]    = useState(true);
  const [previewExpanded, setPreviewExpanded] = useState(false);

  const exportStatus = hasBlockers
    ? 'Mit offenen Punkten'
    : readinessLabel === 'Antragsbereit'
    ? 'Bereit'
    : 'In Bearbeitung';

  const statusCls = hasBlockers
    ? 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300'
    : readinessLabel === 'Antragsbereit'
    ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';

  const variantLabels: Record<ExportVariant, string> = {
    internal:  'Interner Export',
    customer:  'Kundenzusammenfassung',
    handover:  'Fachbetrieb/BzA-Übergabe',
  };

  return (
    <div className="space-y-4">
      {/* Status summary */}
      <div className="flex items-center gap-2 text-xs">
        <span className={`inline-flex rounded-full px-2 py-0.5 font-medium ${statusCls}`}>
          {exportStatus}
        </span>
        <span className="text-gray-500 dark:text-gray-400">
          Interne Förderakte als Markdown exportieren oder kopieren.
        </span>
      </div>

      {/* Controls form */}
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="case_id" value={caseId} />
        <input type="hidden" name="include_ai" value={includeAI ? 'true' : 'false'} />
        <input type="hidden" name="include_done_tasks" value={includeDone ? 'true' : 'false'} />
        <input type="hidden" name="include_disclaimer" value={includeDiscl ? 'true' : 'false'} />

        {/* Variant selector */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Exporttyp
          </label>
          <select
            name="variant"
            value={variant}
            onChange={(e) => setVariant(e.target.value as ExportVariant)}
            className="text-xs rounded border border-gray-200 dark:border-gray-700 px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400"
          >
            {(Object.keys(variantLabels) as ExportVariant[]).map((v) => (
              <option key={v} value={v}>{variantLabels[v]}</option>
            ))}
          </select>
        </div>

        {/* Toggles */}
        <div className="flex flex-wrap gap-3">
          {variant === 'internal' && (
            <Toggle
              name="include_ai_display"
              value="true"
              label="KI-Details einbeziehen"
              checked={includeAI}
              onChange={setIncludeAI}
            />
          )}
          <Toggle
            name="include_done_display"
            value="true"
            label="Erledigte Aufgaben einbeziehen"
            checked={includeDone}
            onChange={setIncludeDone}
          />
          <Toggle
            name="include_discl_display"
            value="true"
            label="Disclaimer einbeziehen"
            checked={includeDiscl}
            onChange={setIncludeDiscl}
          />
        </div>

        <GenerateBtn />
      </form>

      {/* Error */}
      {state?.error && (
        <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>
      )}

      {/* Generated markdown */}
      {state?.success && state.markdown && (
        <div className="space-y-3 border-t border-gray-100 dark:border-gray-800 pt-3">
          <div className="flex flex-wrap gap-2 items-center">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Vorschau
            </p>
            <button
              onClick={() => setPreviewExpanded((v) => !v)}
              className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {previewExpanded ? 'Einklappen' : 'Ausklappen'}
            </button>
          </div>

          <pre
            className={`text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-md p-3 whitespace-pre-wrap font-mono leading-relaxed overflow-y-auto transition-all ${
              previewExpanded ? 'max-h-[600px]' : 'max-h-[200px]'
            }`}
          >
            {state.markdown}
          </pre>

          <div className="flex flex-wrap gap-2">
            <CopyButton text={state.markdown} />
            <DownloadButton
              markdown={state.markdown}
              customerLastName={state.customer_last_name}
            />
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 rounded-md px-2.5 py-1.5">
        Interne Arbeitsunterlage · keine Fördergarantie · keine automatische Antragstellung oder Nachweiseinreichung
      </p>
    </div>
  );
}
