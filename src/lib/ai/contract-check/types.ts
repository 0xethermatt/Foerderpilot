import { z } from 'zod';

export const ContractCheckResultSchema = z.object({
  overall_assessment: z.enum(['pass', 'needs_revision', 'critical']),
  risk_level: z.enum(['green', 'yellow', 'red']),
  summary_de: z.string().min(1),
  detected_contract_type: z.string().nullable(),
  contract_parties: z.object({
    customer_name: z.string().nullable(),
    contractor_name: z.string().nullable(),
    project_address: z.string().nullable(),
  }),
  funding_reservation: z.object({
    present: z.boolean(),
    type: z.enum(['aufschiebend', 'aufloesend', 'both', 'unclear', 'missing']),
    mentions_kfw_funding_approval: z.boolean(),
    relevant_excerpt_de: z.string().nullable(),
    assessment_de: z.string(),
  }),
  premature_start_risk: z.object({
    detected: z.boolean(),
    severity: z.enum(['none', 'low', 'medium', 'high']),
    problematic_excerpt_de: z.string().nullable(),
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
  safe_clause_suggestion_de: z.string().nullable(),
  recommended_next_steps: z.array(z.string()),
  customer_message_draft_de: z.string(),
  internal_notes_de: z.array(z.string()),
  confidence: z.enum(['low', 'medium', 'high']),
  human_review_required: z.literal(true),
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
