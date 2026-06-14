import { notFound } from 'next/navigation';
import {
  Thermometer,
  Building2,
  User,
  MapPin,
  ShieldAlert,
  ClipboardCheck,
  CheckCircle2,
  Archive,
} from 'lucide-react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import StatusBadge from '@/components/ui/StatusBadge';
import RiskBadge from '@/components/ui/RiskBadge';
import StatusRiskEditor from './StatusRiskEditor';
import TasksSection from './TasksSection';
import AIChecksSection from './AIChecksSection';
import BzaPreparationSection from './BzaPreparationSection';
import KfwApplicationPreparationSection from './KfwApplicationPreparationSection';
import ProofSubmissionSection from './ProofSubmissionSection';
import FundingCaseExportSection from './FundingCaseExportSection';
import CaseCommandHeader from './CaseCommandHeader';
import CaseWorkflowStepper from './CaseWorkflowStepper';
import CaseWorkspace from './CaseWorkspace';
import CaseNextActionPanel from './CaseNextActionPanel';
import CompactDocumentsTable from './CompactDocumentsTable';
import CollapsibleCard from './CollapsibleCard';

import { computeChecklist, computeReadiness } from '@/lib/documents/checklist';
import { computeBzaPreparation } from '@/lib/bza/preparation';
import { computeKfwApplicationPreparationState } from '@/lib/kfw/application-preparation';
import { computeKfwProofSubmissionState } from '@/lib/kfw/proof-submission';
import type { Database } from '@/lib/supabase/database.types';
import { createServiceClient } from '@/lib/supabase/service-client';
import { isServiceRoleConfigured } from '@/lib/supabase/safe-client';
import type { FundingCaseStatus, RiskLevel } from '@/lib/types';
import {
  BUILDING_TYPE_LABELS,
  OWNER_STATUS_LABELS,
  CURRENT_HEATING_TYPE_LABELS,
  PLANNED_HEATING_TYPE_LABELS,
} from '@/lib/constants/form-options';

type FundingCaseRow = Database['public']['Tables']['funding_cases']['Row'];
type CustomerRow    = Database['public']['Tables']['customers']['Row'];
type TaskRow        = Database['public']['Tables']['tasks']['Row'];
type DocumentRow    = Database['public']['Tables']['documents']['Row'];
type AICheckRow     = Database['public']['Tables']['ai_checks']['Row'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(n?: number | null) {
  if (n == null) return '–';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
}

function DataRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-2 text-sm py-1.5 border-b border-gray-50 dark:border-gray-800 last:border-0">
      <span className="w-40 flex-shrink-0 text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-gray-900 dark:text-gray-100 break-words min-w-0">{value ?? '–'}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CaseDetailPage({
  params,
}: {
  params: { id: string };
}) {
  if (!isServiceRoleConfigured()) {
    return (
      <div className="max-w-2xl space-y-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="h-4 w-4" />
          Zurück
        </Link>
        <div className="rounded-md bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 px-4 py-4">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Supabase nicht konfiguriert</p>
          <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
            Bitte{' '}
            <code className="font-mono bg-yellow-100 dark:bg-yellow-900 rounded px-1">.env.local</code>{' '}
            mit{' '}
            <code className="font-mono bg-yellow-100 dark:bg-yellow-900 rounded px-1">NEXT_PUBLIC_SUPABASE_URL</code>{' '}
            und{' '}
            <code className="font-mono bg-yellow-100 dark:bg-yellow-900 rounded px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{' '}
            befüllen.
          </p>
        </div>
      </div>
    );
  }

  const supabase = createServiceClient();

  const { data: fundingCase, error } = await supabase
    .from('funding_cases')
    .select()
    .eq('id', params.id)
    .single<FundingCaseRow>();

  if (error || !fundingCase) notFound();

  const [
    { data: customer },
    { data: tasks },
    { data: documentsRaw },
    { data: aiChecksRaw },
  ] = await Promise.all([
    supabase.from('customers').select().eq('id', fundingCase.customer_id).single<CustomerRow>(),
    supabase
      .from('tasks')
      .select()
      .eq('funding_case_id', fundingCase.id)
      .order('completed', { ascending: true })
      .order('due_date', { ascending: true, nullsFirst: false })
      .returns<TaskRow[]>(),
    supabase
      .from('documents')
      .select()
      .eq('funding_case_id', fundingCase.id)
      .order('uploaded_at', { ascending: false })
      .returns<DocumentRow[]>(),
    supabase
      .from('ai_checks')
      .select()
      .eq('case_id', fundingCase.id)
      .order('created_at', { ascending: false })
      .returns<AICheckRow[]>(),
  ]);

  const documents = documentsRaw ?? [];
  const aiChecks  = aiChecksRaw  ?? [];
  const allTasks  = tasks ?? [];

  const checklistItems = computeChecklist(documents);
  const readiness      = computeReadiness(checklistItems);

  // Generate signed URLs for all documents
  const signedUrls: Record<string, string> = {};
  if (documents.length > 0) {
    const { data: urlData } = await supabase.storage
      .from('case-documents')
      .createSignedUrls(documents.map((d) => d.storage_path), 3600);
    if (urlData) {
      for (const item of urlData) {
        if (item.path && item.signedUrl) signedUrls[item.path] = item.signedUrl;
      }
    }
  }

  const openTaskCount       = allTasks.filter((t) => !t.completed).length;
  const bzaAutoOpen         = readiness.blocking_count === 0 && readiness.needs_review_count === 0;
  const hasPendingAIReview  = aiChecks.some(
    (c) => c.status === 'completed' && c.human_review_status === 'pending',
  );
  const bzaPrep    = computeBzaPreparation(checklistItems, readiness, documents, aiChecks);
  const kfwPrep    = computeKfwApplicationPreparationState(fundingCase, readiness);
  const kfwAutoOpen = kfwPrep.bzaStatus !== 'not_started' || kfwPrep.kfwApplicationStatus !== 'not_started';
  const proofPrep  = computeKfwProofSubmissionState(fundingCase);
  const proofSectionVisible = kfwPrep.kfwApplicationStatus === 'submitted' || kfwPrep.kfwApplicationStatus === 'approved';
  const proofAutoOpen = proofSectionVisible && proofPrep.currentStep !== 'waiting_for_approval';

  const projectAddress = [
    fundingCase.project_address_street,
    fundingCase.project_address_postal_code && fundingCase.project_address_city
      ? `${fundingCase.project_address_postal_code} ${fundingCase.project_address_city}`
      : fundingCase.project_address_city ?? fundingCase.project_address_postal_code,
  ].filter(Boolean).join(', ');

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* ── Command header ── */}
      <CaseCommandHeader
        fundingCase={fundingCase}
        customer={customer ?? null}
        tasks={allTasks}
        readiness={readiness}
      />

      {/* ── Workflow stepper ── */}
      <CaseWorkflowStepper
        readiness={readiness}
        status={fundingCase.status as FundingCaseStatus}
        bzaStatus={fundingCase.bza_status ?? 'not_started'}
        kfwApplicationStatus={fundingCase.kfw_application_status ?? 'not_started'}
        implementationStatus={fundingCase.implementation_status ?? 'not_started'}
        proofSubmissionStatus={fundingCase.proof_submission_status ?? 'not_started'}
        payoutStatus={fundingCase.payout_status ?? 'pending'}
      />

      {/* ── Main body grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* ───────── Left column ───────── */}
        <div className="lg:col-span-8 space-y-5">

          {/* Arbeitsbereich: context-aware current-step panel */}
          <CaseWorkspace
            caseId={fundingCase.id}
            checklistItems={checklistItems}
            readiness={readiness}
            documents={documents}
            aiChecks={aiChecks}
            fundingCase={fundingCase}
          />

          {/* Compact documents table */}
          <CompactDocumentsTable
            caseId={fundingCase.id}
            checklistItems={checklistItems}
            documents={documents}
            signedUrls={signedUrls}
            aiChecks={aiChecks}
          />

          {/* Tasks – open by default when there are open tasks */}
          <CollapsibleCard
            id="tasks"
            title="Aufgaben"
            defaultOpen={openTaskCount > 0}
            icon={<CheckCircle2 className="h-4 w-4" />}
            badge={
              openTaskCount > 0 ? (
                <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 text-xs font-semibold">
                  {openTaskCount}
                </span>
              ) : undefined
            }
          >
            <TasksSection caseId={fundingCase.id} initialTasks={allTasks} />
          </CollapsibleCard>

          {/* Customer data – collapsed */}
          <CollapsibleCard
            title="Kundendaten"
            defaultOpen={false}
            icon={<User className="h-4 w-4" />}
          >
            {customer ? (
              <>
                <DataRow label="Name" value={`${customer.first_name} ${customer.last_name}`} />
                <DataRow label="E-Mail" value={customer.email} />
                <DataRow label="Telefon" value={customer.phone} />
                <DataRow
                  label="Rechnungsadresse"
                  value={`${customer.street}, ${customer.postal_code} ${customer.city}`}
                />
              </>
            ) : (
              <p className="text-xs text-gray-400 dark:text-gray-500">Keine Kundendaten.</p>
            )}
          </CollapsibleCard>

          {/* Project & heating – collapsed */}
          <CollapsibleCard
            title="Projekt & Heizung"
            defaultOpen={false}
            icon={<Thermometer className="h-4 w-4" />}
          >
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2 mt-1">
              Projektadresse
            </p>
            <DataRow label="Adresse" value={projectAddress || null} />
            <DataRow
              label="Gebäudetyp"
              value={fundingCase.building_type ? BUILDING_TYPE_LABELS[fundingCase.building_type] : null}
            />
            <DataRow
              label="Wohneinheiten"
              value={fundingCase.housing_units != null ? String(fundingCase.housing_units) : null}
            />
            <DataRow
              label="Eigentümer"
              value={fundingCase.owner_status ? OWNER_STATUS_LABELS[fundingCase.owner_status] : null}
            />
            <DataRow
              label="Selbst bewohnt"
              value={
                fundingCase.self_occupied === true  ? 'Ja'  :
                fundingCase.self_occupied === false ? 'Nein' : null
              }
            />

            <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mt-4 mb-2">
              Bestehende Heizung
            </p>
            <DataRow
              label="Heizungstyp"
              value={fundingCase.current_heating_type ? CURRENT_HEATING_TYPE_LABELS[fundingCase.current_heating_type] : null}
            />
            <DataRow
              label="Baujahr"
              value={fundingCase.current_heating_year != null ? String(fundingCase.current_heating_year) : null}
            />

            <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mt-4 mb-2">
              Geplante Heizung
            </p>
            <DataRow
              label="Wärmepumpentyp"
              value={fundingCase.planned_heating_type ? PLANNED_HEATING_TYPE_LABELS[fundingCase.planned_heating_type] : null}
            />
            <DataRow label="Modell" value={fundingCase.planned_heat_pump_model} />
            <DataRow label="Geschätzte Kosten" value={formatCurrency(fundingCase.estimated_cost)} />
            <DataRow label="Förderbetrag" value={formatCurrency(fundingCase.funding_amount)} />

            {fundingCase.notes && (
              <>
                <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mt-4 mb-2">
                  Notizen
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {fundingCase.notes}
                </p>
              </>
            )}
          </CollapsibleCard>

          {/* AI checks – auto-opens when a review is pending */}
          <CollapsibleCard
            id="ai-checks"
            title="KI-Prüfungen"
            defaultOpen={hasPendingAIReview}
            icon={<ShieldAlert className="h-4 w-4" />}
            badge={
              hasPendingAIReview ? (
                <span className="text-xs font-medium text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950 rounded-full px-1.5 py-0.5">
                  Prüfung offen
                </span>
              ) : aiChecks.length > 0 ? (
                <span className="text-xs text-gray-400 dark:text-gray-500">{aiChecks.length}</span>
              ) : undefined
            }
          >
            <AIChecksSection
              caseId={fundingCase.id}
              initialChecks={aiChecks}
              readiness={readiness}
            />
          </CollapsibleCard>

          {/* BzA preparation – auto-opens when docs are complete */}
          <CollapsibleCard
            id="bza-preparation"
            title="BzA-Vorbereitung"
            defaultOpen={bzaAutoOpen}
            icon={<ClipboardCheck className="h-4 w-4" />}
            badge={
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                bzaPrep.readinessStatus === 'bereit'
                  ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                  : bzaPrep.readinessStatus === 'fast_bereit'
                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300'
                  : 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300'
              }`}>
                {bzaPrep.readinessStatus === 'bereit'
                  ? 'Bereit'
                  : bzaPrep.readinessStatus === 'fast_bereit'
                  ? 'Fast bereit'
                  : 'Nicht bereit'}
              </span>
            }
          >
            <BzaPreparationSection
              caseId={fundingCase.id}
              fundingCase={fundingCase}
              customer={customer ?? null}
              documents={documents}
              aiChecks={aiChecks}
              tasks={allTasks}
              checklistItems={checklistItems}
              readiness={readiness}
            />
          </CollapsibleCard>

          {/* KfW application preparation – auto-opens once BzA process started */}
          <CollapsibleCard
            id="kfw-application"
            title="KfW-Antragsvorbereitung"
            defaultOpen={kfwAutoOpen}
            icon={<ClipboardCheck className="h-4 w-4" />}
            badge={
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                kfwPrep.kfwApplicationStatus === 'approved'  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                : kfwPrep.kfwApplicationStatus === 'submitted' ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                : kfwPrep.kfwApplicationStatus === 'prepared'  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300'
                : kfwPrep.bzaStatus === 'created'             ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                : kfwPrep.bzaStatus === 'requested'           ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
              }`}>
                {kfwPrep.kfwApplicationStatus === 'approved'  ? 'Förderzusage erhalten'
                  : kfwPrep.kfwApplicationStatus === 'submitted' ? 'Antrag eingereicht'
                  : kfwPrep.kfwApplicationStatus === 'prepared'  ? 'Vorbereitet'
                  : kfwPrep.bzaStatus === 'created'             ? 'BzA erstellt'
                  : kfwPrep.bzaStatus === 'requested'           ? 'BzA angefordert'
                  : 'Nicht begonnen'}
              </span>
            }
          >
            <KfwApplicationPreparationSection
              caseId={fundingCase.id}
              fundingCase={fundingCase}
              customer={customer ?? null}
              readiness={readiness}
            />
          </CollapsibleCard>

          {/* Proof submission – visible once KfW application is submitted */}
          {proofSectionVisible && (
            <CollapsibleCard
              id="proof-submission"
              title="Nachweisphase"
              defaultOpen={proofAutoOpen}
              icon={<ClipboardCheck className="h-4 w-4" />}
              badge={
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  proofPrep.payoutStatus === 'paid'                         ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                  : proofPrep.proofSubmissionStatus === 'submitted'         ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                  : proofPrep.proofSubmissionStatus === 'prepared'          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300'
                  : proofPrep.implementationStatus === 'completed'          ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                  : proofPrep.implementationStatus === 'started'            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300'
                  : proofPrep.kfwApplicationStatus === 'approved'           ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                }`}>
                  {proofPrep.payoutStatus === 'paid'                      ? 'Ausgezahlt'
                    : proofPrep.proofSubmissionStatus === 'submitted'     ? 'Eingereicht'
                    : proofPrep.proofSubmissionStatus === 'prepared'      ? 'Vorbereitet'
                    : proofPrep.implementationStatus === 'completed'      ? 'Umsetzung abgeschlossen'
                    : proofPrep.implementationStatus === 'started'        ? 'Umsetzung läuft'
                    : proofPrep.kfwApplicationStatus === 'approved'       ? 'Förderzusage erhalten'
                    : 'Warte auf Förderzusage'}
                </span>
              }
            >
              <ProofSubmissionSection
                caseId={fundingCase.id}
                fundingCase={fundingCase}
                customer={customer ?? null}
              />
            </CollapsibleCard>
          )}

          {/* Förderakte Export – always available, collapsed by default */}
          <CollapsibleCard
            id="export"
            title="Förderakte Export"
            defaultOpen={false}
            icon={<Archive className="h-4 w-4" />}
            badge={
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                readiness.blocking_count > 0
                  ? 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300'
                  : readiness.state === 'green'
                  ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
              }`}>
                {readiness.blocking_count > 0 ? 'Mit offenen Punkten' : readiness.state === 'green' ? 'Bereit' : 'In Bearbeitung'}
              </span>
            }
          >
            <FundingCaseExportSection
              caseId={fundingCase.id}
              readinessLabel={readiness.label_de}
              hasBlockers={readiness.blocking_count > 0}
            />
          </CollapsibleCard>
        </div>

        {/* ───────── Right sidebar ───────── */}
        <div className="lg:col-span-4 lg:self-start lg:sticky lg:top-5 space-y-4">

          {/* Next actions */}
          <CaseNextActionPanel
            readiness={readiness}
            checklistItems={checklistItems}
            aiChecks={aiChecks}
            tasks={allTasks}
            fundingCase={fundingCase}
          />

          {/* Status & risk */}
          <CollapsibleCard
            title="Status & Risiko"
            defaultOpen={false}
            badge={
              <div className="flex gap-1.5">
                <StatusBadge status={fundingCase.status as FundingCaseStatus} />
                <RiskBadge risk={fundingCase.risk_level as RiskLevel} />
              </div>
            }
          >
            <StatusRiskEditor
              caseId={fundingCase.id}
              currentStatus={fundingCase.status as FundingCaseStatus}
              currentRisk={fundingCase.risk_level as RiskLevel}
            />
          </CollapsibleCard>
        </div>
      </div>
    </div>
  );
}
