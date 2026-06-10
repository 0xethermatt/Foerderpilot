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
    (v) => (v === undefined ? null : v),
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
    type: z.enum(['aufschiebend', 'aufloesend', 'both', 'unclear', 'missing']).catch('missing'),
    mentions_kfw_funding_approval: coerceBool(),
    relevant_excerpt_de: coerceNullableString(),
    assessment_de: z.string().catch('Nicht prüfbar.'),
  }).catch({
    present: false,
    type: 'missing' as const,
    mentions_kfw_funding_approval: false,
    relevant_excerpt_de: null,
    assessment_de: 'Nicht prüfbar.',
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
