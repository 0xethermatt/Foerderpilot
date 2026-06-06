import { AlertTriangle, CheckCircle2, ClipboardList, Folder } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';
import RiskBadge from '@/components/ui/RiskBadge';
import { mockFundingCases, mockTasks } from '@/lib/mock/data';
import type { FundingCase } from '@/lib/types';

// ─── Derived stats ─────────────────────────────────────────────────────────────

const activeCases = mockFundingCases.filter((c) => c.status !== 'completed');
const criticalCases = mockFundingCases.filter((c) => c.risk_level === 'red');
const openTasks = mockTasks.filter((t) => !t.completed);
const completedCases = mockFundingCases.filter((c) => c.status === 'completed');

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

// ─── Cases table ───────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatCurrency(amount?: number) {
  if (amount == null) return '–';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);
}

function CasesTable({ cases }: { cases: FundingCase[] }) {
  if (cases.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-gray-400">Keine Fälle vorhanden.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-100">
        <thead>
          <tr>
            {['Kunde', 'Titel', 'Status', 'Risiko', 'Förderung', 'Off. Aufgaben', 'Zuletzt geändert'].map(
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
                {c.customer ? `${c.customer.last_name}, ${c.customer.first_name}` : '–'}
              </td>
              <td className="py-3 px-4 text-sm text-gray-700 max-w-[200px] truncate">
                {c.title}
              </td>
              <td className="py-3 px-4">
                <StatusBadge status={c.status} />
              </td>
              <td className="py-3 px-4">
                <RiskBadge risk={c.risk_level} />
              </td>
              <td className="py-3 px-4 text-sm text-gray-700 whitespace-nowrap">
                {formatCurrency(c.funding_amount)}
              </td>
              <td className="py-3 px-4 text-sm text-center">
                {(c.open_task_count ?? 0) > 0 ? (
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

// ─── Upcoming tasks ────────────────────────────────────────────────────────────

function UpcomingTasks() {
  const sorted = [...openTasks]
    .filter((t) => t.due_date)
    .sort((a, b) => (a.due_date! > b.due_date! ? 1 : -1))
    .slice(0, 5);

  const caseById = Object.fromEntries(mockFundingCases.map((c) => [c.id, c]));

  return (
    <ul className="divide-y divide-gray-50">
      {sorted.map((t) => {
        const fundingCase = caseById[t.funding_case_id];
        const overdue = t.due_date! < new Date().toISOString().slice(0, 10);
        return (
          <li key={t.id} className="py-3 flex items-start gap-3">
            <span
              className={`mt-0.5 flex-shrink-0 h-2 w-2 rounded-full ${overdue ? 'bg-red-500' : 'bg-amber-400'}`}
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{t.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {fundingCase
                  ? `${fundingCase.customer?.last_name ?? '–'} · ${fundingCase.title}`
                  : '–'}
                {t.due_date && (
                  <>
                    {' · '}
                    <span className={overdue ? 'text-red-600 font-medium' : ''}>
                      fällig {formatDate(t.due_date)}
                    </span>
                  </>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const activeNonCompleted = mockFundingCases.filter((c) => c.status !== 'completed');

  return (
    <div className="space-y-8">
      {/* Page title */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Übersicht</h1>
        <p className="text-sm text-gray-500 mt-1">
          Alle aktiven Fördervorbereitungsfälle auf einen Blick.
        </p>
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
          value={openTasks.length}
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

      {/* Main content: table + task sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cases table */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-gray-900">Aktive Fälle</h2>
            <span className="text-xs text-gray-400">{activeNonCompleted.length} gesamt</span>
          </div>
          <CasesTable cases={activeNonCompleted} />
        </div>

        {/* Sidebar: upcoming tasks */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-gray-900">Nächste Aufgaben</h2>
            <span className="text-xs text-gray-400">{openTasks.length} offen</span>
          </div>
          <UpcomingTasks />
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
