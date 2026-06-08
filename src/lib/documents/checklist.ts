// ─── Types ────────────────────────────────────────────────────────────────────

export type DocumentPhase =
  | 'before_application'
  | 'after_approval'
  | 'after_completion'
  | 'other';

export type ChecklistStatus = 'missing' | 'needs_review' | 'reviewed' | 'rejected';

export type ReadinessState = 'red' | 'yellow' | 'green';

export interface ChecklistItem {
  document_type: string;
  label_de: string;
  phase: DocumentPhase;
  required: boolean;
  status: ChecklistStatus;
  latest_document_id?: string;
  latest_filename?: string;
  blocking: boolean;
  hint_de?: string;
}

export interface ReadinessSummary {
  state: ReadinessState;
  label_de: string;
  total_required_before_app: number;
  reviewed_count: number;
  blocking_count: number;
  needs_review_count: number;
}

// Minimal shape needed from a document row — avoids importing Database types
type ChecklistDoc = {
  id: string;
  type: string;
  name: string;
  status: string;
  uploaded_at: string;
};

// ─── Static document spec ─────────────────────────────────────────────────────

interface DocSpec {
  document_type: string;
  label_de: string;
  phase: DocumentPhase;
  required: boolean;
  task_title?: string;
  hint_de?: string;
}

const DOCUMENT_SPEC: DocSpec[] = [
  // ── Before application ─────────────────────────────────────────────────────
  {
    document_type: 'offer',
    label_de: 'Angebot',
    phase: 'before_application',
    required: true,
    task_title: 'Angebot hochladen',
    hint_de: 'Kostenangebot des Installateurs erforderlich.',
  },
  {
    document_type: 'contract',
    label_de: 'Liefer-/Leistungsvertrag',
    phase: 'before_application',
    required: true,
    task_title: 'Liefer-/Leistungsvertrag hochladen',
    hint_de: 'Vertrag muss vor Antragstellung vorliegen.',
  },
  {
    document_type: 'old_heating_photo',
    label_de: 'Foto Altanlage',
    phase: 'before_application',
    required: true,
    task_title: 'Foto Altanlage anfordern',
    hint_de: 'Foto der bestehenden Heizanlage.',
  },
  {
    document_type: 'old_heating_nameplate',
    label_de: 'Foto Typenschild Altanlage',
    phase: 'before_application',
    required: true,
    task_title: 'Foto Typenschild Altanlage anfordern',
    hint_de: 'Typenschild mit Baujahr und Leistungsangabe.',
  },
  {
    document_type: 'owner_proof',
    label_de: 'Eigentumsnachweis',
    phase: 'before_application',
    required: true,
    task_title: 'Eigentumsnachweis anfordern',
    hint_de: 'Grundbuchauszug oder Kaufvertrag.',
  },
  // ── After approval ─────────────────────────────────────────────────────────
  {
    document_type: 'bza',
    label_de: 'BZA',
    phase: 'after_approval',
    required: true,
    hint_de: 'Wird nach Förderzusage benötigt.',
  },
  {
    document_type: 'kfw_approval',
    label_de: 'KfW-Bewilligung',
    phase: 'after_approval',
    required: true,
    hint_de: 'Förderzusage-Schreiben von KfW (Meine KfW).',
  },
  // ── After completion ───────────────────────────────────────────────────────
  {
    document_type: 'invoice',
    label_de: 'Rechnung',
    phase: 'after_completion',
    required: true,
    hint_de: 'Rechnung nach Einbau der Wärmepumpe.',
  },
  {
    document_type: 'bnd',
    label_de: 'BND',
    phase: 'after_completion',
    required: true,
    hint_de: 'Nachweis der fachgerechten Ausführung.',
  },
  // ── Other ──────────────────────────────────────────────────────────────────
  {
    document_type: 'other',
    label_de: 'Sonstiges',
    phase: 'other',
    required: false,
  },
];

// ─── Checklist computation ────────────────────────────────────────────────────

export function computeChecklist(documents: ChecklistDoc[]): ChecklistItem[] {
  // Group by type, latest uploaded_at first
  const byType: Record<string, ChecklistDoc[]> = {};
  for (const doc of documents) {
    (byType[doc.type] ??= []).push(doc);
  }
  for (const docs of Object.values(byType)) {
    docs.sort(
      (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime(),
    );
  }

  const items: ChecklistItem[] = [];

  for (const spec of DOCUMENT_SPEC) {
    const docs = byType[spec.document_type] ?? [];
    const latest = docs[0];

    // Skip optional types with no uploads (keeps checklist focused)
    if (!spec.required && !latest) continue;

    let status: ChecklistStatus;
    if (!latest) {
      status = 'missing';
    } else if (latest.status === 'reviewed') {
      status = 'reviewed';
    } else if (latest.status === 'rejected') {
      status = 'rejected';
    } else {
      // 'uploaded', 'needs_review', or DB 'missing' → awaiting review
      status = 'needs_review';
    }

    const blocking =
      spec.phase === 'before_application' &&
      spec.required &&
      (status === 'missing' || status === 'rejected');

    items.push({
      document_type: spec.document_type,
      label_de: spec.label_de,
      phase: spec.phase,
      required: spec.required,
      status,
      latest_document_id: latest?.id,
      latest_filename: latest?.name,
      blocking,
      // Only show hint when the document is actionable
      hint_de: blocking || status === 'missing' ? spec.hint_de : undefined,
    });
  }

  return items;
}

// ─── Readiness computation ────────────────────────────────────────────────────

export function computeReadiness(items: ChecklistItem[]): ReadinessSummary {
  const beforeApp = items.filter((i) => i.phase === 'before_application' && i.required);
  const blockingCount = beforeApp.filter((i) => i.blocking).length;
  const needsReviewCount = beforeApp.filter((i) => i.status === 'needs_review').length;
  const reviewedCount = beforeApp.filter((i) => i.status === 'reviewed').length;

  let state: ReadinessState;
  let label_de: string;

  if (blockingCount > 0) {
    state = 'red';
    label_de = 'Nicht antragsbereit';
  } else if (needsReviewCount > 0) {
    state = 'yellow';
    label_de = 'Fast antragsbereit';
  } else {
    state = 'green';
    label_de = 'Antragsbereit';
  }

  return {
    state,
    label_de,
    total_required_before_app: beforeApp.length,
    reviewed_count: reviewedCount,
    blocking_count: blockingCount,
    needs_review_count: needsReviewCount,
  };
}

// ─── Task title helper ────────────────────────────────────────────────────────

export function getBlockingTaskTitles(
  items: ChecklistItem[],
): Array<{ document_type: string; task_title: string }> {
  return items.flatMap((item) => {
    if (!item.blocking) return [];
    const spec = DOCUMENT_SPEC.find((s) => s.document_type === item.document_type);
    return spec?.task_title
      ? [{ document_type: item.document_type, task_title: spec.task_title }]
      : [];
  });
}
