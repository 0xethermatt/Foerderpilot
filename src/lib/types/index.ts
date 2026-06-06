// ─── Status & Risk ────────────────────────────────────────────────────────────

export type FundingCaseStatus =
  | 'lead_received'
  | 'data_missing'
  | 'funding_check_done'
  | 'offer_created'
  | 'contract_review_needed'
  | 'contract_signed'
  | 'bza_prepared'
  | 'application_submitted'
  | 'approval_received'
  | 'execution_released'
  | 'proof_documents_pending'
  | 'proof_submitted'
  | 'completed';

export type RiskLevel = 'green' | 'yellow' | 'red';

// ─── Building & Heating ───────────────────────────────────────────────────────

export type BuildingType = 'EFH' | 'MFH' | 'DHH' | 'RH' | 'WHG';

export type OwnerStatus = 'owner' | 'owner_community' | 'other';

export type CurrentHeatingType =
  | 'gas'
  | 'oil'
  | 'electric'
  | 'district_heat'
  | 'heat_pump'
  | 'pellet'
  | 'other';

export type PlannedHeatingType = 'air_water' | 'brine_water' | 'water_water';

// ─── Document ─────────────────────────────────────────────────────────────────

export type DocumentType =
  | 'energy_certificate'
  | 'building_permit'
  | 'offer'
  | 'contract'
  | 'proof_of_completion'
  | 'bank_statement'
  | 'other';

// ─── AI Check ─────────────────────────────────────────────────────────────────

export type AICheckType =
  | 'eligibility_check'
  | 'document_review'
  | 'cost_plausibility'
  | 'deadline_check';

export type AICheckResult = 'passed' | 'warning' | 'failed' | 'pending';

// ─── Entities ─────────────────────────────────────────────────────────────────

export interface Company {
  id: string;
  name: string;
  created_at: string;
}

export interface Customer {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  street: string;
  city: string;
  postal_code: string;
  created_at: string;
  updated_at: string;
}

export interface FundingCase {
  id: string;
  customer_id: string;
  company_id: string;
  title: string;
  status: FundingCaseStatus;
  risk_level: RiskLevel;

  // project location
  project_address_street?: string;
  project_address_postal_code?: string;
  project_address_city?: string;

  // building
  building_type?: BuildingType;
  housing_units?: number;
  owner_status?: OwnerStatus;
  self_occupied?: boolean;

  // heating
  current_heating_type?: CurrentHeatingType;
  current_heating_year?: number;
  planned_heating_type?: PlannedHeatingType;
  planned_heat_pump_model?: string;

  // costs
  estimated_cost?: number;
  funding_amount?: number;

  // legacy field kept for mock data compatibility
  heat_pump_type?: string;

  notes?: string;
  created_at: string;
  updated_at: string;

  // joined / computed
  customer?: Customer;
  open_task_count?: number;
}

export interface Document {
  id: string;
  funding_case_id: string;
  name: string;
  type: DocumentType;
  storage_path: string;
  file_size_bytes?: number;
  uploaded_by: string;
  uploaded_at: string;
}

export interface Task {
  id: string;
  funding_case_id: string;
  title: string;
  description?: string;
  assigned_to?: string;
  due_date?: string;
  completed: boolean;
  completed_at?: string;
  created_at: string;
}

export interface AICheck {
  id: string;
  funding_case_id: string;
  check_type: AICheckType;
  result: AICheckResult;
  details: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
}
