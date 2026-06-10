import { z } from 'zod';

// ─── Input ────────────────────────────────────────────────────────────────────

export interface FundingPrecheckInput {
  // Case
  caseId: string;
  caseTitle: string;
  caseStatus: string;
  caseRiskLevel: string;
  // Project address
  projectCity: string | null;
  projectPostalCode: string | null;
  // Building
  buildingType: string | null;
  housingUnits: number | null;
  ownerStatus: string | null;
  selfOccupied: boolean | null;
  // Heating
  currentHeatingType: string | null;
  currentHeatingYear: number | null;
  plannedHeatingType: string | null;
  plannedHeatPumpModel: string | null;
  // Financials
  estimatedCost: number | null;
  fundingAmount: number | null;
  notes: string | null;
  // Customer fallback location
  customerCity: string;
  customerPostalCode: string;
  // Checklist
  readinessState: string;
  reviewedCount: number;
  totalRequiredBeforeApp: number;
  blockingCount: number;
  // Documents
  uploadedDocumentTypes: string[];
  missingDocumentTypes: string[];
  // Open tasks
  openTaskTitles: string[];
}

// ─── Output schema (Zod) ──────────────────────────────────────────────────────

export const FundingPrecheckResultSchema = z.object({
  overall_assessment: z.enum(['likely_eligible', 'unclear', 'critical']),
  risk_level: z.enum(['green', 'yellow', 'red']),
  summary_de: z.string().min(1),
  missing_information: z.array(z.string()),
  blocking_items: z.array(z.string()),
  possible_bonuses: z.array(
    z.object({
      name: z.string(),
      status: z.enum(['possible', 'unclear', 'unlikely']),
      reason_de: z.string(),
    }),
  ),
  detected_risks: z.array(
    z.object({
      severity: z.enum(['low', 'medium', 'high']),
      risk_de: z.string(),
      recommended_action_de: z.string(),
    }),
  ),
  recommended_next_steps: z.array(z.string()),
  customer_message_draft_de: z.string(),
  internal_notes_de: z.array(z.string()),
  confidence: z.enum(['low', 'medium', 'high']),
  human_review_required: z.literal(true),
});

export type FundingPrecheckResult = z.infer<typeof FundingPrecheckResultSchema>;

// ─── Provider interface ───────────────────────────────────────────────────────

export type { ContractCheckInput, ContractCheckResult } from './contract-check/types';
export { ContractCheckResultSchema } from './contract-check/types';

export type { OfferCheckInput, OfferCheckResult } from './offer-check/types';
export { OfferCheckResultSchema } from './offer-check/types';

import type { ContractCheckInput, ContractCheckResult } from './contract-check/types';
import type { OfferCheckInput, OfferCheckResult } from './offer-check/types';

export interface AIReasoningProvider {
  readonly providerName: string;
  readonly modelName: string;
  runFundingPrecheck(input: FundingPrecheckInput): Promise<FundingPrecheckResult>;
  runContractCheck(input: ContractCheckInput): Promise<ContractCheckResult>;
  runOfferCheck(input: OfferCheckInput): Promise<OfferCheckResult>;
}
