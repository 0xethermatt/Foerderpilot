// ============================================================
// Förderpilot – Supabase database types
//
// To regenerate from a live project:
//   npx supabase gen types typescript --project-id <id> \
//     > src/lib/supabase/database.types.ts
//
// Keep the string union types below in sync with:
//   - src/lib/types/index.ts  (application types)
//   - SQL CHECK constraints   (supabase/migrations/)
// ============================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ─── DB-level value sets (mirrored from CHECK constraints) ───────────────────

export type DbFundingCaseStatus =
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
  | 'completed'

export type DbRiskLevel = 'green' | 'yellow' | 'red'
export type DbBzaStatus = 'not_started' | 'requested' | 'created'
export type DbKfwApplicationStatus = 'not_started' | 'prepared' | 'submitted' | 'approved'
export type DbImplementationStatus = 'not_started' | 'started' | 'completed'
export type DbProofSubmissionStatus = 'not_started' | 'prepared' | 'submitted'
export type DbPayoutStatus = 'pending' | 'paid'
export type DbBuildingType = 'EFH' | 'MFH' | 'DHH' | 'RH' | 'WHG'
export type DbOwnerStatus = 'owner' | 'owner_community' | 'other'
export type DbCurrentHeatingType = 'gas' | 'oil' | 'electric' | 'district_heat' | 'heat_pump' | 'pellet' | 'other'
export type DbPlannedHeatingType = 'air_water' | 'brine_water' | 'water_water'

export type DbDocumentType =
  | 'offer'
  | 'contract'
  | 'old_heating_photo'
  | 'old_heating_nameplate'
  | 'owner_proof'
  | 'bza'
  | 'kfw_approval'
  | 'invoice'
  | 'bnd'
  | 'other'

export type DbDocumentStatus =
  | 'uploaded'
  | 'needs_review'
  | 'reviewed'
  | 'missing'
  | 'rejected'

export type DbAICheckType = 'funding_precheck' | 'contract_check' | 'offer_check'
export type DbAICheckStatus = 'draft' | 'completed' | 'failed'
export type DbAIHumanReviewStatus = 'pending' | 'approved' | 'rejected'

// ─── Database interface ───────────────────────────────────────────────────────
// GenericSchema shape required by @supabase/postgrest-js:
//   Tables:    Record<string, { Row; Insert; Update; Relationships: [] }>
//   Views:     Record<string, { Row }>
//   Functions: Record<string, { Args; Returns }>

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string
          name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }

      customers: {
        Row: {
          id: string
          company_id: string
          first_name: string
          last_name: string
          email: string
          phone: string | null
          street: string
          city: string
          postal_code: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          first_name: string
          last_name: string
          email: string
          phone?: string | null
          street: string
          city: string
          postal_code: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          first_name?: string
          last_name?: string
          email?: string
          phone?: string | null
          street?: string
          city?: string
          postal_code?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }

      funding_cases: {
        Row: {
          id: string
          company_id: string
          customer_id: string
          title: string
          status: DbFundingCaseStatus
          risk_level: DbRiskLevel
          project_address_street: string | null
          project_address_postal_code: string | null
          project_address_city: string | null
          building_type: DbBuildingType | null
          housing_units: number | null
          owner_status: DbOwnerStatus | null
          self_occupied: boolean | null
          current_heating_type: DbCurrentHeatingType | null
          current_heating_year: number | null
          planned_heating_type: DbPlannedHeatingType | null
          planned_heat_pump_model: string | null
          estimated_cost: number | null
          funding_amount: number | null
          notes: string | null
          bza_responsible_party: string | null
          bza_id: string | null
          bza_created_at: string | null
          bza_status: string
          kfw_application_status: string
          kfw_application_prepared_at: string | null
          kfw_application_reference: string | null
          kfw_approval_received_at: string | null
          implementation_status: string
          implementation_started_at: string | null
          implementation_completed_at: string | null
          bnd_id: string | null
          bnd_created_at: string | null
          proof_submission_status: string
          proof_submitted_at: string | null
          payout_status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          customer_id: string
          title: string
          status?: DbFundingCaseStatus
          risk_level?: DbRiskLevel
          project_address_street?: string | null
          project_address_postal_code?: string | null
          project_address_city?: string | null
          building_type?: DbBuildingType | null
          housing_units?: number | null
          owner_status?: DbOwnerStatus | null
          self_occupied?: boolean | null
          current_heating_type?: DbCurrentHeatingType | null
          current_heating_year?: number | null
          planned_heating_type?: DbPlannedHeatingType | null
          planned_heat_pump_model?: string | null
          estimated_cost?: number | null
          funding_amount?: number | null
          notes?: string | null
          bza_responsible_party?: string | null
          bza_id?: string | null
          bza_created_at?: string | null
          bza_status?: string
          kfw_application_status?: string
          kfw_application_prepared_at?: string | null
          kfw_application_reference?: string | null
          kfw_approval_received_at?: string | null
          implementation_status?: string
          implementation_started_at?: string | null
          implementation_completed_at?: string | null
          bnd_id?: string | null
          bnd_created_at?: string | null
          proof_submission_status?: string
          proof_submitted_at?: string | null
          payout_status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          customer_id?: string
          title?: string
          status?: DbFundingCaseStatus
          risk_level?: DbRiskLevel
          project_address_street?: string | null
          project_address_postal_code?: string | null
          project_address_city?: string | null
          building_type?: DbBuildingType | null
          housing_units?: number | null
          owner_status?: DbOwnerStatus | null
          self_occupied?: boolean | null
          current_heating_type?: DbCurrentHeatingType | null
          current_heating_year?: number | null
          planned_heating_type?: DbPlannedHeatingType | null
          planned_heat_pump_model?: string | null
          estimated_cost?: number | null
          funding_amount?: number | null
          notes?: string | null
          bza_responsible_party?: string | null
          bza_id?: string | null
          bza_created_at?: string | null
          bza_status?: string
          kfw_application_status?: string
          kfw_application_prepared_at?: string | null
          kfw_application_reference?: string | null
          kfw_approval_received_at?: string | null
          implementation_status?: string
          implementation_started_at?: string | null
          implementation_completed_at?: string | null
          bnd_id?: string | null
          bnd_created_at?: string | null
          proof_submission_status?: string
          proof_submitted_at?: string | null
          payout_status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }

      documents: {
        Row: {
          id: string
          funding_case_id: string
          name: string
          type: DbDocumentType
          storage_path: string
          file_size_bytes: number | null
          mime_type: string | null
          status: DbDocumentStatus
          notes: string | null
          uploaded_by: string
          uploaded_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          funding_case_id: string
          name: string
          type: DbDocumentType
          storage_path: string
          file_size_bytes?: number | null
          mime_type?: string | null
          status?: DbDocumentStatus
          notes?: string | null
          uploaded_by: string
          uploaded_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          funding_case_id?: string
          name?: string
          type?: DbDocumentType
          storage_path?: string
          file_size_bytes?: number | null
          mime_type?: string | null
          status?: DbDocumentStatus
          notes?: string | null
          uploaded_by?: string
          uploaded_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }

      tasks: {
        Row: {
          id: string
          funding_case_id: string
          title: string
          description: string | null
          assigned_to: string | null
          due_date: string | null
          priority: 'low' | 'normal' | 'high'
          completed: boolean
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          funding_case_id: string
          title: string
          description?: string | null
          assigned_to?: string | null
          due_date?: string | null
          priority?: 'low' | 'normal' | 'high'
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          funding_case_id?: string
          title?: string
          description?: string | null
          assigned_to?: string | null
          due_date?: string | null
          priority?: 'low' | 'normal' | 'high'
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }

      ai_checks: {
        Row: {
          id: string
          case_id: string
          check_type: DbAICheckType
          provider: string
          model: string
          status: DbAICheckStatus
          result_json: Json
          summary: string | null
          risk_level: 'green' | 'yellow' | 'red' | null
          confidence: 'low' | 'medium' | 'high' | null
          human_review_status: DbAIHumanReviewStatus
          reviewed_by: string | null
          reviewed_at: string | null
          rule_version: string
          sources_used: Json
          disclaimer: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          case_id: string
          check_type: DbAICheckType
          provider: string
          model: string
          status?: DbAICheckStatus
          result_json: Json
          summary?: string | null
          risk_level?: 'green' | 'yellow' | 'red' | null
          confidence?: 'low' | 'medium' | 'high' | null
          human_review_status?: DbAIHumanReviewStatus
          reviewed_by?: string | null
          reviewed_at?: string | null
          rule_version: string
          sources_used?: Json
          disclaimer: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          case_id?: string
          check_type?: DbAICheckType
          provider?: string
          model?: string
          status?: DbAICheckStatus
          result_json?: Json
          summary?: string | null
          risk_level?: 'green' | 'yellow' | 'red' | null
          confidence?: 'low' | 'medium' | 'high' | null
          human_review_status?: DbAIHumanReviewStatus
          reviewed_by?: string | null
          reviewed_at?: string | null
          rule_version?: string
          sources_used?: Json
          disclaimer?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }

      audit_log: {
        Row: {
          id: string
          funding_case_id: string
          field: string
          old_value: string | null
          new_value: string | null
          changed_by: string
          created_at: string
        }
        Insert: {
          id?: string
          funding_case_id: string
          field: string
          old_value?: string | null
          new_value?: string | null
          changed_by?: string
          created_at?: string
        }
        Update: {
          id?: string
          funding_case_id?: string
          field?: string
          old_value?: string | null
          new_value?: string | null
          changed_by?: string
          created_at?: string
        }
        Relationships: []
      }

      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }

      company_members: {
        Row: {
          id: string
          company_id: string
          user_id: string
          role: 'owner' | 'admin' | 'member'
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          user_id: string
          role?: 'owner' | 'admin' | 'member'
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          user_id?: string
          role?: 'owner' | 'admin' | 'member'
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      auth_user_company_ids: {
        Args: Record<string, never>
        Returns: string[]
      }
    }
  }
}
