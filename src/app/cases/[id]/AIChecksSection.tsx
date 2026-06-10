'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useState } from 'react';
import { Bot, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, XCircle, Info, ShieldAlert, ArrowRight } from 'lucide-react';
import {
  runFundingPrecheckAction,
  markAICheckApprovedAction,
  markAICheckRejectedAction,
} from './ai-actions';
import type { AICheckActionState } from './ai-actions';
import type { Database } from '@/lib/supabase/database.types';
import type { FundingPrecheckResult } from '@/lib/ai/types';
import type { ContractCheckResult } from '@/lib/ai/contract-check/types';
import type { OfferCheckResult } from '@/lib/ai/offer-check/types';
import type { ReadinessSummary } from '@/lib/documents/checklist';

type AICheckRow = Database['public']['Tables']['ai_checks']['Row'];

// ─── Badge helpers ────────────────────────────────────────────────────────────

const ASSESSMENT_CONFIG = {
  likely_eligible: { label: 'Wahrscheinlich förderfähig', cls: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' },
  unclear:         { label: 'Unklar',                      cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300' },
  critical:        { label: 'Kritisch',                    cls: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' },
} as const;

const CONTRACT_ASSESSMENT_CONFIG = {
  pass:           { label: 'Fördervorbehalt plausibel', cls: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' },
  needs_revision: { label: 'Nachbesserung nötig',       cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300' },
  critical:       { label: 'Kritisch',                  cls: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' },
} as const;

const OFFER_ASSESSMENT_CONFIG = {
  pass:           { label: 'Angebot plausibel',   cls: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' },
  needs_revision: { label: 'Nachbesserung nötig', cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300' },
  critical:       { label: 'Kritisch',            cls: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' },
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

// ─── Entscheidung summary box ─────────────────────────────────────────────────

const BZA_RE = /\bbza\b|bestätigung zum antrag/i;

function EntscheidungBox({
  result,
  assessmentCfg,
  riskCfg,
  readiness,
}: {
  result: FundingPrecheckResult;
  assessmentCfg: { label: string; cls: string } | null;
  riskCfg: { label: string; cls: string } | null;
  readiness: ReadinessSummary;
}) {
  // Detect BzA step from AI output (recommended_next_steps or, for older rows, blocking_items)
  const hasBzaStep =
    (result.recommended_next_steps ?? []).some((s) => BZA_RE.test(s)) ||
    (result.blocking_items ?? []).some((b) => BZA_RE.test(b));

  // Build compound Hauptgrund parts from readiness data + BzA detection
  const parts: string[] = [];
  if (readiness.blocking_count > 0) {
    parts.push(
      readiness.blocking_count === 1
        ? '1 Kundenunterlage fehlt'
        : `${readiness.blocking_count} Kundenunterlagen fehlen`,
    );
  }
  if (readiness.needs_review_count > 0) {
    parts.push(
      readiness.needs_review_count === 1
        ? '1 hochgeladene Unterlage ist ungeprüft'
        : `${readiness.needs_review_count} hochgeladene Unterlagen sind ungeprüft`,
    );
  }
  if (hasBzaStep) {
    parts.push(
      'BzA (Bestätigung zum Antrag) muss noch durch qualifiziertes Fachunternehmen/berechtigte Stelle erstellt werden',
    );
  }

  // Join with Oxford-style "A, B und C."
  let hauptgrund: string | null = null;
  if (parts.length > 1) {
    const last = parts[parts.length - 1];
    const rest = parts.slice(0, -1);
    hauptgrund = rest.join(', ') + ' und ' + last + '.';
  } else if (parts.length === 1) {
    hauptgrund = parts[0];
  } else {
    // Fallback to AI-supplied blocking_items or first detected risk
    const aiBlocks = (result.blocking_items ?? []).filter((b) => !BZA_RE.test(b));
    hauptgrund =
      aiBlocks[0] ??
      result.detected_risks?.[0]?.risk_de ??
      result.missing_information?.[0] ??
      null;
  }

  // Nächster Schritt — compound when multiple issues, otherwise first AI step
  let naechsterSchritt: string | null = null;
  if (parts.length > 1) {
    const actions: string[] = [];
    if (readiness.blocking_count > 0) actions.push('fehlende Kundenunterlagen beschaffen');
    if (readiness.needs_review_count > 0) actions.push('hochgeladene Unterlagen prüfen lassen');
    if (hasBzaStep) actions.push('BzA durch qualifiziertes Fachunternehmen/berechtigte Stelle erstellen lassen');
    const last = actions[actions.length - 1];
    const rest = actions.slice(0, -1);
    const joined = rest.length > 0 ? rest.join(', ') + ' und ' + last : last;
    const capitalized = joined.charAt(0).toUpperCase() + joined.slice(1);
    naechsterSchritt = capitalized + ', bevor der Antrag im KfW-Portal „Meine KfW" gestellt wird.';
  } else {
    naechsterSchritt = result.recommended_next_steps?.[0] ?? null;
  }

  return (
    <div className="rounded-md bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 p-3 space-y-2.5">
      {/* Row 1: Ergebnis + Risiko */}
      <div className="grid grid-cols-2 gap-x-4">
        <div>
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">
            Ergebnis
          </p>
          {assessmentCfg
            ? <Badge label={assessmentCfg.label} cls={assessmentCfg.cls} />
            : <span className="text-xs text-gray-400">–</span>}
        </div>
        <div>
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">
            Risiko
          </p>
          {riskCfg
            ? <Badge label={riskCfg.label} cls={riskCfg.cls} />
            : <span className="text-xs text-gray-400">–</span>}
        </div>
      </div>

      {/* Row 2: Hauptgrund */}
      {hauptgrund && (
        <div>
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">
            Hauptgrund
          </p>
          <p className="text-xs text-gray-800 dark:text-gray-200 leading-snug">{hauptgrund}</p>
        </div>
      )}

      {/* Row 3: Nächster Schritt */}
      {naechsterSchritt && (
        <div>
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">
            Nächster Schritt
          </p>
          <div className="flex items-start gap-1">
            <ArrowRight className="mt-0.5 h-3 w-3 flex-shrink-0 text-gray-400 dark:text-gray-500" />
            <p className="text-xs text-gray-800 dark:text-gray-200 leading-snug">{naechsterSchritt}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Runtime shape guard ──────────────────────────────────────────────────────
// Old rows pre-dating the tool-use implementation may have result_json with
// null arrays or missing fields. Validate before trusting the cast.

function isValidResult(x: unknown): x is FundingPrecheckResult {
  if (typeof x !== 'object' || x === null) return false;
  const r = x as Record<string, unknown>;
  return (
    Array.isArray(r.missing_information) &&
    Array.isArray(r.blocking_items) &&
    Array.isArray(r.possible_bonuses) &&
    Array.isArray(r.detected_risks) &&
    Array.isArray(r.recommended_next_steps) &&
    Array.isArray(r.internal_notes_de)
  );
}

// ─── Single check card ────────────────────────────────────────────────────────

function AICheckCard({
  check,
  caseId,
  defaultOpen,
  readiness,
}: {
  check: AICheckRow;
  caseId: string;
  defaultOpen: boolean;
  readiness: ReadinessSummary;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  const result =
    check.status === 'completed' && isValidResult(check.result_json)
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
              {/* Entscheidung summary box */}
              <EntscheidungBox
                result={result}
                assessmentCfg={assessmentCfg}
                riskCfg={riskCfg}
                readiness={readiness}
              />

              {/* Narrative summary */}
              {result.summary_de && (
                <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                  {result.summary_de}
                </p>
              )}

              {/* Details toggle */}
              <button
                onClick={() => setDetailsOpen((v) => !v)}
                className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                {detailsOpen
                  ? <ChevronUp className="h-3.5 w-3.5" />
                  : <ChevronDown className="h-3.5 w-3.5" />}
                {detailsOpen ? 'Details ausblenden' : 'Details anzeigen'}
              </button>

              {/* Collapsible detail sections */}
              {detailsOpen && (
                <div className="space-y-3 pt-1">
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

// ─── Contract check helpers ───────────────────────────────────────────────────

function isValidContractResult(x: unknown): x is ContractCheckResult {
  if (typeof x !== 'object' || x === null) return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.overall_assessment === 'string' &&
    typeof r.funding_reservation === 'object' &&
    r.funding_reservation !== null &&
    typeof r.premature_start_risk === 'object' &&
    r.premature_start_risk !== null &&
    Array.isArray(r.recommended_next_steps)
  );
}

const FUNDING_RESERVATION_TYPE_LABEL: Record<string, string> = {
  aufschiebend: 'Aufschiebend',
  aufloesend:   'Auflösend',
  both:         'Aufschiebend & auflösend',
  unclear:      'Vorhanden (unklar)',
  missing:      'Fehlt',
};

const PREMATURE_SEVERITY_CONFIG: Record<string, { label: string; cls: string }> = {
  none:   { label: 'Kein Risiko',    cls: 'text-green-700 dark:text-green-400' },
  low:    { label: 'Niedrig',        cls: 'text-yellow-700 dark:text-yellow-500' },
  medium: { label: 'Mittel',         cls: 'text-orange-600 dark:text-orange-400' },
  high:   { label: 'Hoch',           cls: 'text-red-700 dark:text-red-400' },
};

function ContractCheckCard({
  check,
  caseId,
  defaultOpen,
}: {
  check: AICheckRow;
  caseId: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen]           = useState(defaultOpen);
  const [detailsOpen, setDetails] = useState(false);
  const [emailOpen, setEmail]     = useState(false);

  const result = check.status === 'completed' && isValidContractResult(check.result_json)
    ? (check.result_json as unknown as ContractCheckResult)
    : null;

  const reviewCfg = REVIEW_CONFIG[check.human_review_status as keyof typeof REVIEW_CONFIG]
    ?? REVIEW_CONFIG.pending;

  const assessmentCfg = result
    ? CONTRACT_ASSESSMENT_CONFIG[result.overall_assessment as keyof typeof CONTRACT_ASSESSMENT_CONFIG]
    : null;

  const riskCfg = check.risk_level
    ? RISK_CONFIG[check.risk_level as keyof typeof RISK_CONFIG] ?? null
    : null;

  const isExtractionFailure =
    check.status === 'failed' &&
    typeof check.result_json === 'object' &&
    check.result_json !== null &&
    (check.result_json as Record<string, unknown>).extraction_failed === true;

  return (
    <div className="border border-gray-300 dark:border-gray-700 rounded-md overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start justify-between gap-2 px-3 py-2.5 text-left bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Vertragsprüfung</span>
            {assessmentCfg && <Badge label={assessmentCfg.label} cls={assessmentCfg.cls} />}
            {riskCfg        && <Badge label={riskCfg.label}       cls={riskCfg.cls}       />}
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
          {/* Extraction failure */}
          {isExtractionFailure && (
            <div className="rounded-md bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 px-3 py-2">
              <p className="text-xs font-medium text-yellow-700 dark:text-yellow-300">
                PDF-Text nicht lesbar
              </p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-0.5">
                Aus dem PDF konnte kein Text gelesen werden. Für gescannte PDFs wird später OCR benötigt.
              </p>
            </div>
          )}

          {/* Generic failure */}
          {check.status === 'failed' && !isExtractionFailure && (
            <div className="rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-3 py-2">
              <p className="text-xs font-medium text-red-700 dark:text-red-300">Vertragsprüfung fehlgeschlagen</p>
            </div>
          )}

          {result && (
            <>
              {/* Summary box */}
              <div className="rounded-md bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 p-3 space-y-2">
                <div className="grid grid-cols-2 gap-x-4">
                  <div>
                    <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Ergebnis</p>
                    {assessmentCfg
                      ? <Badge label={assessmentCfg.label} cls={assessmentCfg.cls} />
                      : <span className="text-xs text-gray-400">–</span>}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Risiko</p>
                    {riskCfg
                      ? <Badge label={riskCfg.label} cls={riskCfg.cls} />
                      : <span className="text-xs text-gray-400">–</span>}
                  </div>
                </div>

                {/* Fördervorbehalt quick summary */}
                <div>
                  <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Fördervorbehalt</p>
                  <div className="flex items-center gap-2 text-xs">
                    {result.funding_reservation.present
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400 flex-shrink-0" />
                      : <AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400 flex-shrink-0" />}
                    <span className={result.funding_reservation.present ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>
                      {result.funding_reservation.present ? 'Vorhanden' : 'Fehlt'}
                    </span>
                    {result.funding_reservation.type !== 'missing' && (
                      <span className="text-gray-500 dark:text-gray-400">
                        · {FUNDING_RESERVATION_TYPE_LABEL[result.funding_reservation.type] ?? result.funding_reservation.type}
                      </span>
                    )}
                    {result.funding_reservation.mentions_kfw_funding_approval && (
                      <span className="text-gray-500 dark:text-gray-400">· KfW-Bezug erkannt</span>
                    )}
                  </div>
                </div>

                {/* Premature start quick summary */}
                {result.premature_start_risk.detected && (
                  <div>
                    <p className="text-xs font-medium text-red-500 dark:text-red-400 uppercase tracking-wide mb-0.5">Vorzeitiger Beginn</p>
                    <div className="flex items-start gap-1.5 text-xs text-red-700 dark:text-red-400">
                      <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                      <span>Problematische Klausel erkannt –{' '}
                        {PREMATURE_SEVERITY_CONFIG[result.premature_start_risk.severity]?.label ?? result.premature_start_risk.severity}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Narrative summary */}
              {result.summary_de && (
                <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{result.summary_de}</p>
              )}

              {/* Inline helpers for document status */}
              {result.overall_assessment === 'pass' && (
                <p className="text-xs text-green-700 dark:text-green-400 italic">
                  Bei positivem Review kann der Vertrag manuell auf Geprüft gesetzt werden.
                </p>
              )}
              {result.overall_assessment === 'critical' && (
                <p className="text-xs text-red-700 dark:text-red-400 italic">
                  Vertrag sollte nicht als geprüft markiert werden, bevor er korrigiert wurde.
                </p>
              )}

              {/* Details toggle */}
              <button
                onClick={() => setDetails((v) => !v)}
                className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                {detailsOpen
                  ? <ChevronUp className="h-3.5 w-3.5" />
                  : <ChevronDown className="h-3.5 w-3.5" />}
                {detailsOpen ? 'Details ausblenden' : 'Details anzeigen'}
              </button>

              {detailsOpen && (
                <div className="space-y-3 pt-1">
                  {/* Fördervorbehalt detail */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                      Fördervorbehalt – Details
                    </p>
                    <p className="text-xs text-gray-700 dark:text-gray-300">{result.funding_reservation.assessment_de}</p>
                    {result.funding_reservation.relevant_excerpt_de && (
                      <blockquote className="mt-1.5 border-l-2 border-gray-300 dark:border-gray-600 pl-2.5 text-xs text-gray-600 dark:text-gray-400 italic">
                        {result.funding_reservation.relevant_excerpt_de}
                      </blockquote>
                    )}
                  </div>

                  {/* Vorzeitiger Beginn detail */}
                  <div>
                    <p className={`text-xs font-medium uppercase tracking-wide mb-1 ${result.premature_start_risk.detected ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                      Vorzeitiger Beginn
                    </p>
                    <p className="text-xs text-gray-700 dark:text-gray-300">{result.premature_start_risk.assessment_de}</p>
                    {result.premature_start_risk.problematic_excerpt_de && (
                      <blockquote className="mt-1.5 border-l-2 border-red-300 dark:border-red-700 pl-2.5 text-xs text-red-700 dark:text-red-400 italic">
                        {result.premature_start_risk.problematic_excerpt_de}
                      </blockquote>
                    )}
                  </div>

                  {/* Ausführungszeitraum */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                      Ausführungszeitraum
                    </p>
                    <div className="flex items-center gap-1.5 text-xs mb-0.5">
                      {result.implementation_period.present
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                        : <Info className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />}
                      <span className="text-gray-700 dark:text-gray-300">
                        {result.implementation_period.present ? 'Vorhanden' : 'Nicht erkennbar'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{result.implementation_period.assessment_de}</p>
                    {result.implementation_period.excerpt_de && (
                      <blockquote className="mt-1 border-l-2 border-gray-300 dark:border-gray-600 pl-2.5 text-xs text-gray-600 dark:text-gray-400 italic">
                        {result.implementation_period.excerpt_de}
                      </blockquote>
                    )}
                  </div>

                  {/* Contract parties */}
                  {(result.contract_parties.customer_name || result.contract_parties.contractor_name || result.contract_parties.project_address) && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Vertragsparteien</p>
                      <dl className="space-y-0.5 text-xs">
                        {result.contract_parties.customer_name && (
                          <div className="flex gap-1">
                            <dt className="text-gray-400 dark:text-gray-500 w-24 flex-shrink-0">Auftraggeber:</dt>
                            <dd className="text-gray-700 dark:text-gray-300">{result.contract_parties.customer_name}</dd>
                          </div>
                        )}
                        {result.contract_parties.contractor_name && (
                          <div className="flex gap-1">
                            <dt className="text-gray-400 dark:text-gray-500 w-24 flex-shrink-0">Auftragnehmer:</dt>
                            <dd className="text-gray-700 dark:text-gray-300">{result.contract_parties.contractor_name}</dd>
                          </div>
                        )}
                        {result.contract_parties.project_address && (
                          <div className="flex gap-1">
                            <dt className="text-gray-400 dark:text-gray-500 w-24 flex-shrink-0">Projektadresse:</dt>
                            <dd className="text-gray-700 dark:text-gray-300">{result.contract_parties.project_address}</dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  )}

                  {/* Critical findings */}
                  {result.critical_findings.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wide mb-1">Kritische Befunde</p>
                      <ul className="space-y-0.5">
                        {result.critical_findings.map((f, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-red-700 dark:text-red-400">
                            <AlertTriangle className="mt-0.5 flex-shrink-0 h-3 w-3" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Missing/unclear */}
                  {result.missing_or_unclear_items.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Fehlend / unklar</p>
                      <ul className="space-y-0.5">
                        {result.missing_or_unclear_items.map((item, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700 dark:text-gray-300">
                            <span className="mt-1 flex-shrink-0 h-1.5 w-1.5 rounded-full bg-yellow-400" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Recommended changes */}
                  {result.recommended_changes.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Empfohlene Änderungen</p>
                      <ul className="space-y-0.5">
                        {result.recommended_changes.map((c, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700 dark:text-gray-300">
                            <ArrowRight className="mt-0.5 flex-shrink-0 h-3 w-3 text-gray-400 dark:text-gray-500" />
                            {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Safe clause suggestion */}
                  {result.safe_clause_suggestion_de && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Musterformulierung</p>
                      <div className="rounded-md bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-2.5">
                        <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">{result.safe_clause_suggestion_de}</p>
                      </div>
                    </div>
                  )}

                  {/* Next steps */}
                  {result.recommended_next_steps.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Nächste Schritte</p>
                      <ol className="space-y-0.5 list-decimal list-inside">
                        {result.recommended_next_steps.map((step, i) => (
                          <li key={i} className="text-xs text-gray-700 dark:text-gray-300">{step}</li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Customer message draft */}
                  {result.customer_message_draft_de && (
                    <div>
                      <button
                        onClick={() => setEmail((v) => !v)}
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
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Interne Hinweise</p>
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
                </div>
              )}
            </>
          )}

          {/* Disclaimer */}
          <p className="text-xs text-gray-400 dark:text-gray-500 italic border-t border-gray-100 dark:border-gray-800 pt-2">
            {check.disclaimer || 'KI-Vertragsprüfung erfordert manuelle Prüfung. Keine Fördergarantie.'}
          </p>

          {/* Review buttons */}
          {check.human_review_status === 'pending' && check.status === 'completed' && result && (
            <ReviewButtons checkId={check.id} caseId={caseId} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Offer check helpers ──────────────────────────────────────────────────────

function isValidOfferResult(x: unknown): x is OfferCheckResult {
  if (typeof x !== 'object' || x === null) return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.overall_assessment === 'string' &&
    typeof r.heat_pump === 'object' &&
    r.heat_pump !== null &&
    typeof r.costs === 'object' &&
    r.costs !== null &&
    typeof r.eligible_scope_indicators === 'object' &&
    r.eligible_scope_indicators !== null &&
    Array.isArray(r.recommended_next_steps)
  );
}

function BoolIndicator({ value, trueLabel, falseLabel }: { value: boolean; trueLabel: string; falseLabel: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {value
        ? <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-green-600 dark:text-green-400" />
        : <Info className="h-3.5 w-3.5 flex-shrink-0 text-yellow-600 dark:text-yellow-400" />}
      <span className={value ? 'text-green-700 dark:text-green-400' : 'text-yellow-700 dark:text-yellow-500'}>
        {value ? trueLabel : falseLabel}
      </span>
    </div>
  );
}

function OfferCheckCard({
  check,
  caseId,
  defaultOpen,
}: {
  check: AICheckRow;
  caseId: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen]           = useState(defaultOpen);
  const [detailsOpen, setDetails] = useState(false);
  const [emailOpen, setEmail]     = useState(false);

  const result = check.status === 'completed' && isValidOfferResult(check.result_json)
    ? (check.result_json as unknown as OfferCheckResult)
    : null;

  const reviewCfg = REVIEW_CONFIG[check.human_review_status as keyof typeof REVIEW_CONFIG]
    ?? REVIEW_CONFIG.pending;

  const assessmentCfg = result
    ? OFFER_ASSESSMENT_CONFIG[result.overall_assessment as keyof typeof OFFER_ASSESSMENT_CONFIG]
    : null;

  const riskCfg = check.risk_level
    ? RISK_CONFIG[check.risk_level as keyof typeof RISK_CONFIG] ?? null
    : null;

  const isExtractionFailure =
    check.status === 'failed' &&
    typeof check.result_json === 'object' &&
    check.result_json !== null &&
    (check.result_json as Record<string, unknown>).extraction_failed === true;

  return (
    <div className="border border-gray-300 dark:border-gray-700 rounded-md overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start justify-between gap-2 px-3 py-2.5 text-left bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Angebotsprüfung</span>
            {assessmentCfg && <Badge label={assessmentCfg.label} cls={assessmentCfg.cls} />}
            {riskCfg        && <Badge label={riskCfg.label}       cls={riskCfg.cls}       />}
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
          {/* Extraction failure */}
          {isExtractionFailure && (
            <div className="rounded-md bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 px-3 py-2">
              <p className="text-xs font-medium text-yellow-700 dark:text-yellow-300">
                PDF-Text nicht lesbar
              </p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-0.5">
                Aus dem PDF konnte kein Text gelesen werden. Für gescannte PDFs wird später OCR benötigt.
              </p>
            </div>
          )}

          {/* Generic failure */}
          {check.status === 'failed' && !isExtractionFailure && (
            <div className="rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-3 py-2">
              <p className="text-xs font-medium text-red-700 dark:text-red-300">Angebotsprüfung fehlgeschlagen</p>
            </div>
          )}

          {result && (
            <>
              {/* Summary box */}
              <div className="rounded-md bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 p-3 space-y-2">
                <div className="grid grid-cols-2 gap-x-4">
                  <div>
                    <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Ergebnis</p>
                    {assessmentCfg
                      ? <Badge label={assessmentCfg.label} cls={assessmentCfg.cls} />
                      : <span className="text-xs text-gray-400">–</span>}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Risiko</p>
                    {riskCfg
                      ? <Badge label={riskCfg.label} cls={riskCfg.cls} />
                      : <span className="text-xs text-gray-400">–</span>}
                  </div>
                </div>

                {/* Wärmepumpe quick summary */}
                <div>
                  <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Wärmepumpe</p>
                  <div className="flex items-center gap-2 text-xs">
                    {(() => {
                      const hp = result.heat_pump;
                      const hasDetails = hp.manufacturer || hp.model;
                      if (!hp.present) {
                        return (
                          <>
                            <AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400 flex-shrink-0" />
                            <span className="text-red-700 dark:text-red-400">Nicht erkennbar</span>
                          </>
                        );
                      }
                      if (!hasDetails) {
                        return (
                          <>
                            <Info className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-500 flex-shrink-0" />
                            <span className="text-yellow-700 dark:text-yellow-500">Erkennbar, aber unvollständig</span>
                          </>
                        );
                      }
                      return (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400 flex-shrink-0" />
                          <span className="text-green-700 dark:text-green-400">Erkennbar</span>
                          {hp.manufacturer && <span className="text-gray-500 dark:text-gray-400">· {hp.manufacturer}</span>}
                          {hp.model && <span className="text-gray-500 dark:text-gray-400">{hp.model}</span>}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Narrative summary */}
              {result.summary_de && (
                <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{result.summary_de}</p>
              )}

              {/* Details toggle */}
              <button
                onClick={() => setDetails((v) => !v)}
                className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                {detailsOpen
                  ? <ChevronUp className="h-3.5 w-3.5" />
                  : <ChevronDown className="h-3.5 w-3.5" />}
                {detailsOpen ? 'Details ausblenden' : 'Details anzeigen'}
              </button>

              {detailsOpen && (
                <div className="space-y-3 pt-1">
                  {/* Wärmepumpe details */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                      Wärmepumpe – Details
                    </p>
                    <dl className="space-y-0.5 text-xs mb-1.5">
                      {result.heat_pump.type && (
                        <div className="flex gap-1">
                          <dt className="text-gray-400 dark:text-gray-500 w-20 flex-shrink-0">Art:</dt>
                          <dd className="text-gray-700 dark:text-gray-300">{result.heat_pump.type}</dd>
                        </div>
                      )}
                      {result.heat_pump.manufacturer && (
                        <div className="flex gap-1">
                          <dt className="text-gray-400 dark:text-gray-500 w-20 flex-shrink-0">Hersteller:</dt>
                          <dd className="text-gray-700 dark:text-gray-300">{result.heat_pump.manufacturer}</dd>
                        </div>
                      )}
                      {result.heat_pump.model && (
                        <div className="flex gap-1">
                          <dt className="text-gray-400 dark:text-gray-500 w-20 flex-shrink-0">Modell:</dt>
                          <dd className="text-gray-700 dark:text-gray-300">{result.heat_pump.model}</dd>
                        </div>
                      )}
                    </dl>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{result.heat_pump.assessment_de}</p>
                  </div>

                  {/* Kosten */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                      Kosten
                    </p>
                    <dl className="space-y-0.5 text-xs mb-1.5">
                      {result.costs.net_amount && (
                        <div className="flex gap-1">
                          <dt className="text-gray-400 dark:text-gray-500 w-20 flex-shrink-0">Netto:</dt>
                          <dd className="text-gray-700 dark:text-gray-300">{result.costs.net_amount}</dd>
                        </div>
                      )}
                      {result.costs.gross_amount && (
                        <div className="flex gap-1">
                          <dt className="text-gray-400 dark:text-gray-500 w-20 flex-shrink-0">Brutto:</dt>
                          <dd className="text-gray-700 dark:text-gray-300">{result.costs.gross_amount}</dd>
                        </div>
                      )}
                      {result.costs.vat_rate && (
                        <div className="flex gap-1">
                          <dt className="text-gray-400 dark:text-gray-500 w-20 flex-shrink-0">MwSt.:</dt>
                          <dd className="text-gray-700 dark:text-gray-300">{result.costs.vat_rate}</dd>
                        </div>
                      )}
                    </dl>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{result.costs.assessment_de}</p>
                  </div>

                  {/* Förderrelevante Leistungsbestandteile */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                      Förderrelevante Leistungen
                    </p>
                    <div className="space-y-1 mb-1.5">
                      <BoolIndicator
                        value={result.eligible_scope_indicators.demolition_old_heating_present}
                        trueLabel="Demontage Altanlage erkennbar"
                        falseLabel="Demontage Altanlage fehlt/unklar"
                      />
                      <BoolIndicator
                        value={result.eligible_scope_indicators.hydraulic_balancing_present}
                        trueLabel="Hydraulischer Abgleich erkennbar"
                        falseLabel="Hydraulischer Abgleich fehlt/unklar"
                      />
                      <BoolIndicator
                        value={result.eligible_scope_indicators.commissioning_present}
                        trueLabel="Inbetriebnahme erkennbar"
                        falseLabel="Inbetriebnahme fehlt/unklar"
                      />
                      <BoolIndicator
                        value={result.eligible_scope_indicators.electrical_work_present}
                        trueLabel="Elektroarbeiten erkennbar"
                        falseLabel="Elektroarbeiten nicht erkennbar"
                      />
                      <BoolIndicator
                        value={result.eligible_scope_indicators.buffer_or_storage_present}
                        trueLabel="Speicher/Puffer erkennbar"
                        falseLabel="Speicher/Puffer nicht erkennbar"
                      />
                      <BoolIndicator
                        value={result.eligible_scope_indicators.environmental_measures_present}
                        trueLabel="Nebenarbeiten erkennbar"
                        falseLabel="Nebenarbeiten nicht erkennbar"
                      />
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{result.eligible_scope_indicators.assessment_de}</p>
                  </div>

                  {/* Ausführungszeitraum */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                      Ausführungszeitraum
                    </p>
                    <div className="flex items-center gap-1.5 text-xs mb-0.5">
                      {result.implementation_period.present
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                        : <Info className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />}
                      <span className="text-gray-700 dark:text-gray-300">
                        {result.implementation_period.present ? 'Vorhanden' : 'Nicht erkennbar'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{result.implementation_period.assessment_de}</p>
                    {result.implementation_period.excerpt_de && (
                      <blockquote className="mt-1 border-l-2 border-gray-300 dark:border-gray-600 pl-2.5 text-xs text-gray-600 dark:text-gray-400 italic">
                        {result.implementation_period.excerpt_de}
                      </blockquote>
                    )}
                  </div>

                  {/* Project parties */}
                  {(result.project_parties.customer_name || result.project_parties.contractor_name || result.project_parties.project_address) && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Projektparteien</p>
                      <dl className="space-y-0.5 text-xs">
                        {result.project_parties.customer_name && (
                          <div className="flex gap-1">
                            <dt className="text-gray-400 dark:text-gray-500 w-24 flex-shrink-0">Auftraggeber:</dt>
                            <dd className="text-gray-700 dark:text-gray-300">{result.project_parties.customer_name}</dd>
                          </div>
                        )}
                        {result.project_parties.contractor_name && (
                          <div className="flex gap-1">
                            <dt className="text-gray-400 dark:text-gray-500 w-24 flex-shrink-0">Auftragnehmer:</dt>
                            <dd className="text-gray-700 dark:text-gray-300">{result.project_parties.contractor_name}</dd>
                          </div>
                        )}
                        {result.project_parties.project_address && (
                          <div className="flex gap-1">
                            <dt className="text-gray-400 dark:text-gray-500 w-24 flex-shrink-0">Projektadresse:</dt>
                            <dd className="text-gray-700 dark:text-gray-300">{result.project_parties.project_address}</dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  )}

                  {/* Critical findings */}
                  {result.critical_findings.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wide mb-1">Kritische Befunde</p>
                      <ul className="space-y-0.5">
                        {result.critical_findings.map((f, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-red-700 dark:text-red-400">
                            <AlertTriangle className="mt-0.5 flex-shrink-0 h-3 w-3" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Missing/unclear */}
                  {result.missing_or_unclear_items.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Fehlend / unklar</p>
                      <ul className="space-y-0.5">
                        {result.missing_or_unclear_items.map((item, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700 dark:text-gray-300">
                            <span className="mt-1 flex-shrink-0 h-1.5 w-1.5 rounded-full bg-yellow-400" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Recommended changes */}
                  {result.recommended_changes.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Empfohlene Änderungen</p>
                      <ul className="space-y-0.5">
                        {result.recommended_changes.map((c, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700 dark:text-gray-300">
                            <ArrowRight className="mt-0.5 flex-shrink-0 h-3 w-3 text-gray-400 dark:text-gray-500" />
                            {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Next steps */}
                  {result.recommended_next_steps.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Nächste Schritte</p>
                      <ol className="space-y-0.5 list-decimal list-inside">
                        {result.recommended_next_steps.map((step, i) => (
                          <li key={i} className="text-xs text-gray-700 dark:text-gray-300">{step}</li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Customer message draft */}
                  {result.customer_message_draft_de && (
                    <div>
                      <button
                        onClick={() => setEmail((v) => !v)}
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
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Interne Hinweise</p>
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
                </div>
              )}
            </>
          )}

          {/* Disclaimer */}
          <p className="text-xs text-gray-400 dark:text-gray-500 italic border-t border-gray-100 dark:border-gray-800 pt-2">
            {check.disclaimer || 'KI-Angebotsprüfung erfordert manuelle Prüfung. Keine Fördergarantie.'}
          </p>

          {/* Review buttons */}
          {check.human_review_status === 'pending' && check.status === 'completed' && result && (
            <ReviewButtons checkId={check.id} caseId={caseId} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Router: dispatch to right card type ──────────────────────────────────────

function CheckCardRouter({
  check,
  caseId,
  defaultOpen,
  readiness,
}: {
  check: AICheckRow;
  caseId: string;
  defaultOpen: boolean;
  readiness: ReadinessSummary;
}) {
  if (check.check_type === 'contract_check') {
    return (
      <ContractCheckCard check={check} caseId={caseId} defaultOpen={defaultOpen} />
    );
  }
  if (check.check_type === 'offer_check') {
    return (
      <OfferCheckCard check={check} caseId={caseId} defaultOpen={defaultOpen} />
    );
  }
  return (
    <AICheckCard check={check} caseId={caseId} defaultOpen={defaultOpen} readiness={readiness} />
  );
}

// ─── Main section ─────────────────────────────────────────────────────────────

export default function AIChecksSection({
  caseId,
  initialChecks,
  readiness,
}: {
  caseId: string;
  initialChecks: AICheckRow[];
  readiness: ReadinessSummary;
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
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">KI-Prüfungen</h2>
        {checks.length > 0 && (
          <span className="text-xs text-gray-400 dark:text-gray-500">{checks.length}</span>
        )}
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 rounded-md px-2.5 py-1.5 mt-2">
        KI-Ergebnis ist eine Vorprüfung. Keine Fördergarantie. Manuelle Prüfung erforderlich.
      </p>

      {/* Run KI-Fördercheck button */}
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
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">Noch keine KI-Prüfung durchgeführt.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {checks.map((check, idx) => (
            <CheckCardRouter
              key={check.id}
              check={check}
              caseId={caseId}
              defaultOpen={idx === 0}
              readiness={readiness}
            />
          ))}
        </div>
      )}
    </div>
  );
}
