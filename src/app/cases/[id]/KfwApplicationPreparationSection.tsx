'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2, Clock, AlertCircle, Copy, Check, RotateCcw, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  updateBzaIdAction,
  markBzaRequestedAction,
  markBzaCreatedAction,
  markKfwApplicationPreparedAction,
  markKfwApplicationSubmittedAction,
  resetKfwApplicationPreparationAction,
} from './kfw-application-actions';
import type { KfwActionState } from './kfw-application-actions';
import { computeKfwApplicationPreparationState } from '@/lib/kfw/application-preparation';
import { generateCustomerInstructions } from '@/lib/kfw/customer-instructions';
import type { InstructionFormat } from '@/lib/kfw/customer-instructions';
import type { ReadinessSummary } from '@/lib/documents/checklist';
import type { Database } from '@/lib/supabase/database.types';

type FundingCaseRow = Database['public']['Tables']['funding_cases']['Row'];
type CustomerRow    = Database['public']['Tables']['customers']['Row'];

// ─── Static labels ────────────────────────────────────────────────────────────

const BZA_STATUS_LABELS: Record<string, string> = {
  not_started: 'Noch nicht begonnen',
  requested:   'Angefordert',
  created:     'Erstellt',
};

const KFW_STATUS_LABELS: Record<string, string> = {
  not_started: 'Noch nicht vorbereitet',
  prepared:    'Vorbereitet',
  submitted:   'Eingereicht',
  approved:    'Förderzusage erhalten',
};

const BZA_RESPONSIBLE_LABELS: Record<string, string> = {
  specialist_company: 'Qualifiziertes Fachunternehmen',
  energy_expert:      'Energieeffizienz-Experte',
  unclear:            'Noch offen',
};

// ─── Shared small helpers ─────────────────────────────────────────────────────

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

function StatusPill({
  label,
  variant,
}: {
  label: string;
  variant: 'gray' | 'yellow' | 'green' | 'blue';
}) {
  const cls = {
    gray:   'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300',
    green:  'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
    blue:   'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  }[variant];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function ErrorMsg({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-red-600 dark:text-red-400">{msg}</p>;
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({
  text,
  label,
}: {
  text: string;
  label: string;
}) {
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

// ─── Section separator with toggle ───────────────────────────────────────────

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

// ─── Instruction preview ──────────────────────────────────────────────────────

function InstructionPanel({
  fundingCase,
  customer,
  bzaId,
}: {
  fundingCase: FundingCaseRow;
  customer: CustomerRow | null;
  bzaId: string | null;
}) {
  const [format, setFormat] = useState<InstructionFormat>('whatsapp');
  const text = generateCustomerInstructions(fundingCase, customer, bzaId, format);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Kundenanweisung</p>
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

export default function KfwApplicationPreparationSection({
  caseId,
  fundingCase,
  customer,
  readiness,
}: {
  caseId: string;
  fundingCase: FundingCaseRow;
  customer: CustomerRow | null;
  readiness: ReadinessSummary;
}) {
  const router = useRouter();
  const kfw = computeKfwApplicationPreparationState(fundingCase, readiness);

  // ── Form states ──
  const [bzaIdState,  bzaIdAction]  = useFormState<KfwActionState, FormData>(updateBzaIdAction,  null);
  const [reqState,    reqAction]    = useFormState<KfwActionState, FormData>(markBzaRequestedAction, null);
  const [creState,    creAction]    = useFormState<KfwActionState, FormData>(markBzaCreatedAction, null);
  const [prepState,   prepAction]   = useFormState<KfwActionState, FormData>(markKfwApplicationPreparedAction, null);
  const [subState,    subAction]    = useFormState<KfwActionState, FormData>(markKfwApplicationSubmittedAction, null);
  const [resetState,  resetAction]  = useFormState<KfwActionState, FormData>(resetKfwApplicationPreparationAction, null);

  const allStates = [bzaIdState, reqState, creState, prepState, subState, resetState];
  useEffect(() => {
    if (allStates.some((s) => s?.success)) router.refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...allStates]);

  // ── Local state ──
  const [bzaIdValue,  setBzaIdValue]  = useState(kfw.bzaId ?? '');
  const [bzaDateValue, setBzaDateValue] = useState(kfw.bzaCreatedAt ?? '');
  const [refValue,    setRefValue]    = useState(kfw.kfwApplicationReference ?? '');
  const [bzaEditOpen, setBzaEditOpen] = useState(false);
  const [resetOpen,   setResetOpen]   = useState(false);

  useEffect(() => { setBzaIdValue(kfw.bzaId ?? ''); },             [kfw.bzaId]);
  useEffect(() => { setBzaDateValue(kfw.bzaCreatedAt ?? ''); },     [kfw.bzaCreatedAt]);
  useEffect(() => { setRefValue(kfw.kfwApplicationReference ?? ''); }, [kfw.kfwApplicationReference]);

  const bzaStatusVariant: 'gray' | 'yellow' | 'green' =
    kfw.bzaStatus === 'created'   ? 'green' :
    kfw.bzaStatus === 'requested' ? 'yellow' : 'gray';

  const kfwStatusVariant: 'gray' | 'yellow' | 'green' | 'blue' =
    kfw.kfwApplicationStatus === 'approved'  ? 'blue' :
    kfw.kfwApplicationStatus === 'submitted' ? 'green' :
    kfw.kfwApplicationStatus === 'prepared'  ? 'yellow' : 'gray';

  const responsibleLabel = kfw.bzaResponsibleParty
    ? (BZA_RESPONSIBLE_LABELS[kfw.bzaResponsibleParty] ?? kfw.bzaResponsibleParty)
    : 'Noch nicht festgelegt';

  return (
    <div className="space-y-4">
      {/* Disclaimer */}
      <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 rounded-md px-2.5 py-1.5">
        Interne Vorbereitung · keine Fördergarantie · keine automatische KfW-Antragstellung · manuelle Prüfung erforderlich
      </p>

      {/* ── BzA section ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            BzA (Bestätigung zum Antrag)
          </p>
          <StatusPill label={BZA_STATUS_LABELS[kfw.bzaStatus] ?? kfw.bzaStatus} variant={bzaStatusVariant} />
        </div>

        {/* Zuständig */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-400 dark:text-gray-500">Zuständig:</span>
          <span className="text-gray-700 dark:text-gray-300">{responsibleLabel}</span>
          <a href="#bza-preparation" className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 underline">
            ändern
          </a>
        </div>

        {/* not_started → request button */}
        {kfw.bzaStatus === 'not_started' && (
          <form action={reqAction}>
            <input type="hidden" name="case_id" value={caseId} />
            <PrimaryBtn>BzA anfordern</PrimaryBtn>
            <ErrorMsg msg={reqState?.error} />
          </form>
        )}

        {/* requested → BzA-ID form */}
        {kfw.bzaStatus === 'requested' && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-xs text-yellow-800 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-950/60 rounded-md px-2.5 py-1.5">
              <Clock className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              Warte auf BzA-Erstellung durch das Fachunternehmen. Sobald die BzA-Referenznummer vorliegt, hier eintragen.
            </div>
            <form action={bzaIdAction} className="space-y-2">
              <input type="hidden" name="case_id" value={caseId} />
              <div className="flex flex-wrap gap-2 items-end">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">BzA-Referenznummer</label>
                  <input
                    name="bza_id"
                    type="text"
                    value={bzaIdValue}
                    onChange={(e) => setBzaIdValue(e.target.value)}
                    placeholder="z. B. BZA-2024-XXXXX"
                    className="text-xs rounded border border-gray-200 dark:border-gray-700 px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400 w-48"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Datum BzA-Erstellung</label>
                  <input
                    name="bza_created_at"
                    type="date"
                    value={bzaDateValue}
                    onChange={(e) => setBzaDateValue(e.target.value)}
                    className="text-xs rounded border border-gray-200 dark:border-gray-700 px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400"
                  />
                </div>
                <SubmitBtn>Speichern</SubmitBtn>
              </div>
              <ErrorMsg msg={bzaIdState?.error} />
            </form>
            <form action={creAction}>
              <input type="hidden" name="case_id" value={caseId} />
              <PrimaryBtn>BzA als erstellt markieren</PrimaryBtn>
              <ErrorMsg msg={creState?.error} />
            </form>
          </div>
        )}

        {/* created → show BzA-ID + edit option */}
        {kfw.bzaStatus === 'created' && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                <span className="text-gray-700 dark:text-gray-300">
                  {kfw.bzaId ? (
                    <>Referenznummer: <span className="font-mono font-medium">{kfw.bzaId}</span></>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500 italic">Referenznummer nicht eingetragen</span>
                  )}
                </span>
              </div>
              {kfw.bzaCreatedAt && (
                <span className="text-gray-400 dark:text-gray-500">
                  Erstellt am {new Date(kfw.bzaCreatedAt).toLocaleDateString('de-DE')}
                </span>
              )}
            </div>
            <SubSection title="BzA-Daten bearbeiten" open={bzaEditOpen} onToggle={() => setBzaEditOpen((v) => !v)}>
              <form action={bzaIdAction} className="space-y-2">
                <input type="hidden" name="case_id" value={caseId} />
                <div className="flex flex-wrap gap-2 items-end">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">BzA-Referenznummer</label>
                    <input
                      name="bza_id"
                      type="text"
                      value={bzaIdValue}
                      onChange={(e) => setBzaIdValue(e.target.value)}
                      className="text-xs rounded border border-gray-200 dark:border-gray-700 px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400 w-48"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Datum</label>
                    <input
                      name="bza_created_at"
                      type="date"
                      value={bzaDateValue}
                      onChange={(e) => setBzaDateValue(e.target.value)}
                      className="text-xs rounded border border-gray-200 dark:border-gray-700 px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400"
                    />
                  </div>
                  <SubmitBtn>Speichern</SubmitBtn>
                </div>
                <ErrorMsg msg={bzaIdState?.error} />
              </form>
            </SubSection>
          </div>
        )}
      </div>

      {/* ── KfW-Antrag section (visible once BzA is created) ── */}
      {(kfw.bzaStatus === 'created' || kfw.kfwApplicationStatus !== 'not_started') && (
        <div className="space-y-3 border-t border-gray-100 dark:border-gray-800 pt-4">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              KfW-Antrag
            </p>
            <StatusPill
              label={KFW_STATUS_LABELS[kfw.kfwApplicationStatus] ?? kfw.kfwApplicationStatus}
              variant={kfwStatusVariant}
            />
          </div>

          {/* Customer instruction generator (always show when bza created) */}
          <InstructionPanel fundingCase={fundingCase} customer={customer} bzaId={kfw.bzaId} />

          {/* not_started → prepare form */}
          {kfw.kfwApplicationStatus === 'not_started' && (
            <form action={prepAction} className="space-y-2">
              <input type="hidden" name="case_id" value={caseId} />
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">
                  Interne Referenz (optional)
                </label>
                <input
                  name="kfw_application_reference"
                  type="text"
                  value={refValue}
                  onChange={(e) => setRefValue(e.target.value)}
                  placeholder="z. B. interne Auftragsnummer"
                  className="text-xs rounded border border-gray-200 dark:border-gray-700 px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400 w-64"
                />
              </div>
              <PrimaryBtn>Als vorbereitet markieren</PrimaryBtn>
              <ErrorMsg msg={prepState?.error} />
            </form>
          )}

          {/* prepared → waiting for customer to submit */}
          {kfw.kfwApplicationStatus === 'prepared' && (
            <div className="space-y-3">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Vorbereitet am{' '}
                {kfw.kfwApplicationPreparedAt
                  ? new Date(kfw.kfwApplicationPreparedAt).toLocaleDateString('de-DE')
                  : '–'}
                {kfw.kfwApplicationReference && ` · Referenz: ${kfw.kfwApplicationReference}`}
              </div>
              <div className="text-xs text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 rounded-md px-2.5 py-1.5">
                Sobald der Kunde den Antrag in „Meine KfW" eingereicht hat, bitte unten bestätigen.
              </div>
              <form action={subAction}>
                <input type="hidden" name="case_id" value={caseId} />
                <PrimaryBtn>Antrag vom Kunden eingereicht (bestätigen)</PrimaryBtn>
                <ErrorMsg msg={subState?.error} />
              </form>
            </div>
          )}

          {/* submitted → waiting for approval */}
          {kfw.kfwApplicationStatus === 'submitted' && (
            <div className="space-y-2">
              <div className="flex items-start gap-2 text-xs text-green-800 dark:text-green-300 bg-green-50 dark:bg-green-950/60 rounded-md px-2.5 py-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                Antrag eingereicht – auf Förderzusage von KfW warten.
              </div>
              <div className="flex items-start gap-2 text-xs text-red-800 dark:text-red-300 bg-red-50 dark:bg-red-950/60 rounded-md px-2.5 py-1.5">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                Kein Vorhabenbeginn vor schriftlicher KfW-Förderzusage!
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Nach Erhalt der Förderzusage: KfW-Bewilligung hochladen (Dokumente ↓) und Fallstatus aktualisieren.
              </p>
            </div>
          )}

          {/* approved */}
          {kfw.kfwApplicationStatus === 'approved' && (
            <div className="flex items-start gap-2 text-xs text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 rounded-md px-2.5 py-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              Förderzusage von KfW erhalten. Ausführung kann freigegeben werden.
            </div>
          )}
        </div>
      )}

      {/* ── Reset (collapsible) ── */}
      <SubSection title="Zurücksetzen" open={resetOpen} onToggle={() => setResetOpen((v) => !v)}>
        <div className="space-y-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Setzt BzA-Status, BzA-Referenznummer und KfW-Antragsstatus zurück. Keine Daten werden gelöscht außer den unten genannten Feldern.
          </p>
          <form action={resetAction}>
            <input type="hidden" name="case_id" value={caseId} />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-md border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              KfW-Antragsvorbereitung zurücksetzen
            </button>
            <ErrorMsg msg={resetState?.error} />
          </form>
        </div>
      </SubSection>
    </div>
  );
}
