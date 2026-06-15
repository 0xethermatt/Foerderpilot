import type { Database } from '@/lib/supabase/database.types';
import {
  computeChecklist,
  computeReadiness,
  type ChecklistItem,
  type ReadinessSummary,
} from '@/lib/documents/checklist';
import { computeKfwApplicationPreparationState } from '@/lib/kfw/application-preparation';
import { computeKfwProofSubmissionState, isBndIdPlausible } from '@/lib/kfw/proof-submission';
import { isBzaIdPlausible } from '@/lib/kfw/application-preparation';
import {
  BUILDING_TYPE_LABELS,
  OWNER_STATUS_LABELS,
  CURRENT_HEATING_TYPE_LABELS,
  PLANNED_HEATING_TYPE_LABELS,
  DOCUMENT_STATUS_LABELS,
  STATUS_OPTIONS,
} from '@/lib/constants/form-options';

type FundingCaseRow = Database['public']['Tables']['funding_cases']['Row'];
type CustomerRow    = Database['public']['Tables']['customers']['Row'];
type DocumentRow    = Database['public']['Tables']['documents']['Row'];
type TaskRow        = Database['public']['Tables']['tasks']['Row'];
type AICheckRow     = Database['public']['Tables']['ai_checks']['Row'];

// ─── Export types ──────────────────────────────────────────────────────────────

export interface DocumentExportRow {
  type_label: string;
  filename: string | null;
  status_label: string;
  uploaded_at: string | null;
  reviewed: boolean;
  rejected: boolean;
}

export interface AICheckExportSummary {
  check_type: string;
  created_at: string;
  provider: string | null;
  model: string | null;
  result_label: string;
  risk_label: string;
  confidence: string | null;
  human_review_status: string;
  summary_de: string;
  key_findings: string[];
  recommended_next_steps: string[];
}

export interface TaskExportRow {
  title: string;
  priority: string;
  due_date: string | null;
  completed: boolean;
}

export interface FundingCaseExportData {
  generated_at: string;
  case_summary: {
    title: string;
    customer_name: string;
    project_address: string;
    status: string;
    risk_level: string;
    readiness_label: string;
    current_workflow_step: string;
    next_action: string;
  };
  customer: {
    name: string;
    email: string | null;
    phone: string | null;
    billing_address: string | null;
    project_address: string | null;
  };
  building: {
    building_type: string | null;
    residential_units: number | null;
    owner_occupied: boolean | null;
    owner_type: string | null;
  };
  heating: {
    existing_heating_type: string | null;
    existing_heating_year: string | null;
    planned_heat_pump_type: string | null;
    planned_model: string | null;
    estimated_costs: string | null;
  };
  documents: {
    before_application: DocumentExportRow[];
    after_approval: DocumentExportRow[];
    after_implementation: DocumentExportRow[];
  };
  ai_checks: {
    funding_precheck_latest: AICheckExportSummary | null;
    contract_check_latest: AICheckExportSummary | null;
    offer_check_latest: AICheckExportSummary | null;
  };
  bza: {
    responsible_party: string | null;
    bza_status: string | null;
    bza_id: string | null;
    bza_created_at: string | null;
    bza_document_status: string | null;
  };
  kfw_application: {
    status: string | null;
    prepared_at: string | null;
    reference: string | null;
    customer_submitted: boolean;
    approval_received: boolean;
    approval_document_status: string | null;
  };
  implementation_and_proofs: {
    implementation_status: string | null;
    implementation_started_at: string | null;
    implementation_completed_at: string | null;
    invoice_status: string | null;
    bnd_id: string | null;
    bnd_created_at: string | null;
    bnd_document_status: string | null;
    proof_submission_status: string | null;
    proof_submitted_at: string | null;
    payout_status: string | null;
  };
  open_tasks: TaskExportRow[];
  completed_tasks: TaskExportRow[];
  warnings: string[];
  blockers: string[];
}

// ─── Static label maps ────────────────────────────────────────────────────────

const STATUS_LABEL_MAP: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map(({ value, label }) => [value, label]),
);

const RISK_LABELS: Record<string, string> = {
  green: 'Grün (gering)',
  yellow: 'Gelb (mittel)',
  red: 'Rot (hoch)',
};

const BZA_STATUS_LABELS: Record<string, string> = {
  not_started: 'Noch nicht angefordert',
  requested:   'Angefordert',
  created:     'Erstellt',
};

const KFW_STATUS_LABELS: Record<string, string> = {
  not_started: 'Noch nicht begonnen',
  prepared:    'Vorbereitet',
  submitted:   'Eingereicht (Antrag durch Kunden)',
  approved:    'Förderzusage erhalten',
};

const IMPL_STATUS_LABELS: Record<string, string> = {
  not_started: 'Nicht begonnen',
  started:     'Gestartet',
  completed:   'Abgeschlossen',
};

const PROOF_STATUS_LABELS: Record<string, string> = {
  not_started: 'Nicht begonnen',
  prepared:    'Vorbereitet',
  submitted:   'Eingereicht',
};

const PAYOUT_STATUS_LABELS: Record<string, string> = {
  pending: 'Ausstehend',
  paid:    'Eingegangen',
};

const RESPONSIBLE_LABELS: Record<string, string> = {
  specialist_company: 'Qualifiziertes Fachunternehmen',
  energy_expert:      'Energieeffizienz-Experte',
  unclear:            'Noch nicht festgelegt',
};

const PRIORITY_LABELS: Record<string, string> = {
  low:    'Niedrig',
  normal: 'Normal',
  high:   'Hoch',
};

const AI_ASSESSMENT_LABELS: Record<string, string> = {
  likely_eligible: 'Wahrscheinlich förderfähig',
  unclear:         'Unklar',
  critical:        'Kritisch',
  pass:            'Bestanden',
  needs_revision:  'Überarbeitung nötig',
};

const AI_HR_STATUS_LABELS: Record<string, string> = {
  pending:  'Ausstehend',
  approved: 'Genehmigt',
  rejected: 'Abgelehnt',
};

const CONFIDENCE_LABELS: Record<string, string> = {
  low:    'Gering',
  medium: 'Mittel',
  high:   'Hoch',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, currency = 'EUR'): string | null {
  if (n == null) return null;
  return new Intl.NumberFormat('de-DE', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function docStatusLabel(s: string | null): string {
  if (!s) return 'Fehlend';
  return DOCUMENT_STATUS_LABELS[s] ?? s;
}

function docRowsForPhase(
  phase: 'before_application' | 'after_approval' | 'after_completion',
  checklistItems: ChecklistItem[],
  documentsByType: Record<string, DocumentRow[]>,
): DocumentExportRow[] {
  return checklistItems
    .filter((i) => i.phase === phase)
    .map((item) => {
      const latest = (documentsByType[item.document_type] ?? [])[0] ?? null;
      return {
        type_label:  item.label_de,
        filename:    item.latest_filename ?? null,
        status_label: docStatusLabel(latest?.status ?? null),
        uploaded_at: latest ? fmtDate(latest.uploaded_at) : null,
        reviewed:    item.status === 'reviewed',
        rejected:    item.status === 'rejected',
      };
    });
}

// Safely extract fields from ai_checks.result_json (JSONB / Json type)
type AnyJson = Record<string, unknown>;

function parseAICheck(check: AICheckRow): AICheckExportSummary {
  const r = (check.result_json as AnyJson) ?? {};

  const summary_de     = (r.summary_de as string | undefined) ?? check.summary ?? '–';
  const overall        = r.overall_assessment as string | undefined;
  const result_label   = overall ? (AI_ASSESSMENT_LABELS[overall] ?? overall) : '–';
  const risk_label     = check.risk_level ? (RISK_LABELS[check.risk_level] ?? check.risk_level) : '–';
  const confidence     = check.confidence ? (CONFIDENCE_LABELS[check.confidence] ?? check.confidence) : null;
  const hr_status      = AI_HR_STATUS_LABELS[check.human_review_status] ?? check.human_review_status;

  // Key findings – unify across check types
  const key_findings: string[] = [];
  const blockingItems   = r.blocking_items as string[] | undefined;
  const criticalFindings = r.critical_findings as string[] | undefined;
  const missingItems    = r.missing_or_unclear_items as string[] | undefined;
  const detectedRisks   = r.detected_risks as Array<{ risk_de?: string }> | undefined;

  for (const f of (criticalFindings ?? blockingItems ?? []).slice(0, 5)) {
    if (typeof f === 'string' && f) key_findings.push(f);
  }
  if (key_findings.length === 0 && detectedRisks) {
    for (const risk of detectedRisks.slice(0, 3)) {
      if (risk.risk_de) key_findings.push(risk.risk_de);
    }
  }
  if (key_findings.length === 0 && missingItems) {
    for (const item of missingItems.slice(0, 3)) {
      if (typeof item === 'string') key_findings.push(item);
    }
  }

  const recommended_next_steps = ((r.recommended_next_steps as string[] | undefined) ?? []).slice(0, 5);

  return {
    check_type:          check.check_type,
    created_at:          fmtDate(check.created_at) ?? check.created_at,
    provider:            check.provider,
    model:               check.model,
    result_label,
    risk_label,
    confidence,
    human_review_status: hr_status,
    summary_de,
    key_findings,
    recommended_next_steps,
  };
}

function latestCheck(checks: AICheckRow[], type: string): AICheckExportSummary | null {
  const latest = checks
    .filter((c) => c.check_type === type && c.status === 'completed')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  return latest ? parseAICheck(latest) : null;
}

function deriveWorkflowStep(
  readiness: ReadinessSummary,
  fundingCase: FundingCaseRow,
): string {
  const kfwStatus   = fundingCase.kfw_application_status ?? 'not_started';
  const implStatus  = fundingCase.implementation_status ?? 'not_started';
  const proofStatus = fundingCase.proof_submission_status ?? 'not_started';
  const payout      = fundingCase.payout_status ?? 'pending';

  if (payout === 'paid') return 'Auszahlung';
  if (proofStatus === 'submitted') return 'Nachweiseinreichung abgeschlossen';
  if (proofStatus === 'prepared') return 'Nachweise vorbereitet';
  if (implStatus === 'completed') return 'Umsetzung abgeschlossen';
  if (implStatus === 'started') return 'Umsetzung läuft';
  if (kfwStatus === 'approved') return 'KfW-Zusage erhalten';
  if (kfwStatus === 'submitted') return 'Antrag eingereicht – Warte auf KfW-Zusage';
  if (kfwStatus === 'prepared') return 'KfW-Antrag vorbereitet';
  if (readiness.blocking_count === 0 && readiness.needs_review_count === 0) return 'BzA/Antragsvorbereitung';
  if (readiness.blocking_count === 0) return 'Dokumentenprüfung';
  return 'Unterlagensammlung';
}

function deriveNextAction(
  checklistItems: ChecklistItem[],
  readiness: ReadinessSummary,
  fundingCase: FundingCaseRow,
): string {
  const kfwStatus   = fundingCase.kfw_application_status ?? 'not_started';
  const bzaStatus   = fundingCase.bza_status ?? 'not_started';
  const implStatus  = fundingCase.implementation_status ?? 'not_started';
  const proofStatus = fundingCase.proof_submission_status ?? 'not_started';
  const payout      = fundingCase.payout_status ?? 'pending';

  if (payout === 'paid') return 'Fall archivieren / abschließen';
  if (proofStatus === 'submitted') return 'Auf KfW-Auszahlung warten';
  if (proofStatus === 'prepared') return 'Nachweise durch Kunden in „Meine KfW" einreichen lassen';
  if (isBndIdPlausible(fundingCase.bnd_id)) return 'Nachweise intern vorbereiten';
  if (implStatus === 'completed') return 'BnD-ID eintragen';
  if (implStatus === 'started') return 'Umsetzung abwarten – BnD anfordern';
  if (kfwStatus === 'approved') return 'Umsetzung starten';
  if (kfwStatus === 'submitted') return 'Auf KfW-Förderzusage warten – kein Vorhabenbeginn';
  if (kfwStatus === 'prepared') return 'Kundenanweisung senden – Antrag durch Kunden in „Meine KfW" einreichen lassen';
  if (isBzaIdPlausible(fundingCase.bza_id)) {
    if (kfwStatus === 'not_started') return 'KfW-Antrag intern vorbereiten';
  }
  if (bzaStatus === 'created') return 'BzA-ID eintragen';
  if (bzaStatus === 'requested') return 'BzA-ID vom Fachunternehmen eintragen sobald vorhanden';

  if (readiness.blocking_count > 0) {
    const missing = checklistItems.filter((i) => i.phase === 'before_application' && i.required && (i.status === 'missing' || i.status === 'rejected'));
    return `${missing.length} Pflichtunterlage${missing.length !== 1 ? 'n' : ''} hochladen / korrigieren`;
  }
  if (readiness.needs_review_count > 0) return 'Unterlagen prüfen und freigeben';

  return 'BzA beim Fachunternehmen anfordern';
}

function buildWarnings(
  checklistItems: ChecklistItem[],
  readiness: ReadinessSummary,
  aiChecks: AICheckRow[],
  fundingCase: FundingCaseRow,
): { blockers: string[]; warnings: string[] } {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Missing/rejected docs → blockers
  for (const item of checklistItems.filter((i) => i.blocking)) {
    blockers.push(
      item.status === 'rejected'
        ? `${item.label_de} wurde abgelehnt – bitte korrigieren und neu hochladen`
        : `${item.label_de} fehlt`,
    );
  }

  // Docs needing review → warnings
  const needsReview = checklistItems.filter(
    (i) => i.phase === 'before_application' && i.required && i.status === 'needs_review',
  );
  if (needsReview.length > 0) {
    warnings.push(
      `${needsReview.length} Dokument${needsReview.length !== 1 ? 'e warten' : ' wartet'} auf Prüfung: ${needsReview.map((i) => i.label_de).join(', ')}`,
    );
  }

  // AI checks with pending human review → warnings
  const pendingAI = aiChecks.filter(
    (c) => c.status === 'completed' && c.human_review_status === 'pending',
  );
  if (pendingAI.length > 0) {
    warnings.push(`${pendingAI.length} KI-Prüfung${pendingAI.length !== 1 ? 'en warten' : ' wartet'} auf Freigabe`);
  }

  // Red AI checks
  const redAI = aiChecks.filter((c) => c.risk_level === 'red' && c.status === 'completed');
  if (redAI.length > 0) {
    warnings.push(`${redAI.length} KI-Prüfung${redAI.length !== 1 ? 'en' : ''} mit rotem Risiko – manuelle Prüfung dringend erforderlich`);
  }

  // BzA-ID plausibility
  if (fundingCase.bza_status === 'created' && !isBzaIdPlausible(fundingCase.bza_id)) {
    warnings.push('BzA als erstellt markiert, aber BzA-ID fehlt oder hat kein gültiges Format (15 Ziffern erwartet)');
  }

  // KfW submitted but no approval yet
  if (fundingCase.kfw_application_status === 'submitted') {
    warnings.push('Kein Vorhabenbeginn vor schriftlicher KfW-Förderzusage!');
  }

  return { blockers, warnings };
}

// ─── Main builder ──────────────────────────────────────────────────────────────

export function buildFundingCaseExportData(params: {
  fundingCase: FundingCaseRow;
  customer: CustomerRow | null;
  documents: DocumentRow[];
  tasks: TaskRow[];
  aiChecks: AICheckRow[];
}): FundingCaseExportData {
  const { fundingCase, customer, documents, tasks, aiChecks } = params;

  const checklistItems = computeChecklist(documents);
  const readiness      = computeReadiness(checklistItems);

  // Group documents by type (latest first)
  const docsByType: Record<string, DocumentRow[]> = {};
  for (const doc of documents) {
    (docsByType[doc.type] ??= []).push(doc);
  }
  for (const docs of Object.values(docsByType)) {
    docs.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
  }

  // Customer info
  const customerName = customer ? `${customer.first_name} ${customer.last_name}` : '–';
  const billingAddress = customer
    ? `${customer.street}, ${customer.postal_code} ${customer.city}`
    : null;
  const projectAddress = [
    fundingCase.project_address_street,
    fundingCase.project_address_postal_code && fundingCase.project_address_city
      ? `${fundingCase.project_address_postal_code} ${fundingCase.project_address_city}`
      : fundingCase.project_address_city ?? fundingCase.project_address_postal_code,
  ].filter(Boolean).join(', ') || null;

  // Tasks split
  const openTasks = tasks
    .filter((t) => !t.completed)
    .sort((a, b) => {
      const prio: Record<string, number> = { high: 0, normal: 1, low: 2 };
      return (prio[a.priority] ?? 1) - (prio[b.priority] ?? 1);
    })
    .map((t) => ({
      title:    t.title,
      priority: PRIORITY_LABELS[t.priority] ?? t.priority,
      due_date: fmtDate(t.due_date),
      completed: false,
    }));

  const completedTasks = tasks
    .filter((t) => t.completed)
    .map((t) => ({
      title:    t.title,
      priority: PRIORITY_LABELS[t.priority] ?? t.priority,
      due_date: fmtDate(t.due_date),
      completed: true,
    }));

  // BzA document status (look at the 'bza' document)
  const bzaDoc = (docsByType['bza'] ?? [])[0];
  const kfwApprovalDoc = (docsByType['kfw_approval'] ?? [])[0];
  const invoiceDoc = (docsByType['invoice'] ?? [])[0];
  const bndDoc = (docsByType['bnd'] ?? [])[0];

  const { blockers, warnings } = buildWarnings(checklistItems, readiness, aiChecks, fundingCase);

  return {
    generated_at: new Date().toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }),

    case_summary: {
      title:                 fundingCase.title,
      customer_name:         customerName,
      project_address:       projectAddress ?? '–',
      status:                STATUS_LABEL_MAP[fundingCase.status] ?? fundingCase.status,
      risk_level:            RISK_LABELS[fundingCase.risk_level] ?? fundingCase.risk_level,
      readiness_label:       readiness.label_de,
      current_workflow_step: deriveWorkflowStep(readiness, fundingCase),
      next_action:           deriveNextAction(checklistItems, readiness, fundingCase),
    },

    customer: {
      name:            customerName,
      email:           customer?.email ?? null,
      phone:           customer?.phone ?? null,
      billing_address: billingAddress,
      project_address: projectAddress,
    },

    building: {
      building_type:     fundingCase.building_type ? (BUILDING_TYPE_LABELS[fundingCase.building_type] ?? fundingCase.building_type) : null,
      residential_units: fundingCase.housing_units ?? null,
      owner_occupied:    fundingCase.self_occupied ?? null,
      owner_type:        fundingCase.owner_status ? (OWNER_STATUS_LABELS[fundingCase.owner_status] ?? fundingCase.owner_status) : null,
    },

    heating: {
      existing_heating_type: fundingCase.current_heating_type
        ? (CURRENT_HEATING_TYPE_LABELS[fundingCase.current_heating_type] ?? fundingCase.current_heating_type)
        : null,
      existing_heating_year: fundingCase.current_heating_year != null ? String(fundingCase.current_heating_year) : null,
      planned_heat_pump_type: fundingCase.planned_heating_type
        ? (PLANNED_HEATING_TYPE_LABELS[fundingCase.planned_heating_type] ?? fundingCase.planned_heating_type)
        : null,
      planned_model:   fundingCase.planned_heat_pump_model ?? null,
      estimated_costs: fmt(fundingCase.estimated_cost),
    },

    documents: {
      before_application: docRowsForPhase('before_application', checklistItems, docsByType),
      after_approval:     docRowsForPhase('after_approval', checklistItems, docsByType),
      after_implementation: docRowsForPhase('after_completion', checklistItems, docsByType),
    },

    ai_checks: {
      funding_precheck_latest: latestCheck(aiChecks, 'funding_precheck'),
      contract_check_latest:   latestCheck(aiChecks, 'contract_check'),
      offer_check_latest:      latestCheck(aiChecks, 'offer_check'),
    },

    bza: {
      responsible_party: fundingCase.bza_responsible_party
        ? (RESPONSIBLE_LABELS[fundingCase.bza_responsible_party] ?? fundingCase.bza_responsible_party)
        : null,
      bza_status:    BZA_STATUS_LABELS[fundingCase.bza_status ?? 'not_started'] ?? null,
      bza_id:        fundingCase.bza_id ?? null,
      bza_created_at: fmtDate(fundingCase.bza_created_at),
      bza_document_status: bzaDoc ? (DOCUMENT_STATUS_LABELS[bzaDoc.status] ?? bzaDoc.status) : 'Fehlend',
    },

    kfw_application: {
      status:        KFW_STATUS_LABELS[fundingCase.kfw_application_status ?? 'not_started'] ?? null,
      prepared_at:   fmtDate(fundingCase.kfw_application_prepared_at),
      reference:     fundingCase.kfw_application_reference ?? null,
      customer_submitted: (fundingCase.kfw_application_status === 'submitted' || fundingCase.kfw_application_status === 'approved'),
      approval_received: fundingCase.kfw_application_status === 'approved',
      approval_document_status: kfwApprovalDoc ? (DOCUMENT_STATUS_LABELS[kfwApprovalDoc.status] ?? kfwApprovalDoc.status) : 'Fehlend',
    },

    implementation_and_proofs: {
      implementation_status:      IMPL_STATUS_LABELS[fundingCase.implementation_status ?? 'not_started'] ?? null,
      implementation_started_at:  fmtDate(fundingCase.implementation_started_at),
      implementation_completed_at: fmtDate(fundingCase.implementation_completed_at),
      invoice_status:  invoiceDoc ? (DOCUMENT_STATUS_LABELS[invoiceDoc.status] ?? invoiceDoc.status) : 'Fehlend',
      bnd_id:          fundingCase.bnd_id ?? null,
      bnd_created_at:  fmtDate(fundingCase.bnd_created_at),
      bnd_document_status: bndDoc ? (DOCUMENT_STATUS_LABELS[bndDoc.status] ?? bndDoc.status) : 'Fehlend',
      proof_submission_status: PROOF_STATUS_LABELS[fundingCase.proof_submission_status ?? 'not_started'] ?? null,
      proof_submitted_at:  fmtDate(fundingCase.proof_submitted_at),
      payout_status:   PAYOUT_STATUS_LABELS[fundingCase.payout_status ?? 'pending'] ?? null,
    },

    open_tasks:      openTasks,
    completed_tasks: completedTasks,
    warnings,
    blockers,
  };
}
