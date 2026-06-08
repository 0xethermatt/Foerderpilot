import { notFound } from 'next/navigation';
import {
  MapPin,
  Thermometer,
  Building2,
  User,
} from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';
import RiskBadge from '@/components/ui/RiskBadge';
import StatusRiskEditor from './StatusRiskEditor';
import TasksSection from './TasksSection';
import DocumentsSection from './DocumentsSection';
import FundingChecklistSection from './FundingChecklistSection';
import AIChecksSection from './AIChecksSection';
import CaseCommandHeader from './CaseCommandHeader';
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
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

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

// ─── Sub-components ───────────────────────────────────────────────────────────

function DetailCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-300 dark:border-gray-800 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-2 text-sm py-1.5 border-b border-gray-50 dark:border-gray-800 last:border-0">
      <span className="w-44 flex-shrink-0 text-gray-500 dark:text-gray-400">{label}</span>
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
            befüllen (siehe{' '}
            <code className="font-mono bg-yellow-100 dark:bg-yellow-900 rounded px-1">.env.local.example</code>).
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

  if (error || !fundingCase) {
    notFound();
  }

  const { data: customer } = await supabase
    .from('customers')
    .select()
    .eq('id', fundingCase.customer_id)
    .single<CustomerRow>();

  const { data: tasks } = await supabase
    .from('tasks')
    .select()
    .eq('funding_case_id', fundingCase.id)
    .order('completed', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false })
    .returns<TaskRow[]>();

  const { data: documentsRaw } = await supabase
    .from('documents')
    .select()
    .eq('funding_case_id', fundingCase.id)
    .order('uploaded_at', { ascending: false })
    .returns<DocumentRow[]>();

  const documents = documentsRaw ?? [];

  const { data: aiChecksRaw } = await supabase
    .from('ai_checks')
    .select()
    .eq('case_id', fundingCase.id)
    .order('created_at', { ascending: false })
    .returns<AICheckRow[]>();

  const aiChecks = aiChecksRaw ?? [];

  const checklistItems = computeChecklist(documents);
  const readiness = computeReadiness(checklistItems);

  // Generate signed URLs server-side for all documents (1-hour expiry)
  const signedUrls: Record<string, string> = {};
  if (documents.length > 0) {
    const { data: urlData } = await supabase.storage
      .from('case-documents')
      .createSignedUrls(
        documents.map((d) => d.storage_path),
        3600,
      );
    if (urlData) {
      for (const item of urlData) {
        if (item.path && item.signedUrl) {
          signedUrls[item.path] = item.signedUrl;
        }
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Command header */}
      <CaseCommandHeader
        fundingCase={fundingCase}
        customer={customer ?? null}
        tasks={tasks ?? []}
        readiness={readiness}
      />

      {/* Body */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* ── Left column: overview + documents ── */}
        <div className="lg:col-span-7 space-y-5">
          {/* Customer */}
          {customer && (
            <DetailCard title="Kundendaten" icon={User}>
              <Row label="Name" value={`${customer.first_name} ${customer.last_name}`} />
              <Row label="E-Mail" value={customer.email} />
              <Row label="Telefon" value={customer.phone} />
              <Row
                label="Rechnungsadresse"
                value={`${customer.street}, ${customer.postal_code} ${customer.city}`}
              />
            </DetailCard>
          )}

          {/* Project address */}
          <DetailCard title="Projektadresse (Einbauort)" icon={MapPin}>
            <Row
              label="Adresse"
              value={
                fundingCase.project_address_street
                  ? `${fundingCase.project_address_street}, ${fundingCase.project_address_postal_code} ${fundingCase.project_address_city}`
                  : null
              }
            />
            <Row
              label="Gebäudetyp"
              value={fundingCase.building_type ? BUILDING_TYPE_LABELS[fundingCase.building_type] : null}
            />
            <Row
              label="Wohneinheiten"
              value={fundingCase.housing_units != null ? String(fundingCase.housing_units) : null}
            />
            <Row
              label="Eigentümer"
              value={fundingCase.owner_status ? OWNER_STATUS_LABELS[fundingCase.owner_status] : null}
            />
            <Row
              label="Selbst bewohnt"
              value={
                fundingCase.self_occupied === true
                  ? 'Ja'
                  : fundingCase.self_occupied === false
                  ? 'Nein'
                  : null
              }
            />
          </DetailCard>

          {/* Heating */}
          <DetailCard title="Heizung" icon={Thermometer}>
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
              Bestehend
            </p>
            <Row
              label="Heizungstyp"
              value={
                fundingCase.current_heating_type
                  ? CURRENT_HEATING_TYPE_LABELS[fundingCase.current_heating_type]
                  : null
              }
            />
            <Row
              label="Baujahr"
              value={
                fundingCase.current_heating_year != null
                  ? String(fundingCase.current_heating_year)
                  : null
              }
            />

            <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mt-4 mb-2">
              Geplant
            </p>
            <Row
              label="Wärmepumpentyp"
              value={
                fundingCase.planned_heating_type
                  ? PLANNED_HEATING_TYPE_LABELS[fundingCase.planned_heating_type]
                  : null
              }
            />
            <Row label="Modell" value={fundingCase.planned_heat_pump_model} />
            <Row label="Geschätzte Kosten" value={formatCurrency(fundingCase.estimated_cost)} />
            <Row label="Förderbetrag" value={formatCurrency(fundingCase.funding_amount)} />
          </DetailCard>

          {/* Notes */}
          {fundingCase.notes && (
            <DetailCard title="Notizen" icon={Building2}>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{fundingCase.notes}</p>
            </DetailCard>
          )}

          {/* Documents */}
          <div id="documents">
            <DocumentsSection
              caseId={fundingCase.id}
              initialDocuments={documents}
              signedUrls={signedUrls}
            />
          </div>
        </div>

        {/* ── Right column: status/tasks side-by-side on 2xl, checklist + AI full-width ── */}
        <div className="lg:col-span-5">
          <div className="grid gap-4 2xl:grid-cols-2">
            {/* Status & risk editor */}
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-300 dark:border-gray-800 p-5">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Status & Risiko</h2>
              <div className="flex gap-2 mb-4">
                <StatusBadge status={fundingCase.status as FundingCaseStatus} />
                <RiskBadge risk={fundingCase.risk_level as RiskLevel} />
              </div>
              <StatusRiskEditor
                caseId={fundingCase.id}
                currentStatus={fundingCase.status as FundingCaseStatus}
                currentRisk={fundingCase.risk_level as RiskLevel}
              />
            </div>

            {/* Tasks */}
            <div id="tasks">
              <TasksSection caseId={fundingCase.id} initialTasks={tasks ?? []} />
            </div>

            {/* Checklist – full width */}
            <div className="2xl:col-span-2">
              <FundingChecklistSection
                caseId={fundingCase.id}
                items={checklistItems}
                readiness={readiness}
              />
            </div>

            {/* AI checks – full width */}
            <div className="2xl:col-span-2" id="ai-checks">
              <AIChecksSection
                caseId={fundingCase.id}
                initialChecks={aiChecks}
                readiness={readiness}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
