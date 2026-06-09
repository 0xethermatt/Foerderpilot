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
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-300 dark:border-gray-800 p-3 sm:p-5 flex items-center gap-2.5 sm:gap-4">
      <div className={`flex-shrink-0 rounded-lg p-2 sm:p-2.5 ${accent}`}>
        <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-100 leading-tight">{value}</p>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">{label}</p>
      </div>
    </div>
  );
}

// ─── Upcoming tasks sidebar ────────────────────────────────────────────────────

const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-red-500',
  normal: 'bg-yellow-400',
  low: 'bg-gray-300 dark:bg-gray-600',
};

function UpcomingTasks({
  tasks,
  caseMap,
}: {
  tasks: TaskRow[];
  caseMap: Record<string, string>;
}) {
  const MOBILE_LIMIT = 5;
  const extraCount = Math.max(0, tasks.length - MOBILE_LIMIT);

  if (tasks.length === 0) {
    return (
      <div className="py-4 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">Keine offenen Aufgaben.</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Alle Fälle sind auf dem aktuellen Stand.
        </p>
      </div>
    );
  }
  return (
    <div>
      <ul className="space-y-3">
        {tasks.map((t, idx) => {
          const overdue = t.due_date && new Date(t.due_date) < new Date(new Date().toDateString());
          return (
            <li
              key={t.id}
              className={`items-start gap-2.5 ${idx >= MOBILE_LIMIT ? 'hidden sm:flex' : 'flex'}`}
            >
              <span
                className={`mt-1.5 flex-shrink-0 h-2 w-2 rounded-full ${PRIORITY_DOT[t.priority] ?? 'bg-gray-300'}`}
              />
              <div className="min-w-0">
                <Link
                  href={`/cases/${t.funding_case_id}`}
                  className="text-sm text-gray-800 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white hover:underline line-clamp-1"
                >
                  {t.title}
                </Link>
                {caseMap[t.funding_case_id] && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                    {caseMap[t.funding_case_id]}
                  </p>
                )}
              {t.due_date && (
                <p className={`text-xs mt-0.5 ${overdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
                  {overdue ? 'Überfällig · ' : 'Fällig · '}
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
      {extraCount > 0 && (
        <p className="sm:hidden mt-3 text-xs text-gray-400 dark:text-gray-500">
          + {extraCount} weitere
        </p>
      )}
    </div>
  );
}

// ─── Cases list (div-based for clickable rows + responsive cards) ──────────────

const COL = 'sm:grid sm:grid-cols-[180px_1fr_120px_90px_48px_96px] sm:items-center sm:gap-4';

function CaseRow({ c }: { c: DashboardCase }) {
  const customerName = c.customer
    ? `${c.customer.last_name}, ${c.customer.first_name}`
    : '–';

  return (
    <Link
      href={`/cases/${c.id}`}
      className="block hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
    >
      {/* Mobile card */}
      <div className="sm:hidden px-4 py-3.5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">
              {customerName}
            </p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate mt-0.5">
              {c.title}
            </p>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap flex-shrink-0 mt-0.5">
            {formatDate(c.updated_at)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={c.status as FundingCaseStatus} />
          <RiskBadge risk={c.risk_level as RiskLevel} />
          {c.open_task_count > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-orange-700 dark:text-orange-400 font-medium">
              <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-orange-100 dark:bg-orange-900/40 text-xs font-semibold">
                {c.open_task_count}
              </span>
              Aufgaben
            </span>
          )}
        </div>
      </div>

      {/* Desktop row */}
      <div className={`hidden ${COL} py-3`}>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
          {customerName}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300 truncate group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">
          {c.title}
        </p>
        <div className="flex">
          <StatusBadge status={c.status as FundingCaseStatus} />
        </div>
        <div className="flex">
          <RiskBadge risk={c.risk_level as RiskLevel} />
        </div>
        <div className="flex justify-center">
          {c.open_task_count > 0 ? (
            <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 text-xs font-semibold">
              {c.open_task_count}
            </span>
          ) : (
            <span className="text-gray-300 dark:text-gray-600">–</span>
          )}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
          {formatDate(c.updated_at)}
        </p>
      </div>
    </Link>
  );
}

function CasesList({ cases }: { cases: DashboardCase[] }) {
  if (cases.length === 0) {
    return (
      <div className="py-14 flex flex-col items-center text-center">
        <div className="rounded-full bg-gray-100 dark:bg-gray-800 p-3 mb-3">
          <Folder className="h-5 w-5 text-gray-400 dark:text-gray-500" />
        </div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Noch keine aktiven Förderfälle
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 mb-4 max-w-[220px]">
          Legen Sie den ersten Fall an, um mit der Vorbereitung zu starten.
        </p>
        <Link
          href="/cases/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 dark:bg-gray-100 px-3 py-2 text-sm font-medium text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Ersten Förderfall anlegen
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Desktop header row */}
      <div className={`hidden ${COL} pb-2.5 border-b border-gray-100 dark:border-gray-800`}>
        {['Kunde', 'Fall', 'Status', 'Risiko', 'Aufgaben', 'Aktualisiert'].map((h) => (
          <p
            key={h}
            className={`text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide ${h === 'Aufgaben' ? 'text-center' : ''}`}
          >
            {h}
          </p>
        ))}
      </div>

      {/* Rows */}
      <div className="-mx-4 sm:mx-0 divide-y divide-gray-50 dark:divide-gray-800 sm:divide-gray-100">
        {cases.map((c) => (
          <CaseRow key={c.id} c={c} />
        ))}
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  if (!isServiceRoleConfigured()) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Übersicht</h1>
        <div className="rounded-md bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 px-4 py-4">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Supabase nicht konfiguriert</p>
          <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
            Bitte{' '}
            <code className="font-mono bg-yellow-100 dark:bg-yellow-900 rounded px-1">.env.local</code>{' '}
            mit den Supabase-Zugangsdaten befüllen.
          </p>
        </div>
      </div>
    );
  }

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

  let customers: Pick<CustomerRow, 'id' | 'first_name' | 'last_name'>[] = [];
  if (allCases.length > 0) {
    const customerIds = Array.from(new Set(allCases.map((c) => c.customer_id)));
    const { data } = await supabase
      .from('customers')
      .select('id, first_name, last_name')
      .in('id', customerIds);
    customers = data ?? [];
  }

  const customerMap = Object.fromEntries(customers.map((c) => [c.id, c]));
  const taskCountMap: Record<string, number> = {};
  for (const t of taskCountResult.data ?? []) {
    taskCountMap[t.funding_case_id] = (taskCountMap[t.funding_case_id] ?? 0) + 1;
  }

  const enrichedCases: DashboardCase[] = allCases.map((c) => ({
    ...c,
    customer: customerMap[c.customer_id] ?? null,
    open_task_count: taskCountMap[c.id] ?? 0,
  }));

  const caseTitleMap = Object.fromEntries(allCases.map((c) => [c.id, c.title]));
  const upcomingTasks = upcomingTasksResult.data ?? [];

  const activeCases = enrichedCases.filter((c) => c.status !== 'completed');
  const criticalCases = enrichedCases.filter((c) => c.risk_level === 'red');
  const totalOpenTasks = Object.values(taskCountMap).reduce((s, n) => s + n, 0);
  const completedCases = enrichedCases.filter((c) => c.status === 'completed');

  return (
    <div className="space-y-5 sm:space-y-8">
      {/* Page title — no duplicate CTA, nav already has it */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Übersicht</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Alle aktiven Fördervorbereitungsfälle auf einen Blick.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Aktive Fälle"    value={activeCases.length}    icon={Folder}       accent="bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400" />
        <StatCard label="Kritische Fälle" value={criticalCases.length}  icon={AlertTriangle} accent="bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400" />
        <StatCard label="Offene Aufgaben" value={totalOpenTasks}         icon={ClipboardList} accent="bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400" />
        <StatCard label="Abgeschlossen"   value={completedCases.length} icon={CheckCircle2}  accent="bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400" />
      </div>

      {/* Main content: cases list + tasks sidebar */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-5">
        {/* Cases */}
        <div className="xl:col-span-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-300 dark:border-gray-800 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Aktive Fälle</h2>
            {activeCases.length > 0 && (
              <span className="text-xs text-gray-400 dark:text-gray-500">{activeCases.length} gesamt</span>
            )}
          </div>
          <CasesList cases={activeCases} />
        </div>

        {/* Upcoming tasks */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-300 dark:border-gray-800 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Offene Aufgaben</h2>
            {upcomingTasks.length > 0 && (
              <span className="text-xs text-gray-400 dark:text-gray-500">{upcomingTasks.length} gesamt</span>
            )}
          </div>
          <UpcomingTasks tasks={upcomingTasks} caseMap={caseTitleMap} />
        </div>
      </div>

    </div>
  );
}
