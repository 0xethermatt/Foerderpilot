import type { Database } from '@/lib/supabase/database.types';
import type { ReadinessSummary } from '@/lib/documents/checklist';

type FundingCaseRow = Database['public']['Tables']['funding_cases']['Row'];

export type KfwApplicationStep =
  | 'docs_incomplete'
  | 'bza_needed'
  | 'bza_requested'
  | 'bza_created'
  | 'kfw_prepared'
  | 'kfw_submitted'
  | 'kfw_approved';

export interface KfwApplicationPreparationState {
  currentStep: KfwApplicationStep;
  bzaStatus: string;
  kfwApplicationStatus: string;
  bzaId: string | null;
  bzaCreatedAt: string | null;
  kfwApplicationPreparedAt: string | null;
  kfwApplicationReference: string | null;
  bzaResponsibleParty: string | null;
  isReadyForKfwPreparation: boolean;
  nextActionLabel: string;
}

export function computeKfwApplicationPreparationState(
  fundingCase: FundingCaseRow,
  readiness: ReadinessSummary,
): KfwApplicationPreparationState {
  const bzaStatus = fundingCase.bza_status ?? 'not_started';
  const kfwStatus = fundingCase.kfw_application_status ?? 'not_started';
  const docsComplete = readiness.blocking_count === 0 && readiness.needs_review_count === 0;

  let currentStep: KfwApplicationStep;
  let nextActionLabel: string;

  if (!docsComplete) {
    currentStep = 'docs_incomplete';
    nextActionLabel = 'Pflichtunterlagen vervollständigen und prüfen';
  } else if (kfwStatus === 'approved') {
    currentStep = 'kfw_approved';
    nextActionLabel = 'Förderzusage liegt vor – Ausführung freigeben';
  } else if (kfwStatus === 'submitted') {
    currentStep = 'kfw_submitted';
    nextActionLabel = 'Auf KfW-Förderzusage warten – kein Vorhabenbeginn';
  } else if (kfwStatus === 'prepared') {
    currentStep = 'kfw_prepared';
    nextActionLabel = 'Antragsanweisung an Kunden senden, Einreichung in „Meine KfW" veranlassen';
  } else if (bzaStatus === 'created') {
    currentStep = 'bza_created';
    nextActionLabel = 'KfW-Antrag intern vorbereiten und Kundenanweisung generieren';
  } else if (bzaStatus === 'requested') {
    currentStep = 'bza_requested';
    nextActionLabel = 'Auf BzA warten – BzA-Referenznummer vom Fachunternehmen eintragen';
  } else {
    currentStep = 'bza_needed';
    nextActionLabel = 'BzA beim Fachunternehmen / Energieeffizienz-Experten anfordern';
  }

  return {
    currentStep,
    bzaStatus,
    kfwApplicationStatus: kfwStatus,
    bzaId: fundingCase.bza_id ?? null,
    bzaCreatedAt: fundingCase.bza_created_at ?? null,
    kfwApplicationPreparedAt: fundingCase.kfw_application_prepared_at ?? null,
    kfwApplicationReference: fundingCase.kfw_application_reference ?? null,
    bzaResponsibleParty: fundingCase.bza_responsible_party ?? null,
    isReadyForKfwPreparation: docsComplete && bzaStatus === 'created',
    nextActionLabel,
  };
}
