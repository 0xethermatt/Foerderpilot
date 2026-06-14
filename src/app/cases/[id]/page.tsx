import { notFound } from 'next/navigation';
import {
  Thermometer,
  Building2,
  User,
  MapPin,
  ShieldAlert,
  ClipboardCheck,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import StatusBadge from '@/components/ui/StatusBadge';
import RiskBadge from '@/components/ui/RiskBadge';
import StatusRiskEditor from './StatusRiskEditor';
import TasksSection from './TasksSection';
import AIChecksSection from './AIChecksSection';
import BzaPreparationSection from './BzaPreparationSection';
import CaseCommandHeader from './CaseCommandHeader';
import CaseWorkflowStepper from './CaseWorkflowStepper';
import CaseWorkspace from './CaseWorkspace';
import CaseNextActionPanel from './CaseNextActionPanel';
import CompactDocumentsTable from './CompactDocumentsTable';
import CollapsibleCard from './CollapsibleCard';

import { computeChecklist, computeReadiness } from '@/lib/documents/checklist';
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

  const openTaskCount = allTasks.filter((t) => !t.completed).length;
  const bzaAutoOpen   = readiness.blocking_count === 0 && readiness.needs_review_count === 0;

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

          {/* AI checks – collapsed */}
          <CollapsibleCard
            id="ai-checks"
            title="KI-Prüfungen"
            defaultOpen={false}
            icon={<ShieldAlert className="h-4 w-4" />}
            badge={
              aiChecks.length > 0 ? (
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
