import type { Database } from '@/lib/supabase/database.types';

type FundingCaseRow = Database['public']['Tables']['funding_cases']['Row'];

export type KfwProofStep =
  | 'waiting_for_approval'
  | 'approval_received'
  | 'implementation_started'
  | 'implementation_completed'
  | 'bnd_entered'
  | 'proof_prepared'
  | 'proof_submitted'
  | 'payout_received';

export interface KfwProofSubmissionState {
  currentStep: KfwProofStep;
  kfwApplicationStatus: string;
  kfwApprovalReceivedAt: string | null;
  implementationStatus: string;
  implementationStartedAt: string | null;
  implementationCompletedAt: string | null;
  bndId: string | null;
  bndCreatedAt: string | null;
  bndIdPlausible: boolean;
  proofSubmissionStatus: string;
  proofSubmittedAt: string | null;
  payoutStatus: string;
  nextActionLabel: string;
}

export function isBndIdPlausible(bndId: string | null | undefined): boolean {
  if (!bndId) return false;
  return /^\d{15}$/.test(bndId.replace(/[\s\-._]/g, ''));
}

export function computeKfwProofSubmissionState(
  fundingCase: FundingCaseRow,
): KfwProofSubmissionState {
  const kfwStatus    = fundingCase.kfw_application_status ?? 'not_started';
  const implStatus   = fundingCase.implementation_status ?? 'not_started';
  const proofStatus  = fundingCase.proof_submission_status ?? 'not_started';
  const payoutStatus = fundingCase.payout_status ?? 'pending';
  const bndId        = fundingCase.bnd_id ?? null;
  const bndIdPlausible = isBndIdPlausible(bndId);

  let currentStep: KfwProofStep;
  let nextActionLabel: string;

  if (payoutStatus === 'paid') {
    currentStep = 'payout_received';
    nextActionLabel = 'Auszahlung eingegangen – Fall abschließen';
  } else if (proofStatus === 'submitted') {
    currentStep = 'proof_submitted';
    nextActionLabel = 'Auf KfW-Auszahlung warten';
  } else if (proofStatus === 'prepared') {
    currentStep = 'proof_prepared';
    nextActionLabel = 'Nachweise durch Kunden in „Meine KfW" einreichen lassen';
  } else if (bndIdPlausible) {
    currentStep = 'bnd_entered';
    nextActionLabel = 'Nachweise intern vorbereiten und Kundenanweisung senden';
  } else if (implStatus === 'completed') {
    currentStep = 'implementation_completed';
    nextActionLabel = 'BnD-ID eintragen (Bestätigung nach Durchführung)';
  } else if (implStatus === 'started') {
    currentStep = 'implementation_started';
    nextActionLabel = 'Umsetzung durch Fachunternehmen abschließen lassen';
  } else if (kfwStatus === 'approved') {
    currentStep = 'approval_received';
    nextActionLabel = 'Umsetzung starten';
  } else {
    currentStep = 'waiting_for_approval';
    nextActionLabel = 'Auf KfW-Förderzusage warten – kein Vorhabenbeginn';
  }

  return {
    currentStep,
    kfwApplicationStatus:    kfwStatus,
    kfwApprovalReceivedAt:   fundingCase.kfw_approval_received_at ?? null,
    implementationStatus:    implStatus,
    implementationStartedAt: fundingCase.implementation_started_at ?? null,
    implementationCompletedAt: fundingCase.implementation_completed_at ?? null,
    bndId,
    bndCreatedAt:            fundingCase.bnd_created_at ?? null,
    bndIdPlausible,
    proofSubmissionStatus:   proofStatus,
    proofSubmittedAt:        fundingCase.proof_submitted_at ?? null,
    payoutStatus,
    nextActionLabel,
  };
}
