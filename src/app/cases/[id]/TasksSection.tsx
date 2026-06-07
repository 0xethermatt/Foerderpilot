'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useState } from 'react';
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Plus, RotateCcw } from 'lucide-react';
import { createTaskAction, completeTaskAction, reopenTaskAction } from './task-actions';
import type { TaskActionState } from './task-actions';
import type { Database } from '@/lib/supabase/database.types';

type TaskRow = Database['public']['Tables']['tasks']['Row'];

// ─── Priority helpers ─────────────────────────────────────────────────────────

const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-red-500',
  normal: 'bg-yellow-400',
  low: 'bg-gray-300',
};

const PRIORITY_LABEL: Record<string, string> = {
  high: 'Hoch',
  normal: 'Normal',
  low: 'Niedrig',
};

function formatDueDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function isDueDateOverdue(iso: string | null) {
  if (!iso) return false;
  return new Date(iso) < new Date(new Date().toDateString());
}

// ─── Submit button ─────────────────────────────────────────────────────────────

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
    >
      {pending ? 'Speichern…' : label}
    </button>
  );
}

// ─── New task form ─────────────────────────────────────────────────────────────

function NewTaskForm({ caseId, onSuccess }: { caseId: string; onSuccess: () => void }) {
  const [state, formAction] = useFormState<TaskActionState, FormData>(createTaskAction, null);

  if (state?.success) {
    onSuccess();
  }

  return (
    <form action={formAction} className="mt-4 space-y-3 border-t border-gray-100 pt-4">
      <input type="hidden" name="case_id" value={caseId} />

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Titel <span className="text-red-500">*</span>
        </label>
        <input
          name="title"
          required
          placeholder="Aufgabentitel"
          className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Beschreibung</label>
        <textarea
          name="description"
          rows={2}
          placeholder="Optional…"
          className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Fällig am</label>
          <input
            name="due_date"
            type="date"
            className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Priorität</label>
          <select
            name="priority"
            defaultValue="normal"
            className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
          >
            <option value="low">Niedrig</option>
            <option value="normal">Normal</option>
            <option value="high">Hoch</option>
          </select>
        </div>
      </div>

      {state?.error && (
        <p className="text-xs text-red-600">{state.error}</p>
      )}

      <div className="flex justify-end">
        <SubmitButton label="Aufgabe anlegen" />
      </div>
    </form>
  );
}

// ─── Task row ─────────────────────────────────────────────────────────────────

function TaskItem({ task }: { task: TaskRow }) {
  const overdue = !task.completed && isDueDateOverdue(task.due_date);

  return (
    <div className={`flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0 ${task.completed ? 'opacity-50' : ''}`}>
      {/* Priority dot */}
      <span
        className={`mt-1 flex-shrink-0 h-2 w-2 rounded-full ${PRIORITY_DOT[task.priority] ?? 'bg-gray-300'}`}
        title={PRIORITY_LABEL[task.priority]}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium text-gray-900 ${task.completed ? 'line-through' : ''}`}>
          {task.title}
        </p>
        {task.description && (
          <p className="text-xs text-gray-500 mt-0.5">{task.description}</p>
        )}
        {task.due_date && (
          <p className={`text-xs mt-0.5 ${overdue ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
            {overdue ? 'Überfällig: ' : 'Fällig: '}
            {formatDueDate(task.due_date)}
          </p>
        )}
      </div>

      {/* Action button */}
      <div className="flex-shrink-0">
        {task.completed ? (
          <form action={reopenTaskAction}>
            <input type="hidden" name="task_id" value={task.id} />
            <input type="hidden" name="case_id" value={task.funding_case_id} />
            <button
              type="submit"
              title="Wieder öffnen"
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </form>
        ) : (
          <form action={completeTaskAction}>
            <input type="hidden" name="task_id" value={task.id} />
            <input type="hidden" name="case_id" value={task.funding_case_id} />
            <button
              type="submit"
              title="Abschließen"
              className="text-gray-400 hover:text-green-600 transition-colors"
            >
              <Circle className="h-4 w-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TasksSection({
  caseId,
  initialTasks,
}: {
  caseId: string;
  initialTasks: TaskRow[];
}) {
  const [showForm, setShowForm] = useState(false);

  const open = initialTasks.filter((t) => !t.completed);
  const done = initialTasks.filter((t) => t.completed);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-900">Aufgaben</h2>
          {open.length > 0 && (
            <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold">
              {open.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 transition-colors"
        >
          {showForm ? <ChevronUp className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showForm ? 'Schließen' : 'Neu'}
        </button>
      </div>

      {/* Open tasks */}
      {open.length === 0 && !showForm && (
        <p className="text-xs text-gray-400 mt-3">Keine offenen Aufgaben.</p>
      )}
      {open.map((t) => (
        <TaskItem key={t.id} task={t} />
      ))}

      {/* Completed tasks */}
      {done.length > 0 && (
        <details className="mt-2">
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">
            {done.length} abgeschlossen
          </summary>
          <div className="mt-1">
            {done.map((t) => (
              <TaskItem key={t.id} task={t} />
            ))}
          </div>
        </details>
      )}

      {/* New task form */}
      {showForm && (
        <NewTaskForm caseId={caseId} onSuccess={() => setShowForm(false)} />
      )}
    </div>
  );
}
