'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useState } from 'react';
import { Bot, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, XCircle, Info, ShieldAlert } from 'lucide-react';
import {
  runFundingPrecheckAction,
  markAICheckApprovedAction,
  markAICheckRejectedAction,
} from './ai-actions';
import type { AICheckActionState } from './ai-actions';
import type { Database } from '@/lib/supabase/database.types';
import type { FundingPrecheckResult } from '@/lib/ai/types';

type AICheckRow = Database['public']['Tables']['ai_checks']['Row'];

// ─── Badge helpers ────────────────────────────────────────────────────────────

const ASSESSMENT_CONFIG = {
  likely_eligible: { label: 'Wahrscheinlich förderfähig', cls: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' },
  unclear:         { label: 'Unklar',                      cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300' },
  critical:        { label: 'Kritisch',                    cls: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' },
} as const;

const RISK_CONFIG = {
  green:  { label: 'Risiko: Niedrig',   cls: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' },
  yellow: { label: 'Risiko: Mittel',    cls: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300' },
  red:    { label: 'Risiko: Hoch',      cls: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' },
} as const;

const CONFIDENCE_LABEL: Record<string, string> = {
  high:   'Konfidenz: Hoch',
  medium: 'Konfidenz: Mittel',
  low:    'Konfidenz: Niedrig',
};

const REVIEW_CONFIG = {
  pending:  { label: 'Prüfung offen',  cls: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300' },
  approved: { label: 'Freigegeben',    cls: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' },
  rejected: { label: 'Abgelehnt',      cls: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' },
} as const;

const SEVERITY_DOT: Record<string, string> = {
  high:   'bg-red-500',
  medium: 'bg-yellow-400',
  low:    'bg-gray-300',
};

const BONUS_STATUS_CONFIG = {
  possible:  { label: 'Möglich',     cls: 'text-green-700' },
  unclear:   { label: 'Unklar',      cls: 'text-yellow-700' },
  unlikely:  { label: 'Unwahrscheinlich', cls: 'text-gray-500' },
} as const;

function Badge({ label, cls }: { label: string; cls: string }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Run button ───────────────────────────────────────────────────────────────

function RunButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
    >
      <Bot className="h-3.5 w-3.5" />
      {pending ? 'KI-Analyse läuft…' : 'KI-Fördercheck erstellen'}
    </button>
  );
}

// ─── Review buttons ───────────────────────────────────────────────────────────

function ReviewButtons({ checkId, caseId }: { checkId: string; caseId: string }) {
  return (
    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
      <form action={markAICheckApprovedAction} className="flex-1">
        <input type="hidden" name="check_id" value={checkId} />
        <input type="hidden" name="case_id" value={caseId} />
        <button
          type="submit"
          className="w-full rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950 px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900 transition-colors flex items-center justify-center gap-1"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Freigeben
        </button>
      </form>
      <form action={markAICheckRejectedAction} className="flex-1">
        <input type="hidden" name="check_id" value={checkId} />
        <input type="hidden" name="case_id" value={caseId} />
        <button
          type="submit"
          className="w-full rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900 transition-colors flex items-center justify-center gap-1"
        >
          <XCircle className="h-3.5 w-3.5" />
          Ablehnen
        </button>
      </form>
    </div>
  );
}

// ─── Single check card ────────────────────────────────────────────────────────

function AICheckCard({
  check,
  caseId,
  defaultOpen,
}: {
  check: AICheckRow;
  caseId: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [emailOpen, setEmailOpen] = useState(false);

  const result = check.status === 'completed'
    ? (check.result_json as unknown as FundingPrecheckResult)
    : null;

  const reviewCfg = REVIEW_CONFIG[check.human_review_status as keyof typeof REVIEW_CONFIG]
    ?? REVIEW_CONFIG.pending;

  const assessmentCfg = result
    ? ASSESSMENT_CONFIG[result.overall_assessment] ?? ASSESSMENT_CONFIG.unclear
    : null;

  const riskCfg = check.risk_level
    ? RISK_CONFIG[check.risk_level as keyof typeof RISK_CONFIG] ?? null
    : null;

  return (
    <div className="border border-gray-300 dark:border-gray-700 rounded-md overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start justify-between gap-2 px-3 py-2.5 text-left bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {assessmentCfg && <Badge label={assessmentCfg.label} cls={assessmentCfg.cls} />}
            {riskCfg       && <Badge label={riskCfg.label}       cls={riskCfg.cls}       />}
            {check.confidence && (
              <span className="text-xs text-gray-500 dark:text-gray-400">{CONFIDENCE_LABEL[check.confidence]}</span>
            )}
            <Badge label={reviewCfg.label} cls={reviewCfg.cls} />
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {formatDate(check.created_at)} · {check.provider}/{check.model}
          </p>
        </div>
        <span className="flex-shrink-0 mt-0.5 text-gray-400 dark:text-gray-500">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {/* Body */}
      {open && (
        <div className="px-3 pb-3 pt-2 space-y-3 text-sm bg-white dark:bg-gray-900">
          {/* Failed state */}
          {check.status === 'failed' && (
            <div className="rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-3 py-2">
              <p className="text-xs font-medium text-red-700 dark:text-red-300">KI-Analyse fehlgeschlagen</p>
              {result === null && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">Kein gültiges Ergebnis gespeichert.</p>
              )}
            </div>
          )}

          {result && (
            <>
              {/* Summary */}
              {result.summary_de && (
                <p className="text-sm text-gray-800 dark:text-gray-200">{result.summary_de}</p>
              )}

              {/* Missing information */}
              {result.missing_information.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    Fehlende Informationen
                  </p>
                  <ul className="space-y-0.5">
                    {result.missing_information.map((item, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700 dark:text-gray-300">
                        <span className="mt-1 flex-shrink-0 h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-gray-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Blocking items */}
              {result.blocking_items.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wide mb-1">
                    Blockierende Punkte
                  </p>
                  <ul className="space-y-0.5">
                    {result.blocking_items.map((item, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-red-700 dark:text-red-400">
                        <AlertTriangle className="mt-0.5 flex-shrink-0 h-3 w-3" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Possible bonuses */}
              {result.possible_bonuses.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    Mögliche Boni
                  </p>
                  <ul className="space-y-1">
                    {result.possible_bonuses.map((b, i) => {
                      const cfg = BONUS_STATUS_CONFIG[b.status] ?? BONUS_STATUS_CONFIG.unclear;
                      return (
                        <li key={i} className="text-xs">
                          <span className="font-medium text-gray-800 dark:text-gray-200">{b.name}</span>
                          {' – '}
                          <span className={cfg.cls}>{cfg.label}</span>
                          <span className="text-gray-500 dark:text-gray-400"> · {b.reason_de}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Detected risks */}
              {result.detected_risks.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    Erkannte Risiken
                  </p>
                  <ul className="space-y-2">
                    {result.detected_risks.map((r, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span
                          className={`mt-1.5 flex-shrink-0 h-2 w-2 rounded-full ${SEVERITY_DOT[r.severity] ?? 'bg-gray-300'}`}
                        />
                        <div className="min-w-0">
                          <p className="text-xs text-gray-800 dark:text-gray-200">{r.risk_de}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 italic mt-0.5">{r.recommended_action_de}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Next steps */}
              {result.recommended_next_steps.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    Empfohlene nächste Schritte
                  </p>
                  <ol className="space-y-0.5 list-decimal list-inside">
                    {result.recommended_next_steps.map((step, i) => (
                      <li key={i} className="text-xs text-gray-700 dark:text-gray-300">{step}</li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Customer message draft – collapsible */}
              {result.customer_message_draft_de && (
                <div>
                  <button
                    onClick={() => setEmailOpen((v) => !v)}
                    className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    {emailOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    Kundenmail-Entwurf
                  </button>
                  {emailOpen && (
                    <pre className="mt-1.5 text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2.5 whitespace-pre-wrap font-sans leading-relaxed">
                      {result.customer_message_draft_de}
                    </pre>
                  )}
                </div>
              )}

              {/* Internal notes */}
              {result.internal_notes_de.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    Interne Hinweise
                  </p>
                  <ul className="space-y-0.5">
                    {result.internal_notes_de.map((note, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                        <Info className="mt-0.5 flex-shrink-0 h-3 w-3 text-gray-400 dark:text-gray-500" />
                        {note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {/* Disclaimer */}
          <p className="text-xs text-gray-400 dark:text-gray-500 italic border-t border-gray-100 dark:border-gray-800 pt-2">
            {check.disclaimer || 'KI-Ergebnis erfordert manuelle Prüfung. Keine Fördergarantie.'}
          </p>

          {/* Review buttons */}
          {check.human_review_status === 'pending' && check.status === 'completed' && (
            <ReviewButtons checkId={check.id} caseId={caseId} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main section ─────────────────────────────────────────────────────────────

export default function AIChecksSection({
  caseId,
  initialChecks,
}: {
  caseId: string;
  initialChecks: AICheckRow[];
}) {
  const [state, formAction] = useFormState<AICheckActionState, FormData>(
    runFundingPrecheckAction,
    null,
  );

  const checks = [...initialChecks].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-300 dark:border-gray-800 p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <ShieldAlert className="h-4 w-4 text-gray-400 dark:text-gray-500" />
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">KI-Fördercheck</h2>
        {checks.length > 0 && (
          <span className="text-xs text-gray-400 dark:text-gray-500">{checks.length}</span>
        )}
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 rounded-md px-2.5 py-1.5 mt-2">
        KI-Ergebnis ist eine Vorprüfung. Keine Fördergarantie. Manuelle Prüfung erforderlich.
      </p>

      {/* Run button */}
      <form action={formAction} className="mt-3">
        <input type="hidden" name="case_id" value={caseId} />
        {state?.error && (
          <p className="text-xs text-red-600 dark:text-red-400 mb-1.5">
            {state.error.startsWith('KI-Prüfung fehlgeschlagen:')
              ? 'KI-Prüfung konnte nicht ausgewertet werden. Bitte erneut versuchen.'
              : state.error}
          </p>
        )}
        <RunButton />
      </form>

      {/* Checks list */}
      {checks.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">Noch kein KI-Check durchgeführt.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {checks.map((check, idx) => (
            <AICheckCard
              key={check.id}
              check={check}
              caseId={caseId}
              defaultOpen={idx === 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
