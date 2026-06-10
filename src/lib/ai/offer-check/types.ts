import { z } from 'zod';

// ─── Coercion helpers ─────────────────────────────────────────────────────────
// AI models sometimes return strings where arrays are expected, or omit optional
// fields entirely. These helpers make parsing resilient without changing the
// TypeScript output types.

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

export const OfferCheckResultSchema = z.object({
  overall_assessment: z.enum(['pass', 'needs_revision', 'critical']).catch('needs_revision'),
  risk_level: z.enum(['green', 'yellow', 'red']).catch('yellow'),
  summary_de: z.string().min(1).catch('Keine Zusammenfassung verfügbar.'),
  detected_document_type: coerceNullableString(),

  project_parties: z.object({
    customer_name:   coerceNullableString(),
    contractor_name: coerceNullableString(),
    project_address: coerceNullableString(),
  }).catch({ customer_name: null, contractor_name: null, project_address: null }),

  heat_pump: z.object({
    present:       coerceBool(),
    manufacturer:  coerceNullableString(),
    model:         coerceNullableString(),
    type:          coerceNullableString(),
    assessment_de: z.string().catch('Nicht prüfbar.'),
  }).catch({ present: false, manufacturer: null, model: null, type: null, assessment_de: 'Nicht prüfbar.' }),

  costs: z.object({
    net_amount:    coerceNullableString(),
    gross_amount:  coerceNullableString(),
    vat_rate:      coerceNullableString(),
    assessment_de: z.string().catch('Nicht prüfbar.'),
  }).catch({ net_amount: null, gross_amount: null, vat_rate: null, assessment_de: 'Nicht prüfbar.' }),

  eligible_scope_indicators: z.object({
    demolition_old_heating_present: coerceBool(),
    hydraulic_balancing_present:    coerceBool(),
    commissioning_present:          coerceBool(),
    electrical_work_present:        coerceBool(),
    buffer_or_storage_present:      coerceBool(),
    environmental_measures_present: coerceBool(),
    assessment_de:                  z.string().catch('Nicht prüfbar.'),
  }).catch({
    demolition_old_heating_present: false,
    hydraulic_balancing_present:    false,
    commissioning_present:          false,
    electrical_work_present:        false,
    buffer_or_storage_present:      false,
    environmental_measures_present: false,
    assessment_de:                  'Nicht prüfbar.',
  }),

  implementation_period: z.object({
    present:       coerceBool(),
    excerpt_de:    coerceNullableString(),
    assessment_de: z.string().catch('Nicht prüfbar.'),
  }).catch({ present: false, excerpt_de: null, assessment_de: 'Nicht prüfbar.' }),

  missing_or_unclear_items:  coerceArray(),
  critical_findings:         coerceArray(),
  recommended_changes:       coerceArray(),
  recommended_next_steps:    coerceArray(),
  customer_message_draft_de: z.string().catch(''),
  internal_notes_de:         coerceArray(),
  confidence:                z.enum(['low', 'medium', 'high']).catch('low'),
  human_review_required:     z.preprocess(() => true, z.literal(true)),
});

export type OfferCheckResult = z.infer<typeof OfferCheckResultSchema>;

export interface OfferCheckInput {
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
