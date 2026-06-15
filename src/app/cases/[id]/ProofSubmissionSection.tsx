'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2, Clock, Copy, Check, RotateCcw,
  ChevronDown, ChevronUp, AlertTriangle, ClipboardList,
} from 'lucide-react';
import {
  markKfwApprovalReceivedAction,
  markImplementationStartedAction,
  markImplementationCompletedAction,
  updateBndIdAction,
  markProofPreparedAction,
  markProofSubmittedAction,
  markPayoutPaidAction,
  resetProofSubmissionAction,
  createProofTasksAction,
} from './proof-submission-actions';
import type { ProofActionState, ProofTasksState } from './proof-submission-actions';
import { computeKfwProofSubmissionState } from '@/lib/kfw/proof-submission';
import { generateProofCustomerInstructions } from '@/lib/kfw/proof-customer-instructions';
import type { ProofInstructionFormat } from '@/lib/kfw/proof-customer-instructions';
import type { Database } from '@/lib/supabase/database.types';

type FundingCaseRow = Database['public']['Tables']['funding_cases']['Row'];
type CustomerRow    = Database['public']['Tables']['customers']['Row'];

// ─── Shared helpers ───────────────────────────────────────────────────────────

function SubmitBtn({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
    >
      {pending ? '…' : children}
    </button>
  );
}

function PrimaryBtn({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-3 py-1.5 text-xs font-medium hover:bg-gray-700 dark:hover:bg-gray-100 disabled:opacity-50 transition-colors"
    >
      {pending ? '…' : children}
    </button>
  );
}

function ErrorMsg({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-red-600 dark:text-red-400">{msg}</p>;
}

function SubSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors mb-2"
      >
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {title}
      </button>
      {open && children}
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
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
        : <><Copy className="h-3.5 w-3.5" />{label}</>
      }
    </button>
  );
}

// ─── Step tracker ─────────────────────────────────────────────────────────────

const PROOF_STEPS: Array<{ label: string }> = [
  { label: 'Förderzusage' },
  { label: 'Umsetzung starten' },
  { label: 'Umsetzung abschl.' },
  { label: 'BnD-ID' },
  { label: 'Vorbereitung' },
  { label: 'Eingereicht' },
];

function stepIndex(step: string): number {
  const order = [
    'waiting_for_approval',
    'approval_received',
    'implementation_started',
    'implementation_completed',
    'bnd_entered',
    'proof_prepared',
    'proof_submitted',
    'payout_received',
  ];
  const idx = order.indexOf(step);
  // Map 8 internal states to 6 visible steps
  if (idx <= 0) return 0;
  if (idx === 1) return 1;
  if (idx === 2) return 2;
  if (idx === 3) return 3;
  if (idx === 4) return 4;
  if (idx >= 5) return 5;
  return 0;
}

function StepTracker({ activeStep }: { activeStep: string }) {
  const active = stepIndex(activeStep);
  return (
    <ol className="flex items-center gap-0 overflow-x-auto">
      {PROOF_STEPS.map((step, idx) => {
        const done   = active > idx || activeStep === 'payout_received';
        const current = active === idx && activeStep !== 'payout_received';
        const last   = idx === PROOF_STEPS.length - 1;
        return (
          <li key={idx} className="flex items-center flex-shrink-0">
            <div className="flex flex-col items-center gap-0.5 px-1">
              <div className={[
                'flex items-center justify-center h-5 w-5 rounded-full text-xs font-semibold transition-colors',
                done    ? 'bg-green-500 text-white'
                : current ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600',
              ].join(' ')}>
                {done ? <Check className="h-3 w-3" /> : <span>{idx + 1}</span>}
              </div>
              <span className={[
                'text-xs whitespace-nowrap',
                current ? 'font-medium text-gray-900 dark:text-gray-100'
                : done   ? 'text-gray-500 dark:text-gray-400'
                : 'text-gray-300 dark:text-gray-600',
              ].join(' ')}>
                {step.label}
              </span>
            </div>
            {!last && (
              <div className={['h-px w-2 sm:w-3 flex-shrink-0 mt-[-14px]', done ? 'bg-green-400' : 'bg-gray-100 dark:bg-gray-800'].join(' ')} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ─── BnD-ID input ─────────────────────────────────────────────────────────────

function normalizeBndId(raw: string): string {
  return raw.replace(/[\s\-._]/g, '');
}

function BndIdInput({
  value,
  onChange,
  dateValue,
  onDateChange,
}: {
  value: string;
  onChange: (v: string) => void;
  dateValue: string;
  onDateChange: (v: string) => void;
}) {
  const normalized = normalizeBndId(value);
  const hasInput   = normalized.length > 0;
  const isValid    = /^\d{15}$/.test(normalized);
  const showWarn   = hasInput && !isValid;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">BnD-ID</label>
          <input
            name="bnd_id"
            type="text"
            inputMode="numeric"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="15-stellige BnD-ID"
            className={`text-xs rounded border px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 w-52 ${
              showWarn
                ? 'border-yellow-400 dark:border-yellow-600 focus:ring-yellow-400'
                : 'border-gray-200 dark:border-gray-700 focus:ring-gray-400'
            }`}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Datum</label>
          <input
            name="bnd_created_at"
            type="date"
            value={dateValue}
            onChange={(e) => onDateChange(e.target.value)}
            className="text-xs rounded border border-gray-200 dark:border-gray-700 px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400"
          />
        </div>
      </div>
      {showWarn && (
        <p className="flex items-center gap-1 text-xs text-yellow-700 dark:text-yellow-400">
          <AlertTriangle className="h-3 w-3 flex-shrink-0" />
          Die BnD-ID sollte 15 Ziffern enthalten. ({normalized.length} Ziffern erkannt – Format nicht abschließend geprüft.)
        </p>
      )}
    </div>
  );
}

// ─── Proof customer instructions ──────────────────────────────────────────────

function ProofInstructionPanel({
  fundingCase,
  customer,
}: {
  fundingCase: FundingCaseRow;
  customer: CustomerRow | null;
}) {
  const [format, setFormat] = useState<ProofInstructionFormat>('whatsapp');
  const text = generateProofCustomerInstructions(fundingCase, customer, format);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Kundenanweisung (Nachweise)
        </p>
        <div className="flex rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden text-xs">
          {(['whatsapp', 'email'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`px-2.5 py-0.5 font-medium transition-colors ${
                format === f
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {f === 'whatsapp' ? 'WhatsApp' : 'E-Mail'}
            </button>
          ))}
        </div>
      </div>
      <pre className="text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-md p-2.5 whitespace-pre-wrap font-sans leading-relaxed max-h-40 overflow-y-auto">
        {text}
      </pre>
      <CopyButton
        text={text}
        label={`${format === 'whatsapp' ? 'WhatsApp-Text' : 'E-Mail-Text'} kopieren`}
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProofSubmissionSection({
  caseId,
  fundingCase,
  customer,
}: {
  caseId: string;
  fundingCase: FundingCaseRow;
  customer: CustomerRow | null;
}) {
  const router = useRouter();
  const proof  = computeKfwProofSubmissionState(fundingCase);

  // ── Form states ──
  const [approvalState,  approvalAction]  = useFormState<ProofActionState, FormData>(markKfwApprovalReceivedAction,   null);
  const [implStState,    implStAction]    = useFormState<ProofActionState, FormData>(markImplementationStartedAction, null);
  const [implDoneState,  implDoneAction]  = useFormState<ProofActionState, FormData>(markImplementationCompletedAction, null);
  const [bndState,       bndAction]       = useFormState<ProofActionState, FormData>(updateBndIdAction,                null);
  const [prepState,      prepAction]      = useFormState<ProofActionState, FormData>(markProofPreparedAction,          null);
  const [subState,       subAction]       = useFormState<ProofActionState, FormData>(markProofSubmittedAction,         null);
  const [payoutState,    payoutAction]    = useFormState<ProofActionState, FormData>(markPayoutPaidAction,             null);
  const [resetState,     resetAction]     = useFormState<ProofActionState, FormData>(resetProofSubmissionAction,       null);
  const [tasksState,     tasksAction]     = useFormState<ProofTasksState,  FormData>(createProofTasksAction,           null);

  const allStates = [approvalState, implStState, implDoneState, bndState, prepState, subState, payoutState, resetState];
  useEffect(() => {
    if (allStates.some((s) => s?.success)) router.refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...allStates]);

  // ── Local state ──
  const [bndIdValue,   setBndIdValue]   = useState(proof.bndId ?? '');
  const [bndDateValue, setBndDateValue] = useState(proof.bndCreatedAt ?? '');
  const [bndEditOpen,  setBndEditOpen]  = useState(false);
  const [resetOpen,    setResetOpen]    = useState(false);

  useEffect(() => { setBndIdValue(proof.bndId ?? ''); },       [proof.bndId]);
  useEffect(() => { setBndDateValue(proof.bndCreatedAt ?? ''); }, [proof.bndCreatedAt]);

  const hasBndIdInput = normalizeBndId(bndIdValue).length > 0;

  const step = proof.currentStep;

  return (
    <div className="space-y-4">
      {/* Disclaimer */}
      <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 rounded-md px-2.5 py-1.5">
        Interne Vorbereitung · keine Fördergarantie · keine automatische Nachweiseinreichung · Einreichung nur durch Kunden in „Meine KfW"
      </p>

      {/* Step tracker */}
      <StepTracker activeStep={step} />

      {/* ── Step 1: Förderzusage ── */}
      {step === 'waiting_for_approval' && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 text-xs text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 rounded-md px-2.5 py-1.5">
            <Clock className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            Warte auf schriftliche KfW-Förderzusage. Kein Vorhabenbeginn vor Erhalt der Zusage!
          </div>
          <form action={approvalAction}>
            <input type="hidden" name="case_id" value={caseId} />
            <PrimaryBtn>Förderzusage erhalten – eintragen</PrimaryBtn>
            <ErrorMsg msg={approvalState?.error} />
          </form>
        </div>
      )}

      {/* Step 1 done indicator + date */}
      {step !== 'waiting_for_approval' && proof.kfwApprovalReceivedAt && (
        <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Förderzusage eingetragen am {new Date(proof.kfwApprovalReceivedAt).toLocaleDateString('de-DE')}
        </div>
      )}

      {/* ── Step 2: Umsetzung starten ── */}
      {step === 'approval_received' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Förderzusage liegt vor. Umsetzung durch das Fachunternehmen kann beginnen.
          </p>
          <div className="flex flex-wrap gap-2">
            <form action={implStAction}>
              <input type="hidden" name="case_id" value={caseId} />
              <PrimaryBtn>Umsetzung gestartet</PrimaryBtn>
              <ErrorMsg msg={implStState?.error} />
            </form>
            <form action={tasksAction}>
              <input type="hidden" name="case_id" value={caseId} />
              <SubmitBtn>
                <ClipboardList className="h-3.5 w-3.5" />
                Nachweisaufgaben erstellen
              </SubmitBtn>
            </form>
          </div>
          {tasksState?.created !== undefined && (
            <p className="text-xs text-green-700 dark:text-green-400">
              {tasksState.created} Aufgabe{tasksState.created !== 1 ? 'n' : ''} erstellt
              {(tasksState.skipped ?? 0) > 0 ? `, ${tasksState.skipped} bereits vorhanden` : ''}.
            </p>
          )}
          {tasksState?.error && <p className="text-xs text-red-600 dark:text-red-400">{tasksState.error}</p>}
        </div>
      )}

      {/* ── Step 3: Umsetzung abschließen ── */}
      {step === 'implementation_started' && (
        <div className="space-y-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Umsetzung gestartet{proof.implementationStartedAt
              ? ` am ${new Date(proof.implementationStartedAt).toLocaleDateString('de-DE')}`
              : ''}.
          </div>
          <form action={implDoneAction}>
            <input type="hidden" name="case_id" value={caseId} />
            <PrimaryBtn>Umsetzung abgeschlossen</PrimaryBtn>
            <ErrorMsg msg={implDoneState?.error} />
          </form>
        </div>
      )}

      {/* ── Step 4: BnD-ID eintragen ── */}
      {step === 'implementation_completed' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Umsetzung abgeschlossen{proof.implementationCompletedAt
              ? ` am ${new Date(proof.implementationCompletedAt).toLocaleDateString('de-DE')}`
              : ''}. BnD (Bestätigung nach Durchführung) beim Fachunternehmen anfordern und ID eintragen.
          </p>
          <form action={bndAction} className="space-y-2.5">
            <input type="hidden" name="case_id" value={caseId} />
            <BndIdInput
              value={bndIdValue}
              onChange={setBndIdValue}
              dateValue={bndDateValue}
              onDateChange={setBndDateValue}
            />
            <PrimaryBtn>
              {hasBndIdInput ? 'BnD-ID speichern' : 'Ohne ID fortfahren'}
            </PrimaryBtn>
            <ErrorMsg msg={bndState?.error} />
          </form>
        </div>
      )}

      {/* ── BnD-ID done display ── */}
      {(step === 'bnd_entered' || step === 'proof_prepared' || step === 'proof_submitted' || step === 'payout_received') && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
              <span className="text-gray-700 dark:text-gray-300">
                {proof.bndId ? (
                  <>BnD-ID: <span className="font-mono font-medium">{proof.bndId}</span></>
                ) : (
                  <span className="text-gray-500 dark:text-gray-400 italic">Ohne BnD-ID fortgefahren</span>
                )}
              </span>
            </div>
            {proof.bndCreatedAt && (
              <span className="text-gray-400 dark:text-gray-500">
                Erstellt am {new Date(proof.bndCreatedAt).toLocaleDateString('de-DE')}
              </span>
            )}
          </div>
          <SubSection title="BnD-ID bearbeiten" open={bndEditOpen} onToggle={() => setBndEditOpen((v) => !v)}>
            <form action={bndAction} className="space-y-2">
              <input type="hidden" name="case_id" value={caseId} />
              <BndIdInput
                value={bndIdValue}
                onChange={setBndIdValue}
                dateValue={bndDateValue}
                onDateChange={setBndDateValue}
              />
              <SubmitBtn>BnD-ID speichern</SubmitBtn>
              <ErrorMsg msg={bndState?.error} />
            </form>
          </SubSection>
        </div>
      )}

      {/* ── Step 5: Nachweise vorbereiten ── */}
      {step === 'bnd_entered' && (
        <div className="space-y-3">
          <ProofInstructionPanel fundingCase={fundingCase} customer={customer} />
          <form action={prepAction}>
            <input type="hidden" name="case_id" value={caseId} />
            <PrimaryBtn>Nachweise intern vorbereitet</PrimaryBtn>
            <ErrorMsg msg={prepState?.error} />
          </form>
        </div>
      )}

      {/* ── Step 6: Nachweise einreichen ── */}
      {step === 'proof_prepared' && (
        <div className="space-y-3">
          <ProofInstructionPanel fundingCase={fundingCase} customer={customer} />
          <div className="text-xs text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 rounded-md px-2.5 py-1.5">
            Kunden anweisen, Nachweise in „Meine KfW" hochzuladen und einzureichen.
            Keine automatische Einreichung – Kunde muss selbst tätig werden.
          </div>
          <form action={subAction}>
            <input type="hidden" name="case_id" value={caseId} />
            <PrimaryBtn>Vom Kunden eingereicht (bestätigen)</PrimaryBtn>
            <ErrorMsg msg={subState?.error} />
          </form>
        </div>
      )}

      {/* ── Submitted: wait for payout ── */}
      {(step === 'proof_submitted' || step === 'payout_received') && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 text-xs text-green-800 dark:text-green-300 bg-green-50 dark:bg-green-950/60 rounded-md px-2.5 py-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            Nachweise eingereicht{proof.proofSubmittedAt
              ? ` am ${new Date(proof.proofSubmittedAt).toLocaleDateString('de-DE')}`
              : ''}.
            {step === 'proof_submitted' && ' Auf KfW-Auszahlung warten.'}
          </div>

          {/* Payout tracking */}
          {step === 'proof_submitted' && (
            <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Auszahlung</p>
              <form action={payoutAction}>
                <input type="hidden" name="case_id" value={caseId} />
                <SubmitBtn>Auszahlung eingegangen</SubmitBtn>
                <ErrorMsg msg={payoutState?.error} />
              </form>
            </div>
          )}

          {step === 'payout_received' && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Auszahlung eingegangen – Fall kann abgeschlossen werden.
            </div>
          )}
        </div>
      )}

      {/* ── Reset (collapsible) ── */}
      <SubSection title="Zurücksetzen" open={resetOpen} onToggle={() => setResetOpen((v) => !v)}>
        <div className="space-y-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Setzt alle Nachweis-Felder zurück (Förderzusage-Datum, Umsetzungsstatus, BnD-ID, Nachweise, Auszahlung).
            Der KfW-Antragsstatus (eingereicht) bleibt erhalten.
          </p>
          <form action={resetAction}>
            <input type="hidden" name="case_id" value={caseId} />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-md border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Nachweisphase zurücksetzen
            </button>
            <ErrorMsg msg={resetState?.error} />
          </form>
        </div>
      </SubSection>
    </div>
  );
}
