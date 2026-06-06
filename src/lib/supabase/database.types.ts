// ============================================================
// Förderpilot – Supabase database types
//
// This file is the source of truth for database-level typing.
// To regenerate from a live project:
//   npx supabase gen types typescript --project-id <project-id> > src/lib/supabase/database.types.ts
//
// The string union types below must stay in sync with:
//   - lib/types/index.ts        (application-level types)
//   - SQL CHECK constraints     (supabase/migrations/20250606000001_create_schema.sql)
// ============================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ─── DB-level enums (mirrored from CHECK constraints) ────────────────────────

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

export type DbDocumentType =
  | 'energy_certificate'
  | 'building_permit'
  | 'offer'
  | 'contract'
  | 'proof_of_completion'
  | 'bank_statement'
  | 'other'

export type DbAICheckType =
  | 'eligibility_check'
  | 'document_review'
  | 'cost_plausibility'
  | 'deadline_check'

export type DbAICheckResult = 'passed' | 'warning' | 'failed' | 'pending'

// ─── Database interface ───────────────────────────────────────────────────────

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
      }

      funding_cases: {
        Row: {
          id: string
          company_id: string
          customer_id: string
          title: string
          status: DbFundingCaseStatus
          risk_level: DbRiskLevel
          heat_pump_type: string | null
          estimated_cost: number | null
          funding_amount: number | null
          notes: string | null
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
          heat_pump_type?: string | null
          estimated_cost?: number | null
          funding_amount?: number | null
          notes?: string | null
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
          heat_pump_type?: string | null
          estimated_cost?: number | null
          funding_amount?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }

      documents: {
        Row: {
          id: string
          funding_case_id: string
          name: string
          type: DbDocumentType
          storage_path: string
          file_size_bytes: number | null
          uploaded_by: string
          uploaded_at: string
          created_at: string
        }
        Insert: {
          id?: string
          funding_case_id: string
          name: string
          type: DbDocumentType
          storage_path: string
          file_size_bytes?: number | null
          uploaded_by: string
          uploaded_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          funding_case_id?: string
          name?: string
          type?: DbDocumentType
          storage_path?: string
          file_size_bytes?: number | null
          uploaded_by?: string
          uploaded_at?: string
          created_at?: string
        }
      }

      tasks: {
        Row: {
          id: string
          funding_case_id: string
          title: string
          description: string | null
          assigned_to: string | null
          due_date: string | null
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
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }

      ai_checks: {
        Row: {
          id: string
          funding_case_id: string
          check_type: DbAICheckType
          result: DbAICheckResult
          details: string
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          funding_case_id: string
          check_type: DbAICheckType
          result?: DbAICheckResult
          details: string
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          funding_case_id?: string
          check_type?: DbAICheckType
          result?: DbAICheckResult
          details?: string
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
