import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft,
  Bot,
  ArrowRight,
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
type CustomerRow = Database['public']['Tables']['customers']['Row'];
type TaskRow = Database['public']['Tables']['tasks']['Row'];
type DocumentRow = Database['public']['Tables']['documents']['Row'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(n?: number | null) {
  if (n == null) return '–';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
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
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="h-4 w-4 text-gray-400" />
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-2 text-sm py-1.5 border-b border-gray-50 last:border-0">
      <span className="w-44 flex-shrink-0 text-gray-500">{label}</span>
      <span className="text-gray-900 break-words min-w-0">{value ?? '–'}</span>
    </div>
  );
}

function PlaceholderCard({
  title,
  icon: Icon,
  hint,
}: {
  title: string;
  icon: React.ElementType;
  hint: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-gray-400" />
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      </div>
      <p className="text-xs text-gray-400">{hint}</p>
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
        <div className="rounded-md bg-yellow-50 border border-yellow-200 px-4 py-4">
          <p className="text-sm font-medium text-yellow-800">Supabase nicht konfiguriert</p>
          <p className="text-sm text-yellow-700 mt-1">
            Bitte{' '}
            <code className="font-mono bg-yellow-100 rounded px-1">.env.local</code>{' '}
            mit{' '}
            <code className="font-mono bg-yellow-100 rounded px-1">NEXT_PUBLIC_SUPABASE_URL</code>{' '}
            und{' '}
            <code className="font-mono bg-yellow-100 rounded px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{' '}
            befüllen (siehe{' '}
            <code className="font-mono bg-yellow-100 rounded px-1">.env.local.example</code>).
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

  // Compute checklist and readiness from uploaded documents
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
      {/* Header */}
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ChevronLeft className="h-4 w-4" />
          Zurück zur Übersicht
        </Link>

        <div className="flex flex-wrap items-start gap-3">
          <h1 className="text-xl font-semibold text-gray-900 flex-1 min-w-0">
            {fundingCase.title}
          </h1>
          <div className="flex items-center gap-2 flex-shrink-0">
            <StatusBadge status={fundingCase.status} />
            <RiskBadge risk={fundingCase.risk_level} />
          </div>
        </div>

        <p className="text-sm text-gray-500 mt-1">
          Angelegt am {formatDate(fundingCase.created_at)} · Zuletzt geändert{' '}
          {formatDate(fundingCase.updated_at)}
        </p>
      </div>

      {/* Body */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">
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
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
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

            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mt-4 mb-2">
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
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{fundingCase.notes}</p>
            </DetailCard>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Status & risk editor */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Status & Risiko</h2>
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

          <PlaceholderCard
            title="Nächste Schritte"
            icon={ArrowRight}
            hint="Wird in Phase 4 ergänzt."
          />
          <TasksSection caseId={fundingCase.id} initialTasks={tasks ?? []} />
          <FundingChecklistSection
            caseId={fundingCase.id}
            items={checklistItems}
            readiness={readiness}
          />
          <DocumentsSection
            caseId={fundingCase.id}
            initialDocuments={documents}
            signedUrls={signedUrls}
          />
          <PlaceholderCard
            title="KI-Prüfungen"
            icon={Bot}
            hint="KI-Prüfungen erfordern manuelle Freigabe – werden später ergänzt."
          />
        </div>
      </div>
    </div>
  );
}
