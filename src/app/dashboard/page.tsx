import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ClipboardList, Folder, Plus } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';
import RiskBadge from '@/components/ui/RiskBadge';
import { createServiceClient } from '@/lib/supabase/service-client';
import { isServiceRoleConfigured } from '@/lib/supabase/safe-client';
import type { Database } from '@/lib/supabase/database.types';
import type { FundingCaseStatus, RiskLevel } from '@/lib/types';

type FundingCaseRow = Database['public']['Tables']['funding_cases']['Row'];
type CustomerRow = Database['public']['Tables']['customers']['Row'];
type TaskRow = Database['public']['Tables']['tasks']['Row'];

interface DashboardCase extends FundingCaseRow {
  customer: Pick<CustomerRow, 'first_name' | 'last_name'> | null;
  open_task_count: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatCurrency(amount?: number | null) {
  if (amount == null) return '–';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

// ─── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 flex items-center gap-4">
      <div className={`flex-shrink-0 rounded-lg p-2.5 ${accent}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-semibold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ─── Upcoming tasks sidebar ────────────────────────────────────────────────────

const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-red-500',
  normal: 'bg-yellow-400',
  low: 'bg-gray-300',
};

function UpcomingTasks({
  tasks,
  caseMap,
}: {
  tasks: TaskRow[];
  caseMap: Record<string, string>;
}) {
  if (tasks.length === 0) {
    return <p className="text-xs text-gray-400">Keine offenen Aufgaben.</p>;
  }
  return (
    <ul className="space-y-2">
      {tasks.map((t) => {
        const overdue = t.due_date && new Date(t.due_date) < new Date(new Date().toDateString());
        return (
          <li key={t.id} className="flex items-start gap-2">
            <span
              className={`mt-1.5 flex-shrink-0 h-2 w-2 rounded-full ${PRIORITY_DOT[t.priority] ?? 'bg-gray-300'}`}
            />
            <div className="min-w-0">
              <Link
                href={`/cases/${t.funding_case_id}`}
                className="text-sm text-gray-800 hover:underline line-clamp-1"
              >
                {t.title}
              </Link>
              {caseMap[t.funding_case_id] && (
                <p className="text-xs text-gray-400 truncate">{caseMap[t.funding_case_id]}</p>
              )}
              {t.due_date && (
                <p className={`text-xs ${overdue ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                  {overdue ? 'Überfällig · ' : ''}
                  {new Date(t.due_date).toLocaleDateString('de-DE', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ─── Cases table ───────────────────────────────────────────────────────────────

function CasesTable({ cases }: { cases: DashboardCase[] }) {
  if (cases.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-gray-400">Noch keine Fälle vorhanden.</p>
        <Link
          href="/cases/new"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <Plus className="h-4 w-4" />
          Ersten Förderfall anlegen
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-100">
        <thead>
          <tr>
            {['Kunde', 'Titel', 'Status', 'Risiko', 'Geschätzte Kosten', 'Off. Aufgaben', 'Zuletzt geändert'].map(
              (h) => (
                <th
                  key={h}
                  className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wide first:pl-0 last:pr-0"
                >
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {cases.map((c) => (
            <tr key={c.id} className="hover:bg-gray-50 transition-colors">
              <td className="py-3 px-4 first:pl-0 text-sm font-medium text-gray-900 whitespace-nowrap">
                {c.customer
                  ? `${c.customer.last_name}, ${c.customer.first_name}`
                  : '–'}
              </td>
              <td className="py-3 px-4 text-sm text-gray-700 max-w-[200px] truncate">
                <Link
                  href={`/cases/${c.id}`}
                  className="hover:text-gray-900 hover:underline"
                >
                  {c.title}
                </Link>
              </td>
              <td className="py-3 px-4">
                <StatusBadge status={c.status as FundingCaseStatus} />
              </td>
              <td className="py-3 px-4">
                <RiskBadge risk={c.risk_level as RiskLevel} />
              </td>
              <td className="py-3 px-4 text-sm text-gray-700 whitespace-nowrap">
                {formatCurrency(c.estimated_cost)}
              </td>
              <td className="py-3 px-4 text-sm text-center">
                {c.open_task_count > 0 ? (
                  <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold">
                    {c.open_task_count}
                  </span>
                ) : (
                  <span className="text-gray-300">–</span>
                )}
              </td>
              <td className="py-3 px-4 last:pr-0 text-sm text-gray-500 whitespace-nowrap">
                {formatDate(c.updated_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  // ── Fallback when Supabase is not configured ─────────────────────────────
  if (!isServiceRoleConfigured()) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">Übersicht</h1>
        <div className="rounded-md bg-yellow-50 border border-yellow-200 px-4 py-4">
          <p className="text-sm font-medium text-yellow-800">Supabase nicht konfiguriert</p>
          <p className="text-sm text-yellow-700 mt-1">
            Bitte{' '}
            <code className="font-mono bg-yellow-100 rounded px-1">.env.local</code>{' '}
            mit den Supabase-Zugangsdaten befüllen.
          </p>
        </div>
      </div>
    );
  }

  // ── Load data ────────────────────────────────────────────────────────────
  const supabase = createServiceClient();

  const [casesResult, taskCountResult, upcomingTasksResult] = await Promise.all([
    supabase
      .from('funding_cases')
      .select()
      .order('updated_at', { ascending: false }),
    supabase
      .from('tasks')
      .select('funding_case_id')
      .eq('completed', false),
    supabase
      .from('tasks')
      .select()
      .eq('completed', false)
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(20)
      .returns<TaskRow[]>(),
  ]);

  const allCases = casesResult.data ?? [];

  // Load customers for the cases we have
  let customers: Pick<CustomerRow, 'id' | 'first_name' | 'last_name'>[] = [];
  if (allCases.length > 0) {
    const customerIds = Array.from(new Set(allCases.map((c) => c.customer_id)));
    const { data } = await supabase
      .from('customers')
      .select('id, first_name, last_name')
      .in('id', customerIds);
    customers = data ?? [];
  }

  // Build lookup maps
  const customerMap = Object.fromEntries(customers.map((c) => [c.id, c]));
  const taskCountMap: Record<string, number> = {};
  for (const t of taskCountResult.data ?? []) {
    taskCountMap[t.funding_case_id] = (taskCountMap[t.funding_case_id] ?? 0) + 1;
  }

  // Enrich cases
  const enrichedCases: DashboardCase[] = allCases.map((c) => ({
    ...c,
    customer: customerMap[c.customer_id] ?? null,
    open_task_count: taskCountMap[c.id] ?? 0,
  }));

  // Case title map for task sidebar
  const caseTitleMap = Object.fromEntries(allCases.map((c) => [c.id, c.title]));
  const upcomingTasks = upcomingTasksResult.data ?? [];

  // ── Derived stats ────────────────────────────────────────────────────────
  const activeCases = enrichedCases.filter((c) => c.status !== 'completed');
  const criticalCases = enrichedCases.filter((c) => c.risk_level === 'red');
  const totalOpenTasks = Object.values(taskCountMap).reduce((s, n) => s + n, 0);
  const completedCases = enrichedCases.filter((c) => c.status === 'completed');

  return (
    <div className="space-y-8">
      {/* Page title */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Übersicht</h1>
          <p className="text-sm text-gray-500 mt-1">
            Alle aktiven Fördervorbereitungsfälle auf einen Blick.
          </p>
        </div>
        <Link
          href="/cases/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          Neuer Förderfall
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Aktive Fälle"
          value={activeCases.length}
          icon={Folder}
          accent="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="Kritische Fälle"
          value={criticalCases.length}
          icon={AlertTriangle}
          accent="bg-red-50 text-red-600"
        />
        <StatCard
          label="Offene Aufgaben"
          value={totalOpenTasks}
          icon={ClipboardList}
          accent="bg-amber-50 text-amber-600"
        />
        <StatCard
          label="Abgeschlossen"
          value={completedCases.length}
          icon={CheckCircle2}
          accent="bg-green-50 text-green-600"
        />
      </div>

      {/* Main content: cases table + tasks sidebar */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Cases table */}
        <div className="xl:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-gray-900">Aktive Fälle</h2>
            <span className="text-xs text-gray-400">{activeCases.length} gesamt</span>
          </div>
          <CasesTable cases={activeCases} />
        </div>

        {/* Upcoming tasks sidebar */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-gray-900">Offene Aufgaben</h2>
            {upcomingTasks.length > 0 && (
              <span className="text-xs text-gray-400">{upcomingTasks.length} gesamt</span>
            )}
          </div>
          <UpcomingTasks tasks={upcomingTasks} caseMap={caseTitleMap} />
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-gray-400 border-t border-gray-100 pt-4">
        Förderpilot unterstützt die Vorbereitung von Förderanträgen. Kein automatischer Antrag –
        alle KI-Prüfungen erfordern manuelle Freigabe. Es wird keine Garantie auf Fördererhalt gegeben.
      </p>
    </div>
  );
}
