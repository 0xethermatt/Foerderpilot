import { z } from 'zod';

export const OfferCheckResultSchema = z.object({
  overall_assessment: z.enum(['pass', 'needs_revision', 'critical']),
  risk_level: z.enum(['green', 'yellow', 'red']),
  summary_de: z.string().min(1),
  detected_document_type: z.string().nullable(),
  project_parties: z.object({
    customer_name: z.string().nullable(),
    contractor_name: z.string().nullable(),
    project_address: z.string().nullable(),
  }),
  heat_pump: z.object({
    present: z.boolean(),
    manufacturer: z.string().nullable(),
    model: z.string().nullable(),
    type: z.string().nullable(),
    assessment_de: z.string(),
  }),
  costs: z.object({
    net_amount: z.string().nullable(),
    gross_amount: z.string().nullable(),
    vat_rate: z.string().nullable(),
    assessment_de: z.string(),
  }),
  eligible_scope_indicators: z.object({
    demolition_old_heating_present: z.boolean(),
    hydraulic_balancing_present: z.boolean(),
    commissioning_present: z.boolean(),
    electrical_work_present: z.boolean(),
    buffer_or_storage_present: z.boolean(),
    environmental_measures_present: z.boolean(),
    assessment_de: z.string(),
  }),
  implementation_period: z.object({
    present: z.boolean(),
    excerpt_de: z.string().nullable(),
    assessment_de: z.string(),
  }),
  missing_or_unclear_items: z.array(z.string()),
  critical_findings: z.array(z.string()),
  recommended_changes: z.array(z.string()),
  recommended_next_steps: z.array(z.string()),
  customer_message_draft_de: z.string(),
  internal_notes_de: z.array(z.string()),
  confidence: z.enum(['low', 'medium', 'high']),
  human_review_required: z.literal(true),
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
