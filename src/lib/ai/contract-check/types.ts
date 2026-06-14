import { z } from 'zod';

// ─── Coercion helpers ─────────────────────────────────────────────────────────

function coerceArray() {
  return z.preprocess((v) => {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') return v ? [v] : [];
    return [];
  }, z.array(z.string()));
}

function coerceNullableString() {
  return z.preprocess(
    (v) => {
      if (v === undefined || v === null) return null;
      if (typeof v === 'string') return v;
      if (Array.isArray(v)) return v.filter((s) => typeof s === 'string').join('\n...\n') || null;
      return null;
    },
    z.string().nullable(),
  );
}

function coerceBool() {
  return z.preprocess((v) => {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') return ['true', 'ja', 'yes', '1'].includes(v.toLowerCase());
    if (v === undefined || v === null) return false;
    return Boolean(v);
  }, z.boolean());
}

// ─── Funding reservation type normalizer ──────────────────────────────────────
// The AI occasionally returns descriptive variants instead of the canonical
// enum values. Normalize before Zod sees the value so the enum never fails.

type FundingReservationType = 'aufschiebend' | 'aufloesend' | 'both' | 'unclear' | 'missing';

function normalizeFundingReservationType(v: unknown): FundingReservationType {
  if (typeof v !== 'string') return 'unclear';
  const s = v.toLowerCase().trim();

  // Canonical pass-throughs
  if (s === 'both')       return 'both';
  if (s === 'beide')      return 'both';
  if (s === 'unclear')    return 'unclear';
  if (s === 'missing')    return 'missing';
  if (s === 'aufschiebend') return 'aufschiebend';
  if (s === 'aufloesend')   return 'aufloesend';

  // "both" variants: contains aufschiebend AND (auflös|aufloesend)
  const hasAuf  = /aufschiebend/.test(s);
  const hasAufl = /aufl[oö]s|aufloesend/.test(s);
  if (hasAuf && hasAufl) return 'both';

  // Single aufschiebend
  if (hasAuf)  return 'aufschiebend';

  // Single auflösend / aufloesend
  if (hasAufl) return 'aufloesend';

  // Unknown variant → unclear (not missing — existence is unknown, not absent)
  return 'unclear';
}

// ─── Text-based consistency helpers ───────────────────────────────────────────

const RESERVATION_PRESENT_HINTS = [
  /fördervorbehalt[\s\S]{0,60}(vorhanden|enthalten|formuliert|erkannt|ausdrücklich)/i,
  /enthält[\s\S]{0,40}fördervorbehalt/i,
  /aufschiebende[\s\S]{0,30}bedingung[\s\S]{0,60}(kfw|förder)/i,
  /auflösende[\s\S]{0,30}bedingung[\s\S]{0,60}(kfw|förder)/i,
  /aufloesende[\s\S]{0,30}bedingung[\s\S]{0,60}(kfw|förder)/i,
  /sowohl[\s\S]{0,40}aufschiebend[\s\S]{0,40}aufl[oö]s/i,
  /§[\s\S]{0,10}(4\.1|4\.3|förder)/i,  // paragraph references for funding conditions
];

const RESERVATION_ABSENT_HINTS = [
  /fördervorbehalt[\s\S]{0,40}fehlt/i,
  /kein(?:en?)?\s+fördervorbehalt/i,
  /fördervorbehalt[\s\S]{0,40}nicht\s+(vorhanden|enthalten)/i,
];

function textIndicatesReservationPresent(summary: string, assessment: string): boolean {
  const text = `${summary} ${assessment}`;
  const positive = RESERVATION_PRESENT_HINTS.some((r) => r.test(text));
  const negative = RESERVATION_ABSENT_HINTS.some((r) => r.test(text));
  return positive && !negative;
}

function inferTypeFromText(summary: string, assessment: string): FundingReservationType {
  const text = `${summary} ${assessment}`;
  const hasBoth =
    /sowohl[\s\S]{0,80}aufschiebend[\s\S]{0,80}aufl[oö]s/i.test(text) ||
    /sowohl[\s\S]{0,80}aufl[oö]s[\s\S]{0,80}aufschiebend/i.test(text) ||
    (/aufschiebend/.test(text) && /aufl[oö]s|aufloesend/.test(text));
  if (hasBoth) return 'both';
  if (/aufschiebende?\s+bedingung/i.test(text)) return 'aufschiebend';
  if (/aufl[oö]sende?\s+bedingung|aufloesende\s+bedingung/i.test(text)) return 'aufloesend';
  return 'unclear';
}

// ─── Result schema ────────────────────────────────────────────────────────────

export const ContractCheckResultSchema = z.object({
  overall_assessment: z.enum(['pass', 'needs_revision', 'critical']).catch('needs_revision'),
  risk_level: z.enum(['green', 'yellow', 'red']).catch('yellow'),
  summary_de: z.string().min(1).catch('Keine Zusammenfassung verfügbar.'),
  detected_contract_type: coerceNullableString(),

  contract_parties: z.object({
    customer_name:   coerceNullableString(),
    contractor_name: coerceNullableString(),
    project_address: coerceNullableString(),
  }).catch({ customer_name: null, contractor_name: null, project_address: null }),

  funding_reservation: z.object({
    present: coerceBool(),
    // Preprocess normalizes all type variants before the enum sees them.
    // The enum itself has no .catch() — if normalization fails we get 'unclear',
    // never 'missing', so present=true is not silently erased.
    type: z.preprocess(
      normalizeFundingReservationType,
      z.enum(['aufschiebend', 'aufloesend', 'both', 'unclear', 'missing']),
    ),
    mentions_kfw_funding_approval: coerceBool(),
    relevant_excerpt_de: coerceNullableString(),
    assessment_de: z.string().catch('Nicht prüfbar.'),
  }).catch((err) => {
    // Only fires when funding_reservation itself is null/missing/not-an-object.
    // Field-level coercions above handle individual bad values without reaching here.
    console.error('[ContractCheck] funding_reservation object-level parse failed:', err.error?.message ?? err);
    return {
      present: false as const,
      type: 'missing' as const,
      mentions_kfw_funding_approval: false,
      relevant_excerpt_de: null,
      assessment_de: 'Nicht prüfbar.',
    };
  }),

  premature_start_risk: z.object({
    detected: coerceBool(),
    severity: z.enum(['none', 'low', 'medium', 'high']).catch('none'),
    problematic_excerpt_de: coerceNullableString(),
    assessment_de: z.string().catch('Nicht prüfbar.'),
  }).catch({ detected: false, severity: 'none' as const, problematic_excerpt_de: null, assessment_de: 'Nicht prüfbar.' }),

  implementation_period: z.object({
    present:       coerceBool(),
    excerpt_de:    coerceNullableString(),
    assessment_de: z.string().catch('Nicht prüfbar.'),
  }).catch({ present: false, excerpt_de: null, assessment_de: 'Nicht prüfbar.' }),

  missing_or_unclear_items:  coerceArray(),
  critical_findings:         coerceArray(),
  recommended_changes:       coerceArray(),
  safe_clause_suggestion_de: coerceNullableString(),
  recommended_next_steps:    coerceArray(),
  customer_message_draft_de: z.string().catch(''),
  internal_notes_de:         coerceArray(),
  confidence:                z.enum(['low', 'medium', 'high']).catch('low'),
  human_review_required:     z.preprocess(() => true, z.literal(true)),
}).transform((data) => {
  const fr = data.funding_reservation;

  // ── Layer 1: text-based repair ──────────────────────────────────────────────
  // If the AI's summary or assessment text clearly states the funding reservation
  // is present but the structured field disagrees, trust the text.
  // This repairs AI inconsistencies where Claude writes a correct summary but
  // then marks present=false in the structured output.
  if (!fr.present && textIndicatesReservationPresent(data.summary_de, fr.assessment_de)) {
    const inferredType = fr.type === 'missing' || fr.type === 'unclear'
      ? inferTypeFromText(data.summary_de, fr.assessment_de)
      : fr.type;
    console.warn(
      '[ContractCheck] funding_reservation.present=false contradicts text evidence; ' +
      `repairing to present=true type=${inferredType}`,
    );
    return {
      ...data,
      funding_reservation: { ...fr, present: true, type: inferredType },
    };
  }

  // ── Layer 2: cross-field guard ──────────────────────────────────────────────
  // Per KfW rules: absent funding reservation → assessment must not be pass.
  // Only reaches here when text gives no positive evidence (genuine AI error).
  if (!fr.present && data.overall_assessment === 'pass') {
    console.warn(
      '[ContractCheck] Cross-field inconsistency: overall_assessment=pass with ' +
      'funding_reservation.present=false and no text evidence of presence; ' +
      'downgrading to needs_revision.',
    );
    return {
      ...data,
      overall_assessment: 'needs_revision' as const,
      risk_level: data.risk_level === 'green' ? ('yellow' as const) : data.risk_level,
    };
  }

  return data;
});

export type ContractCheckResult = z.infer<typeof ContractCheckResultSchema>;

export interface ContractCheckInput {
  caseId: string;
  documentId: string;
  documentName: string;
  extractedText: string;
  pageCount?: number;
  extractionStatus: 'success' | 'empty' | 'failed';
  caseTitle: string;
  projectCity: string | null;
  projectPostalCode: string | null;
}
