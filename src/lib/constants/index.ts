import type { FundingCaseStatus, RiskLevel, DocumentType, AICheckType } from '@/lib/types';

export const STATUS_LABELS: Record<FundingCaseStatus, string> = {
  lead_received: 'Lead erhalten',
  data_missing: 'Daten fehlen',
  funding_check_done: 'Förderprüfung erledigt',
  offer_created: 'Angebot erstellt',
  contract_review_needed: 'Vertragsprüfung nötig',
  contract_signed: 'Vertrag unterzeichnet',
  bza_prepared: 'BZA vorbereitet',
  application_submitted: 'Antrag gestellt',
  approval_received: 'Genehmigung erhalten',
  execution_released: 'Ausführung freigegeben',
  proof_documents_pending: 'Nachweise ausstehend',
  proof_submitted: 'Nachweise eingereicht',
  completed: 'Abgeschlossen',
};

export const STATUS_PHASES: {
  label: string;
  statuses: FundingCaseStatus[];
}[] = [
  {
    label: 'Ersterfassung',
    statuses: ['lead_received', 'data_missing', 'funding_check_done'],
  },
  {
    label: 'Angebot & Vertrag',
    statuses: ['offer_created', 'contract_review_needed', 'contract_signed'],
  },
  {
    label: 'BZA & Antrag',
    statuses: ['bza_prepared', 'application_submitted'],
  },
  {
    label: 'Genehmigung & Ausführung',
    statuses: ['approval_received', 'execution_released'],
  },
  {
    label: 'Nachweise & Abschluss',
    statuses: ['proof_documents_pending', 'proof_submitted', 'completed'],
  },
];

export const RISK_LABELS: Record<RiskLevel, string> = {
  green: 'Grün',
  yellow: 'Gelb',
  red: 'Rot',
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  energy_certificate: 'Energieausweis',
  building_permit: 'Baugenehmigung',
  offer: 'Angebot',
  contract: 'Vertrag',
  proof_of_completion: 'Ausführungsnachweis',
  bank_statement: 'Kontoauszug',
  other: 'Sonstiges',
};

export const AI_CHECK_TYPE_LABELS: Record<AICheckType, string> = {
  eligibility_check: 'Förderfähigkeitsprüfung',
  document_review: 'Dokumentenprüfung',
  cost_plausibility: 'Kostenplausibilität',
  deadline_check: 'Fristenprüfung',
};
