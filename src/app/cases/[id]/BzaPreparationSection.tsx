'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronDown, ChevronUp, AlertTriangle, CheckCircle2,
  XCircle, Info, Copy, RefreshCw, Plus, CheckCircle,
} from 'lucide-react';
import {
  updateBzaResponsiblePartyAction,
  createBzaTasksAction,
} from './bza-actions';
import type { BzaResponsiblePartyState, BzaTasksState } from './bza-actions';
import { computeBzaPreparation } from '@/lib/bza/preparation';
import type { BzaReadinessStatus } from '@/lib/bza/preparation';
import type { ChecklistItem, ReadinessSummary } from '@/lib/documents/checklist';
import type { Database } from '@/lib/supabase/database.types';
import {
  BUILDING_TYPE_LABELS,
  OWNER_STATUS_LABELS,
  CURRENT_HEATING_TYPE_LABELS,
  PLANNED_HEATING_TYPE_LABELS,
} from '@/lib/constants/form-options';

type FundingCaseRow = Database['public']['Tables']['funding_cases']['Row'];
type CustomerRow    = Database['public']['Tables']['customers']['Row'];
type DocumentRow    = Database['public']['Tables']['documents']['Row'];
type AICheckRow     = Database['public']['Tables']['ai_checks']['Row'];
type TaskRow        = Database['public']['Tables']['tasks']['Row'];

// ─── Static config ────────────────────────────────────────────────────────────

const BZA_STATUS_CONFIG: Record<BzaReadinessStatus, { label: string; cls: string }> = {
  bereit:       { label: 'Bereit zur BzA-Vorbereitung',         cls: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' },
  fast_bereit:  { label: 'Vorbereitung möglich – Punkte offen', cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300' },
  nicht_bereit: { label: 'Nicht bereit',                        cls: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' },
};

const DOC_STATUS_CFG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  reviewed:     { label: 'Geprüft',    cls: 'text-green-700 dark:text-green-400',  icon: <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-green-600 dark:text-green-400" /> },
  needs_review: { label: 'Ausstehend', cls: 'text-yellow-700 dark:text-yellow-500', icon: <Info className="h-3.5 w-3.5 flex-shrink-0 text-yellow-500" /> },
  rejected:     { label: 'Abgelehnt',  cls: 'text-red-700 dark:text-red-400',      icon: <XCircle className="h-3.5 w-3.5 flex-shrink-0 text-red-600 dark:text-red-400" /> },
  missing:      { label: 'Fehlt',      cls: 'text-orange-700 dark:text-orange-400', icon: <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-orange-500" /> },
};

const BZA_RESPONSIBLE_OPTIONS = [
  { value: 'specialist_company', label: 'Qualifiziertes Fachunternehmen / Fachbetrieb' },
  { value: 'energy_expert',      label: 'Energieeffizienz-Experte' },
  { value: 'unclear',            label: 'Noch offen' },
] as const;

const FR_TYPE_LABEL: Record<string, string> = {
  aufschiebend: 'Aufschiebend',
  aufloesend:   'Auflösend',
  both:         'Aufschiebend & Auflösend',
  unclear:      'Vorhanden (unklar)',
  missing:      'Fehlt',
};

// ─── Safe JSON accessors ──────────────────────────────────────────────────────

function jObj(obj: unknown, key: string): Record<string, unknown> | undefined {
  if (typeof obj !== 'object' || obj === null) return undefined;
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === 'object' && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined;
}

function jStr(obj: unknown, key: string): string | null {
  if (typeof obj !== 'object' || obj === null) return null;
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === 'string' && v ? v : null;
}

function jBool(obj: unknown, key: string): boolean {
  if (typeof obj !== 'object' || obj === null) return false;
  return (obj as Record<string, unknown>)[key] === true;
}

// ─── Small sub-components ─────────────────────────────────────────────────────

function DataRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-xs py-0.5">
      <span className="w-40 flex-shrink-0 text-gray-400 dark:text-gray-500">{label}:</span>
      <span className="text-gray-700 dark:text-gray-300 min-w-0 break-words">{value}</span>
    </div>
  );
}

function SectionToggle({
  title,
  open,
  onToggle,
  badge,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  badge?: React.ReactNode;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
    >
      {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      {title}
      {badge}
    </button>
  );
}

function SaveButton() {
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

function CreateTasksButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
    >
      <Plus className="h-3.5 w-3.5" />
      {pending ? 'Aufgaben werden erstellt…' : 'BzA-Aufgaben erstellen'}
    </button>
  );
}

// ─── Markdown generation ──────────────────────────────────────────────────────

function buildMarkdown(
  fundingCase: FundingCaseRow,
  customer: CustomerRow | null,
  checklistItems: ChecklistItem[],
  bza: ReturnType<typeof computeBzaPreparation>,
  contractRJ: Record<string, unknown> | null,
  offerRJ: Record<string, unknown> | null,
): string {
  const today       = new Date().toLocaleDateString('de-DE');
  const statusLabel = BZA_STATUS_CONFIG[bza.readinessStatus].label;
  const bzaRP       = BZA_RESPONSIBLE_OPTIONS.find(
    (o) => o.value === fundingCase.bza_responsible_party,
  )?.label ?? 'Noch offen';

  const lines: string[] = [
    '# BzA-Vorbereitungsblatt',
    '',
    `**Fall:** ${fundingCase.title}`,
    `**Datum:** ${today}`,
    `**BzA-Status:** ${statusLabel}`,
    '',
    '---',
    '',
    '## Stammdaten',
  ];

  if (customer) {
    lines.push(`- **Kunde:** ${customer.first_name} ${customer.last_name}`);
    lines.push(`- **E-Mail:** ${customer.email}`);
    if (customer.phone) lines.push(`- **Telefon:** ${customer.phone}`);
    lines.push(`- **Rechnungsadresse:** ${customer.street}, ${customer.postal_code} ${customer.city}`);
  }
  const pStreet = fundingCase.project_address_street;
  if (pStreet) {
    lines.push(`- **Projektadresse:** ${pStreet}, ${fundingCase.project_address_postal_code ?? ''} ${fundingCase.project_address_city ?? ''}`.trimEnd());
  }
  if (fundingCase.building_type)   lines.push(`- **Gebäudetyp:** ${BUILDING_TYPE_LABELS[fundingCase.building_type] ?? fundingCase.building_type}`);
  if (fundingCase.housing_units != null) lines.push(`- **Wohneinheiten:** ${fundingCase.housing_units}`);
  if (fundingCase.owner_status)    lines.push(`- **Eigentümer:** ${OWNER_STATUS_LABELS[fundingCase.owner_status] ?? fundingCase.owner_status}`);
  if (fundingCase.self_occupied != null) lines.push(`- **Selbst bewohnt:** ${fundingCase.self_occupied ? 'Ja' : 'Nein'}`);
  lines.push('');

  lines.push('## Bestandsheizung');
  if (fundingCase.current_heating_type)  lines.push(`- **Typ:** ${CURRENT_HEATING_TYPE_LABELS[fundingCase.current_heating_type] ?? fundingCase.current_heating_type}`);
  if (fundingCase.current_heating_year)  lines.push(`- **Baujahr:** ${fundingCase.current_heating_year}`);
  lines.push('');

  lines.push('## Geplante Anlage');
  if (fundingCase.planned_heating_type)     lines.push(`- **Typ:** ${PLANNED_HEATING_TYPE_LABELS[fundingCase.planned_heating_type] ?? fundingCase.planned_heating_type}`);
  if (fundingCase.planned_heat_pump_model)  lines.push(`- **Modell (Akte):** ${fundingCase.planned_heat_pump_model}`);
  if (offerRJ) {
    const hp  = jObj(offerRJ, 'heat_pump');
    const mfr = jStr(hp, 'manufacturer');
    const mdl = jStr(hp, 'model');
    if (mfr || mdl) lines.push(`- **Modell (Angebot):** ${[mfr, mdl].filter(Boolean).join(' ')}`);
    const c   = jObj(offerRJ, 'costs');
    const net = jStr(c, 'net_amount');
    const grs = jStr(c, 'gross_amount');
    if (net) lines.push(`- **Netto (Angebot):** ${net}`);
    if (grs) lines.push(`- **Brutto (Angebot):** ${grs}`);
  }
  if (fundingCase.estimated_cost != null) {
    lines.push(`- **Geschätzte Kosten (Akte):** ${fundingCase.estimated_cost.toLocaleString('de-DE')} €`);
  }
  lines.push('');

  lines.push('## Pflichtunterlagen (vor Antragstellung)');
  const beforeApp = checklistItems.filter((i) => i.phase === 'before_application' && i.required);
  for (const item of beforeApp) {
    const icon = item.status === 'reviewed' ? '✅' : item.status === 'rejected' ? '❌' : item.status === 'missing' ? '❌' : '⚠️';
    const sl   = { reviewed: 'Geprüft', rejected: 'Abgelehnt', missing: 'Fehlt', needs_review: 'Ausstehend' }[item.status] ?? item.status;
    const fn   = item.latest_filename ? ` · ${item.latest_filename}` : '';
    lines.push(`- ${icon} **${item.label_de}**: ${sl}${fn}`);
  }
  lines.push('');

  if (contractRJ) {
    const fr = jObj(contractRJ, 'funding_reservation');
    lines.push('## Vertragsprüfung');
    const rvw = bza.preferredContractCheck?.human_review_status;
    lines.push(`- **Freigabe:** ${rvw === 'approved' ? 'Freigegeben' : rvw === 'rejected' ? 'Abgelehnt' : 'Ausstehend'}`);
    lines.push(`- **KI-Ergebnis:** ${jStr(contractRJ, 'overall_assessment') ?? '–'}`);
    if (fr) {
      lines.push(`- **Fördervorbehalt:** ${jBool(fr, 'present') ? 'Vorhanden' : 'Fehlt'}`);
      const t = jStr(fr, 'type');
      if (t) lines.push(`- **Art:** ${FR_TYPE_LABEL[t] ?? t}`);
      lines.push(`- **KfW-Bezug:** ${jBool(fr, 'mentions_kfw_funding_approval') ? 'Ja' : 'Nein/unklar'}`);
    }
    lines.push('');
  }

  if (offerRJ) {
    const hp    = jObj(offerRJ, 'heat_pump');
    const scope = jObj(offerRJ, 'eligible_scope_indicators');
    lines.push('## Angebotsprüfung');
    const rvw = bza.preferredOfferCheck?.human_review_status;
    lines.push(`- **Freigabe:** ${rvw === 'approved' ? 'Freigegeben' : rvw === 'rejected' ? 'Abgelehnt' : 'Ausstehend'}`);
    lines.push(`- **KI-Ergebnis:** ${jStr(offerRJ, 'overall_assessment') ?? '–'}`);
    if (hp) {
      lines.push(`- **Wärmepumpe erkennbar:** ${jBool(hp, 'present') ? 'Ja' : 'Nein'}`);
      const m = [jStr(hp, 'manufacturer'), jStr(hp, 'model')].filter(Boolean).join(' ');
      if (m) lines.push(`- **Modell:** ${m}`);
    }
    if (scope) {
      lines.push(`- **Hydraulischer Abgleich:** ${jBool(scope, 'hydraulic_balancing_present') ? 'Ja' : 'Nein/unklar'}`);
      lines.push(`- **Inbetriebnahme:** ${jBool(scope, 'commissioning_present') ? 'Ja' : 'Nein/unklar'}`);
    }
    lines.push('');
  }

  if (bza.warnings.length > 0) {
    lines.push('## Offene Punkte');
    for (const w of bza.warnings) {
      const icon = w.level === 'error' ? '🔴' : w.level === 'warning' ? '🟡' : 'ℹ️';
      lines.push(`- ${icon} ${w.message}`);
    }
    lines.push('');
  }

  lines.push('## BzA-Verantwortlicher');
  lines.push(`- **Zuständig:** ${bzaRP}`);
  lines.push('');
  lines.push('---');
  lines.push('*Internes Vorbereitungsblatt · keine Fördergarantie · keine automatische KfW-Antragstellung · manuelle Prüfung erforderlich*');

  return lines.join('\n');
}

// ─── Collapsible check summary ────────────────────────────────────────────────

function CheckSummaryRows({
  rj,
  isContract,
}: {
  rj: Record<string, unknown> | null;
  isContract: boolean;
}) {
  if (!rj) return null;
  const overall = jStr(rj, 'overall_assessment');
  const overallLabel = isContract
    ? ({ pass: 'Fördervorbehalt plausibel', needs_revision: 'Nachbesserung nötig', critical: 'Kritisch' }[overall ?? ''] ?? overall ?? '–')
    : ({ pass: 'Angebot plausibel', needs_revision: 'Nachbesserung nötig', critical: 'Kritisch' }[overall ?? ''] ?? overall ?? '–');

  if (isContract) {
    const fr   = jObj(rj, 'funding_reservation');
    const ps   = jObj(rj, 'premature_start_risk');
    const impl = jObj(rj, 'implementation_period');
    return (
      <>
        <DataRow label="KI-Ergebnis"        value={overallLabel} />
        {fr && (
          <>
            <DataRow label="Fördervorbehalt"   value={jBool(fr, 'present') ? 'Vorhanden' : 'Fehlt'} />
            {jBool(fr, 'present') && (
              <DataRow label="Art"             value={FR_TYPE_LABEL[jStr(fr, 'type') ?? ''] ?? jStr(fr, 'type')} />
            )}
            <DataRow label="KfW-Bezug"         value={jBool(fr, 'mentions_kfw_funding_approval') ? 'Ja' : 'Nein/unklar'} />
          </>
        )}
        {ps && (
          <DataRow label="Vorzeitiger Beginn"  value={jBool(ps, 'detected') ? `Erkannt (${jStr(ps, 'severity') ?? '–'})` : 'Kein Risiko'} />
        )}
        {impl && (
          <DataRow label="Ausführungszeitraum" value={jBool(impl, 'present') ? 'Vorhanden' : 'Nicht erkennbar'} />
        )}
      </>
    );
  }

  // Offer check
  const hp    = jObj(rj, 'heat_pump');
  const costs = jObj(rj, 'costs');
  const scope = jObj(rj, 'eligible_scope_indicators');
  const impl  = jObj(rj, 'implementation_period');
  return (
    <>
      <DataRow label="KI-Ergebnis"       value={overallLabel} />
      {hp && (
        <>
          <DataRow label="Wärmepumpe"    value={jBool(hp, 'present') ? 'Erkennbar' : 'Nicht erkennbar'} />
          <DataRow label="Modell"        value={[jStr(hp, 'manufacturer'), jStr(hp, 'model')].filter(Boolean).join(' ') || null} />
          <DataRow label="Art WP"        value={jStr(hp, 'type')} />
        </>
      )}
      {costs && (
        <>
          <DataRow label="Netto"         value={jStr(costs, 'net_amount')} />
          <DataRow label="Brutto"        value={jStr(costs, 'gross_amount')} />
          <DataRow label="MwSt."         value={jStr(costs, 'vat_rate')} />
        </>
      )}
      {scope && (
        <>
          <DataRow label="Hydr. Abgleich"     value={jBool(scope, 'hydraulic_balancing_present') ? 'Ja' : 'Nein/unklar'} />
          <DataRow label="Inbetriebnahme"     value={jBool(scope, 'commissioning_present') ? 'Ja' : 'Nein/unklar'} />
          <DataRow label="Elektroarbeiten"    value={jBool(scope, 'electrical_work_present') ? 'Ja' : 'Nein/unklar'} />
          <DataRow label="Speicher/Puffer"    value={jBool(scope, 'buffer_or_storage_present') ? 'Ja' : 'Nein/unklar'} />
          <DataRow label="Demontage Altanlage" value={jBool(scope, 'demolition_old_heating_present') ? 'Ja' : 'Nein/unklar'} />
        </>
      )}
      {impl && (
        <DataRow label="Ausführungszeitraum" value={jBool(impl, 'present') ? 'Vorhanden' : 'Nicht erkennbar'} />
      )}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BzaPreparationSection({
  caseId,
  fundingCase,
  customer,
  documents,
  aiChecks,
  tasks,
  checklistItems,
  readiness,
}: {
  caseId: string;
  fundingCase: FundingCaseRow;
  customer: CustomerRow | null;
  documents: DocumentRow[];
  aiChecks: AICheckRow[];
  tasks: TaskRow[];
  checklistItems: ChecklistItem[];
  readiness: ReadinessSummary;
}) {
  const router = useRouter();

  const bza = computeBzaPreparation(checklistItems, readiness, documents, aiChecks);

  const contractRJ = bza.preferredContractCheck
    ? (() => {
        const r = bza.preferredContractCheck.result_json;
        return typeof r === 'object' && r !== null && !Array.isArray(r)
          ? (r as Record<string, unknown>)
          : null;
      })()
    : null;
  const offerRJ = bza.preferredOfferCheck
    ? (() => {
        const r = bza.preferredOfferCheck.result_json;
        return typeof r === 'object' && r !== null && !Array.isArray(r)
          ? (r as Record<string, unknown>)
          : null;
      })()
    : null;

  // Collapsible state (default: checks open if available, details closed)
  const [stammdatenOpen, setStammdatenOpen] = useState(false);
  const [heizungOpen,    setHeizungOpen]    = useState(false);
  const [vertragOpen,    setVertragOpen]    = useState(false);
  const [angebotOpen,    setAngebotOpen]    = useState(false);
  const [actionsOpen,    setActionsOpen]    = useState(false);

  // Clipboard
  const [copyOk, setCopyOk] = useState(false);

  function handleCopy() {
    const md = buildMarkdown(fundingCase, customer, checklistItems, bza, contractRJ, offerRJ);
    navigator.clipboard.writeText(md).then(() => {
      setCopyOk(true);
      setTimeout(() => setCopyOk(false), 2000);
    });
  }

  // Responsible party form
  const [rpState, rpFormAction] = useFormState<BzaResponsiblePartyState, FormData>(
    updateBzaResponsiblePartyAction,
    null,
  );
  const [rpValue, setRpValue] = useState(fundingCase.bza_responsible_party ?? 'unclear');
  useEffect(() => {
    setRpValue(fundingCase.bza_responsible_party ?? 'unclear');
  }, [fundingCase.bza_responsible_party]);
  useEffect(() => {
    if (rpState?.success) router.refresh();
  }, [rpState?.success, router]);

  // Create tasks form
  const [tasksState, tasksFormAction] = useFormState<BzaTasksState, FormData>(
    createBzaTasksAction,
    null,
  );
  useEffect(() => {
    if (tasksState?.created !== undefined) router.refresh();
  }, [tasksState?.created, router]);

  // Computed display values
  const openTaskCount = tasks.filter((t) => !t.completed).length;
  const beforeAppItems = checklistItems.filter((i) => i.phase === 'before_application' && i.required);
  const statusCfg = BZA_STATUS_CONFIG[bza.readinessStatus];
  const errorCount   = bza.warnings.filter((w) => w.level === 'error').length;
  const warnCount    = bza.warnings.filter((w) => w.level === 'warning').length;
  const warningColor = errorCount > 0 ? 'text-red-700 dark:text-red-400' : warnCount > 0 ? 'text-yellow-700 dark:text-yellow-500' : 'text-green-700 dark:text-green-400';

  return (
    <div className="space-y-4">
      {/* ── Disclaimer ── */}
      <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 rounded-md px-2.5 py-1.5">
        Internes Vorbereitungsblatt · keine Fördergarantie · keine automatische KfW-Antragstellung · manuelle Prüfung erforderlich
      </p>

      {/* ── Summary grid ── */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-md bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 px-2.5 py-2 text-center">
          <p className={`text-lg font-bold leading-none ${readiness.reviewed_count === readiness.total_required_before_app ? 'text-green-700 dark:text-green-400' : 'text-yellow-700 dark:text-yellow-500'}`}>
            {readiness.reviewed_count}/{readiness.total_required_before_app}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Unterlagen</p>
        </div>
        <div className="rounded-md bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 px-2.5 py-2 text-center">
          <p className={`text-lg font-bold leading-none ${openTaskCount === 0 ? 'text-green-700 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
            {openTaskCount}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Aufgaben offen</p>
        </div>
        <div className="rounded-md bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 px-2.5 py-2 text-center">
          <p className={`text-lg font-bold leading-none ${warningColor}`}>
            {bza.warnings.length}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Hinweise</p>
        </div>
      </div>

      <div className="space-y-4">

        {/* ── Warnings ── */}
        {bza.warnings.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
              Offene Punkte
            </p>
            {bza.warnings.map((w, i) => (
              <div
                key={i}
                className={`flex items-start gap-1.5 rounded-md px-2.5 py-1.5 text-xs ${
                  w.level === 'error'
                    ? 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300'
                    : w.level === 'warning'
                    ? 'bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300'
                    : 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                }`}
              >
                {w.level === 'error'
                  ? <XCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                  : w.level === 'warning'
                  ? <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                  : <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />}
                {w.message}
              </div>
            ))}
          </div>
        )}

        {/* ── Document status ── */}
        <div>
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">
            Pflichtunterlagen (vor Antragstellung)
          </p>
          <div className="space-y-1">
            {beforeAppItems.map((item) => {
              const cfg = DOC_STATUS_CFG[item.status] ?? DOC_STATUS_CFG.missing;
              return (
                <div key={item.document_type} className="flex items-center gap-2 text-xs">
                  {cfg.icon}
                  <span className="text-gray-700 dark:text-gray-300 min-w-0 flex-1 truncate">
                    {item.label_de}
                    {item.latest_filename && (
                      <span className="text-gray-400 dark:text-gray-500 ml-1">· {item.latest_filename}</span>
                    )}
                  </span>
                  <span className={`flex-shrink-0 font-medium ${cfg.cls}`}>{cfg.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Stammdaten (collapsible) ── */}
        <div>
          <SectionToggle
            title="Stammdaten & Objekt"
            open={stammdatenOpen}
            onToggle={() => setStammdatenOpen((v) => !v)}
          />
          {stammdatenOpen && (
            <div className="mt-2 rounded-md bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 p-2.5 space-y-0.5">
              {customer && (
                <>
                  <DataRow label="Kunde"         value={`${customer.first_name} ${customer.last_name}`} />
                  <DataRow label="E-Mail"         value={customer.email} />
                  <DataRow label="Telefon"        value={customer.phone} />
                  <DataRow label="Rechnungsadr."  value={`${customer.street}, ${customer.postal_code} ${customer.city}`} />
                </>
              )}
              <DataRow
                label="Projektadresse"
                value={
                  fundingCase.project_address_street
                    ? `${fundingCase.project_address_street}, ${fundingCase.project_address_postal_code ?? ''} ${fundingCase.project_address_city ?? ''}`.trim()
                    : null
                }
              />
              <DataRow label="Gebäudetyp"    value={fundingCase.building_type ? BUILDING_TYPE_LABELS[fundingCase.building_type] : null} />
              <DataRow label="Wohneinheiten" value={fundingCase.housing_units != null ? String(fundingCase.housing_units) : null} />
              <DataRow label="Eigentümer"    value={fundingCase.owner_status ? OWNER_STATUS_LABELS[fundingCase.owner_status] : null} />
              <DataRow label="Selbst bewohnt" value={fundingCase.self_occupied != null ? (fundingCase.self_occupied ? 'Ja' : 'Nein') : null} />
              <DataRow label="Notizen"       value={fundingCase.notes} />
            </div>
          )}
        </div>

        {/* ── Heizungsanlage (collapsible) ── */}
        <div>
          <SectionToggle
            title="Heizungsanlage"
            open={heizungOpen}
            onToggle={() => setHeizungOpen((v) => !v)}
          />
          {heizungOpen && (
            <div className="mt-2 rounded-md bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 p-2.5 space-y-0.5">
              <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Bestandsanlage</p>
              <DataRow label="Typ"    value={fundingCase.current_heating_type ? CURRENT_HEATING_TYPE_LABELS[fundingCase.current_heating_type] : null} />
              <DataRow label="Baujahr" value={fundingCase.current_heating_year ? String(fundingCase.current_heating_year) : null} />

              <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mt-3 mb-1">Geplante Anlage</p>
              <DataRow label="Typ (Akte)" value={fundingCase.planned_heating_type ? PLANNED_HEATING_TYPE_LABELS[fundingCase.planned_heating_type] : null} />
              <DataRow label="Modell (Akte)" value={fundingCase.planned_heat_pump_model} />
              {offerRJ && (() => {
                const hp  = jObj(offerRJ, 'heat_pump');
                const mfr = jStr(hp, 'manufacturer');
                const mdl = jStr(hp, 'model');
                const v   = [mfr, mdl].filter(Boolean).join(' ') || null;
                return <DataRow label="Modell (Angebot)" value={v} />;
              })()}
              <DataRow label="Geschätzte Kosten (Akte)" value={fundingCase.estimated_cost != null ? `${fundingCase.estimated_cost.toLocaleString('de-DE')} €` : null} />
              {offerRJ && (() => {
                const c   = jObj(offerRJ, 'costs');
                const net = jStr(c, 'net_amount');
                const grs = jStr(c, 'gross_amount');
                const vat = jStr(c, 'vat_rate');
                return (
                  <>
                    <DataRow label="Netto (Angebot)"  value={net} />
                    <DataRow label="Brutto (Angebot)" value={grs} />
                    <DataRow label="MwSt."            value={vat} />
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* ── Contract check (collapsible) ── */}
        {bza.preferredContractCheck && (
          <div>
            <SectionToggle
              title="Vertragsprüfung"
              open={vertragOpen}
              onToggle={() => setVertragOpen((v) => !v)}
              badge={
                <span className={`ml-1 text-xs ${bza.preferredContractCheck.human_review_status === 'approved' ? 'text-green-600 dark:text-green-400' : bza.preferredContractCheck.human_review_status === 'rejected' ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-500'}`}>
                  {bza.preferredContractCheck.human_review_status === 'approved' ? '· Freigegeben' : bza.preferredContractCheck.human_review_status === 'rejected' ? '· Abgelehnt' : '· Ausstehend'}
                </span>
              }
            />
            {vertragOpen && (
              <div className="mt-2 rounded-md bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 p-2.5 space-y-0.5">
                <DataRow
                  label="Freigabestatus"
                  value={bza.preferredContractCheck.human_review_status === 'approved' ? 'Freigegeben' : bza.preferredContractCheck.human_review_status === 'rejected' ? 'Abgelehnt' : 'Ausstehend'}
                />
                <CheckSummaryRows rj={contractRJ} isContract />
              </div>
            )}
          </div>
        )}

        {/* ── Offer check (collapsible) ── */}
        {bza.preferredOfferCheck && (
          <div>
            <SectionToggle
              title="Angebotsprüfung"
              open={angebotOpen}
              onToggle={() => setAngebotOpen((v) => !v)}
              badge={
                <span className={`ml-1 text-xs ${bza.preferredOfferCheck.human_review_status === 'approved' ? 'text-green-600 dark:text-green-400' : bza.preferredOfferCheck.human_review_status === 'rejected' ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-500'}`}>
                  {bza.preferredOfferCheck.human_review_status === 'approved' ? '· Freigegeben' : bza.preferredOfferCheck.human_review_status === 'rejected' ? '· Abgelehnt' : '· Ausstehend'}
                </span>
              }
            />
            {angebotOpen && (
              <div className="mt-2 rounded-md bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 p-2.5 space-y-0.5">
                <DataRow
                  label="Freigabestatus"
                  value={bza.preferredOfferCheck.human_review_status === 'approved' ? 'Freigegeben' : bza.preferredOfferCheck.human_review_status === 'rejected' ? 'Abgelehnt' : 'Ausstehend'}
                />
                <CheckSummaryRows rj={offerRJ} isContract={false} />
              </div>
            )}
          </div>
        )}

        {/* ── BzA-Verantwortlicher ── */}
        <div>
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">
            BzA wird erstellt durch
          </p>
          <form action={rpFormAction} className="flex items-center gap-2">
            <input type="hidden" name="case_id" value={caseId} />
            <select
              name="bza_responsible_party"
              value={rpValue}
              onChange={(e) => setRpValue(e.target.value)}
              className="text-xs rounded border border-gray-200 dark:border-gray-700 px-2 py-0.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-400 flex-1"
            >
              {BZA_RESPONSIBLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <SaveButton />
          </form>
          {rpState?.error && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{rpState.error}</p>
          )}
        </div>

        {/* ── Actions (collapsible) ── */}
        <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
          <SectionToggle
            title="Weitere Aktionen"
            open={actionsOpen}
            onToggle={() => setActionsOpen((v) => !v)}
          />
          {actionsOpen && (
            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => router.refresh()}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Aktualisieren
                </button>

                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  {copyOk
                    ? <><CheckCircle className="h-3.5 w-3.5 text-green-600" /><span className="text-green-700 dark:text-green-400">Kopiert!</span></>
                    : <><Copy className="h-3.5 w-3.5" />Als Markdown kopieren</>
                  }
                </button>

                <form action={tasksFormAction}>
                  <input type="hidden" name="case_id" value={caseId} />
                  <CreateTasksButton />
                </form>
              </div>

              {tasksState?.created !== undefined && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {tasksState.created === 0
                    ? 'Alle BzA-Aufgaben bereits vorhanden.'
                    : `${tasksState.created} Aufgabe${tasksState.created !== 1 ? 'n' : ''} erstellt${tasksState.skipped ? ` · ${tasksState.skipped} bereits vorhanden` : ''}.`
                  }
                </p>
              )}
              {tasksState?.error && (
                <p className="text-xs text-red-600 dark:text-red-400">{tasksState.error}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
