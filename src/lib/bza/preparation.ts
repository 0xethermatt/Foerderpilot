import type { ChecklistItem, ReadinessSummary } from '@/lib/documents/checklist';
import type { Database } from '@/lib/supabase/database.types';

type DocumentRow = Database['public']['Tables']['documents']['Row'];
type AICheckRow  = Database['public']['Tables']['ai_checks']['Row'];

// ─── Types ────────────────────────────────────────────────────────────────────

export type BzaReadinessStatus = 'bereit' | 'fast_bereit' | 'nicht_bereit';

export interface BzaWarning {
  level: 'error' | 'warning' | 'info';
  message: string;
}

export interface BzaPreparation {
  readinessStatus:       BzaReadinessStatus;
  warnings:              BzaWarning[];
  preferredContractCheck: AICheckRow | null;
  preferredOfferCheck:   AICheckRow | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickPreferred(checks: AICheckRow[], checkType: string): AICheckRow | null {
  const relevant = checks.filter(
    (c) => c.check_type === checkType && c.status === 'completed',
  );
  if (!relevant.length) return null;
  const approved = relevant.filter((c) => c.human_review_status === 'approved');
  const pool     = approved.length ? approved : relevant;
  return pool.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )[0];
}

function rjObj(check: AICheckRow | null): Record<string, unknown> | null {
  if (!check) return null;
  const r = check.result_json;
  return typeof r === 'object' && r !== null && !Array.isArray(r)
    ? (r as Record<string, unknown>)
    : null;
}

function sub(obj: Record<string, unknown> | null | undefined, key: string): Record<string, unknown> | undefined {
  if (!obj) return undefined;
  const v = obj[key];
  return typeof v === 'object' && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined;
}

// ─── Main computation ─────────────────────────────────────────────────────────

export function computeBzaPreparation(
  checklistItems: ChecklistItem[],
  _readiness: ReadinessSummary,
  documents: DocumentRow[],
  aiChecks: AICheckRow[],
): BzaPreparation {
  const preferredContractCheck = pickPreferred(aiChecks, 'contract_check');
  const preferredOfferCheck    = pickPreferred(aiChecks, 'offer_check');

  const warnings: BzaWarning[] = [];
  let hasBlocking    = false;
  let hasNeedsReview = false;

  // ── 1. Before-application document checklist ──────────────────────────────
  const beforeApp = checklistItems.filter(
    (i) => i.phase === 'before_application' && i.required,
  );
  for (const item of beforeApp) {
    if (item.status === 'missing') {
      hasBlocking = true;
      warnings.push({ level: 'error', message: `${item.label_de}: fehlt` });
    } else if (item.status === 'rejected') {
      hasBlocking = true;
      warnings.push({ level: 'error', message: `${item.label_de}: abgelehnt – korrigieren und neu hochladen` });
    } else if (item.status === 'needs_review') {
      hasNeedsReview = true;
      warnings.push({ level: 'warning', message: `${item.label_de}: noch nicht geprüft` });
    }
  }

  // ── 2. Contract AI check ──────────────────────────────────────────────────
  if (preferredContractCheck) {
    if (preferredContractCheck.human_review_status === 'rejected') {
      hasBlocking = true;
      warnings.push({ level: 'error', message: 'Vertragsprüfung abgelehnt – Vertrag muss korrigiert werden' });
    } else if (preferredContractCheck.human_review_status === 'pending') {
      hasNeedsReview = true;
      warnings.push({ level: 'warning', message: 'Vertragsprüfung noch nicht freigegeben' });
    }
    const cr = rjObj(preferredContractCheck);
    const fr = sub(cr, 'funding_reservation');
    if (fr && !fr.present) {
      hasBlocking = true;
      warnings.push({ level: 'error', message: 'Fördervorbehalt fehlt im Vertrag' });
    }
    const ps = sub(cr, 'premature_start_risk');
    if (ps?.detected) {
      hasBlocking = true;
      warnings.push({ level: 'error', message: 'Vorzeitiger Beginn erkannt – Vertrag muss angepasst werden' });
    }
  } else {
    const hasContractDoc = documents.some(
      (d) => d.type === 'contract' && d.status !== 'missing',
    );
    if (hasContractDoc) {
      warnings.push({ level: 'info', message: 'Optionale KI-Vertragsprüfung noch nicht durchgeführt' });
    }
  }

  // ── 3. Offer AI check ─────────────────────────────────────────────────────
  if (preferredOfferCheck) {
    if (preferredOfferCheck.human_review_status === 'rejected') {
      hasBlocking = true;
      warnings.push({ level: 'error', message: 'Angebotsprüfung abgelehnt – Angebot muss korrigiert werden' });
    } else if (preferredOfferCheck.human_review_status === 'pending') {
      hasNeedsReview = true;
      warnings.push({ level: 'warning', message: 'Angebotsprüfung noch nicht freigegeben' });
    }
    const or_ = rjObj(preferredOfferCheck);
    const hp   = sub(or_, 'heat_pump');
    if (hp && !hp.present) {
      warnings.push({ level: 'warning', message: 'Wärmepumpenmodell nicht erkennbar im Angebot' });
    }
    const costs = sub(or_, 'costs');
    if (costs && !costs.net_amount && !costs.gross_amount) {
      warnings.push({ level: 'warning', message: 'Kosten nicht erkennbar im Angebot' });
    }
    const impl = sub(or_, 'implementation_period');
    if (impl && !impl.present) {
      warnings.push({ level: 'info', message: 'Ausführungszeitraum nicht erkennbar im Angebot' });
    }
    const scope = sub(or_, 'eligible_scope_indicators');
    if (scope && !scope.hydraulic_balancing_present) {
      warnings.push({ level: 'info', message: 'Hydraulischer Abgleich nicht erkennbar im Angebot' });
    }
  } else {
    const hasOfferDoc = documents.some(
      (d) => d.type === 'offer' && d.status !== 'missing',
    );
    if (hasOfferDoc) {
      warnings.push({ level: 'info', message: 'Optionale KI-Angebotsprüfung noch nicht durchgeführt' });
    }
  }

  const readinessStatus: BzaReadinessStatus =
    hasBlocking    ? 'nicht_bereit' :
    hasNeedsReview ? 'fast_bereit'  :
    'bereit';

  return { readinessStatus, warnings, preferredContractCheck, preferredOfferCheck };
}
