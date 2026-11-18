export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ai_analysis_runs: {
        Row: {
          analysis_type: string
          completed_at: string | null
          confidence_level: string | null
          conversation_id: string | null
          created_at: string
          farm_id: string
          id: string
          input_refs: Json
          model_id: string | null
          result_payload: Json
          result_summary: string | null
          safety_flags: Json
          started_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          analysis_type: string
          completed_at?: string | null
          confidence_level?: string | null
          conversation_id?: string | null
          created_at?: string
          farm_id: string
          id?: string
          input_refs?: Json
          model_id?: string | null
          result_payload?: Json
          result_summary?: string | null
          safety_flags?: Json
          started_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          analysis_type?: string
          completed_at?: string | null
          confidence_level?: string | null
          conversation_id?: string | null
          created_at?: string
          farm_id?: string
          id?: string
          input_refs?: Json
          model_id?: string | null
          result_payload?: Json
          result_summary?: string | null
          safety_flags?: Json
          started_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_analysis_runs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_analysis_runs_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_analysis_runs_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_analysis_runs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversation_credit_ledger: {
        Row: {
          created_at: string
          delta_units: number
          description_code: string | null
          entry_type: string
          id: string
          idempotency_key: string
          metadata: Json
          period_end: string | null
          period_start: string | null
          usage_event_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delta_units: number
          description_code?: string | null
          entry_type: string
          id?: string
          idempotency_key: string
          metadata?: Json
          period_end?: string | null
          period_start?: string | null
          usage_event_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          delta_units?: number
          description_code?: string | null
          entry_type?: string
          id?: string
          idempotency_key?: string
          metadata?: Json
          period_end?: string | null
          period_start?: string | null
          usage_event_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversation_credit_ledger_usage_event_id_fkey"
            columns: ["usage_event_id"]
            isOneToOne: false
            referencedRelation: "ai_usage_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversation_credit_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          conversation_type: string
          created_at: string
          farm_id: string | null
          id: string
          language_code: string
          status: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_type?: string
          created_at?: string
          farm_id?: string | null
          id?: string
          language_code?: string
          status?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_type?: string
          created_at?: string
          farm_id?: string | null
          id?: string
          language_code?: string
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_infrastructure_cost_entries: {
        Row: {
          amount: number
          cost_basis: string
          currency_code: string
          id: string
          metadata: Json
          period_end: string
          period_start: string
          provider_code: string
          recorded_at: string
          service_category: string
          service_code: string
          source_reference: string | null
        }
        Insert: {
          amount: number
          cost_basis?: string
          currency_code: string
          id?: string
          metadata?: Json
          period_end: string
          period_start: string
          provider_code: string
          recorded_at?: string
          service_category: string
          service_code: string
          source_reference?: string | null
        }
        Update: {
          amount?: number
          cost_basis?: string
          currency_code?: string
          id?: string
          metadata?: Json
          period_end?: string
          period_start?: string
          provider_code?: string
          recorded_at?: string
          service_category?: string
          service_code?: string
          source_reference?: string | null
        }
        Relationships: []
      }
      ai_message_feedback: {
        Row: {
          comment: string | null
          created_at: string
          feedback_code: string | null
          id: string
          message_id: string
          rating: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          feedback_code?: string | null
          id?: string
          message_id: string
          rating: number
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          feedback_code?: string | null
          id?: string
          message_id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_message_feedback_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "ai_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_message_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          content_parts: Json
          conversation_id: string
          created_at: string
          id: string
          latency_ms: number | null
          message_text: string | null
          model_id: string | null
          sender_type: string
          sender_user_id: string | null
          status: string
          token_input: number | null
          token_output: number | null
        }
        Insert: {
          content_parts?: Json
          conversation_id: string
          created_at?: string
          id?: string
          latency_ms?: number | null
          message_text?: string | null
          model_id?: string | null
          sender_type: string
          sender_user_id?: string | null
          status?: string
          token_input?: number | null
          token_output?: number | null
        }
        Update: {
          content_parts?: Json
          conversation_id?: string
          created_at?: string
          id?: string
          latency_ms?: number | null
          message_text?: string | null
          model_id?: string | null
          sender_type?: string
          sender_user_id?: string | null
          status?: string
          token_input?: number | null
          token_output?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_messages_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_messages_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_model_pricing: {
        Row: {
          cached_input_per_million: number | null
          created_at: string
          currency_code: string
          id: string
          image_unit_price: number | null
          input_per_million: number | null
          is_active: boolean
          model_code: string
          notes: string | null
          output_per_million: number | null
          pricing_version: string
          provider_code: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          cached_input_per_million?: number | null
          created_at?: string
          currency_code?: string
          id?: string
          image_unit_price?: number | null
          input_per_million?: number | null
          is_active?: boolean
          model_code: string
          notes?: string | null
          output_per_million?: number | null
          pricing_version: string
          provider_code: string
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          cached_input_per_million?: number | null
          created_at?: string
          currency_code?: string
          id?: string
          image_unit_price?: number | null
          input_per_million?: number | null
          is_active?: boolean
          model_code?: string
          notes?: string | null
          output_per_million?: number | null
          pricing_version?: string
          provider_code?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      ai_model_routing_rules: {
        Row: {
          allow_fallback: boolean
          fallback_model_code: string | null
          id: string
          is_enabled: boolean
          max_input_tokens: number | null
          max_output_tokens: number | null
          preferred_model_code: string | null
          request_class: string
          updated_at: string
        }
        Insert: {
          allow_fallback?: boolean
          fallback_model_code?: string | null
          id?: string
          is_enabled?: boolean
          max_input_tokens?: number | null
          max_output_tokens?: number | null
          preferred_model_code?: string | null
          request_class: string
          updated_at?: string
        }
        Update: {
          allow_fallback?: boolean
          fallback_model_code?: string | null
          id?: string
          is_enabled?: boolean
          max_input_tokens?: number | null
          max_output_tokens?: number | null
          preferred_model_code?: string | null
          request_class?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_models: {
        Row: {
          capability: string
          configuration: Json
          context_limit: number | null
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          model_code: string
          provider_id: string
        }
        Insert: {
          capability: string
          configuration?: Json
          context_limit?: number | null
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          model_code: string
          provider_id: string
        }
        Update: {
          capability?: string
          configuration?: Json
          context_limit?: number | null
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          model_code?: string
          provider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_models_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_platform_budgets: {
        Row: {
          budget_amount: number
          budget_month: string
          budget_scope: string
          created_at: string
          currency_code: string
          hard_limit_enabled: boolean
          id: string
          is_enabled: boolean
          scope_code: string
          updated_at: string
          warning_threshold_percent: number
        }
        Insert: {
          budget_amount: number
          budget_month: string
          budget_scope: string
          created_at?: string
          currency_code?: string
          hard_limit_enabled?: boolean
          id?: string
          is_enabled?: boolean
          scope_code?: string
          updated_at?: string
          warning_threshold_percent?: number
        }
        Update: {
          budget_amount?: number
          budget_month?: string
          budget_scope?: string
          created_at?: string
          currency_code?: string
          hard_limit_enabled?: boolean
          id?: string
          is_enabled?: boolean
          scope_code?: string
          updated_at?: string
          warning_threshold_percent?: number
        }
        Relationships: []
      }
      ai_providers: {
        Row: {
          configuration: Json
          created_at: string
          display_name: string
          id: string
          provider_code: string
          provider_type: string
          secret_ref: string | null
          status: string
          updated_at: string
        }
        Insert: {
          configuration?: Json
          created_at?: string
          display_name: string
          id?: string
          provider_code: string
          provider_type?: string
          secret_ref?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          configuration?: Json
          created_at?: string
          display_name?: string
          id?: string
          provider_code?: string
          provider_type?: string
          secret_ref?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_usage_events: {
        Row: {
          cached_input_tokens: number
          conversation_id: string | null
          cost_basis: string
          created_at: string
          farm_id: string | null
          farmer_credit_units: number | null
          feature_code: string
          id: string
          image_units: number
          input_tokens: number
          latency_ms: number | null
          metadata: Json
          model_code: string
          output_tokens: number
          pricing_version: string | null
          provider_code: string
          provider_cost_amount: number | null
          provider_cost_currency: string
          reasoning_tokens: number
          request_id: string
          status: string
          tool_calls: number
          usage_class: string
          user_id: string
        }
        Insert: {
          cached_input_tokens?: number
          conversation_id?: string | null
          cost_basis?: string
          created_at?: string
          farm_id?: string | null
          farmer_credit_units?: number | null
          feature_code: string
          id?: string
          image_units?: number
          input_tokens?: number
          latency_ms?: number | null
          metadata?: Json
          model_code: string
          output_tokens?: number
          pricing_version?: string | null
          provider_code: string
          provider_cost_amount?: number | null
          provider_cost_currency?: string
          reasoning_tokens?: number
          request_id: string
          status: string
          tool_calls?: number
          usage_class?: string
          user_id: string
        }
        Update: {
          cached_input_tokens?: number
          conversation_id?: string | null
          cost_basis?: string
          created_at?: string
          farm_id?: string | null
          farmer_credit_units?: number | null
          feature_code?: string
          id?: string
          image_units?: number
          input_tokens?: number
          latency_ms?: number | null
          metadata?: Json
          model_code?: string
          output_tokens?: number
          pricing_version?: string | null
          provider_code?: string
          provider_cost_amount?: number | null
          provider_cost_currency?: string
          reasoning_tokens?: number
          request_id?: string
          status?: string
          tool_calls?: number
          usage_class?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_events_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_logs: {
        Row: {
          channel_id: string
          connection_id: string | null
          delivery_status: string
          direction: string
          id: string
          message_type: string
          metadata: Json
          occurred_at: string
          provider_message_ref: string | null
          user_id: string | null
        }
        Insert: {
          channel_id: string
          connection_id?: string | null
          delivery_status?: string
          direction: string
          id?: string
          message_type?: string
          metadata?: Json
          occurred_at?: string
          provider_message_ref?: string | null
          user_id?: string | null
        }
        Update: {
          channel_id?: string
          connection_id?: string | null
          delivery_status?: string
          direction?: string
          id?: string
          message_type?: string
          metadata?: Json
          occurred_at?: string
          provider_message_ref?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_logs_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "messaging_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "messaging_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_audit_events: {
        Row: {
          actor_user_id: string | null
          contract_id: string
          created_at: string
          event_payload: Json
          event_type: string
          id: string
        }
        Insert: {
          actor_user_id?: string | null
          contract_id: string
          created_at?: string
          event_payload?: Json
          event_type: string
          id?: string
        }
        Update: {
          actor_user_id?: string | null
          contract_id?: string
          created_at?: string
          event_payload?: Json
          event_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_audit_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_audit_events_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "service_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_invoice_items: {
        Row: {
          created_at: string
          currency_code: string
          description: string
          id: string
          invoice_id: string
          item_kind: string
          line_total: number
          quantity: number
          unit_amount: number
        }
        Insert: {
          created_at?: string
          currency_code: string
          description: string
          id?: string
          invoice_id: string
          item_kind: string
          line_total: number
          quantity?: number
          unit_amount: number
        }
        Update: {
          created_at?: string
          currency_code?: string
          description?: string
          id?: string
          invoice_id?: string
          item_kind?: string
          line_total?: number
          quantity?: number
          unit_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "contract_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_invoices: {
        Row: {
          contract_id: string
          created_at: string
          currency_code: string
          discount_amount: number
          due_at: string | null
          id: string
          invoice_number: string
          issued_at: string | null
          status: string
          subtotal: number
          tax_amount: number
          tax_status: string
          total_amount: number
        }
        Insert: {
          contract_id: string
          created_at?: string
          currency_code: string
          discount_amount?: number
          due_at?: string | null
          id?: string
          invoice_number: string
          issued_at?: string | null
          status?: string
          subtotal: number
          tax_amount?: number
          tax_status?: string
          total_amount: number
        }
        Update: {
          contract_id?: string
          created_at?: string
          currency_code?: string
          discount_amount?: number
          due_at?: string | null
          id?: string
          invoice_number?: string
          issued_at?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_status?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_invoices_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "service_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_settlement_allocations: {
        Row: {
          allocation_kind: string
          amount: number
          contract_id: string
          created_at: string
          currency_code: string
          eligible_at: string | null
          external_settlement_ref: string | null
          id: string
          invoice_id: string | null
          payment_transaction_id: string | null
          recipient_ref: string | null
          recipient_type: string
          settled_at: string | null
          status: string
        }
        Insert: {
          allocation_kind: string
          amount: number
          contract_id: string
          created_at?: string
          currency_code: string
          eligible_at?: string | null
          external_settlement_ref?: string | null
          id?: string
          invoice_id?: string | null
          payment_transaction_id?: string | null
          recipient_ref?: string | null
          recipient_type: string
          settled_at?: string | null
          status?: string
        }
        Update: {
          allocation_kind?: string
          amount?: number
          contract_id?: string
          created_at?: string
          currency_code?: string
          eligible_at?: string | null
          external_settlement_ref?: string | null
          id?: string
          invoice_id?: string | null
          payment_transaction_id?: string | null
          recipient_ref?: string | null
          recipient_type?: string
          settled_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_settlement_allocations_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "service_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_settlement_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "contract_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_settlement_allocations_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      countries: {
        Row: {
          created_at: string
          default_language: string | null
          id: string
          is_active: boolean
          iso2: string
          iso3: string | null
          name_en: string
        }
        Insert: {
          created_at?: string
          default_language?: string | null
          id?: string
          is_active?: boolean
          iso2: string
          iso3?: string | null
          name_en: string
        }
        Update: {
          created_at?: string
          default_language?: string | null
          id?: string
          is_active?: boolean
          iso2?: string
          iso3?: string | null
          name_en?: string
        }
        Relationships: []
      }
      crop_activities: {
        Row: {
          activity_date: string
          activity_type: string
          cost_amount: number | null
          cost_currency: string | null
          created_at: string
          crop_cycle_id: string | null
          description: string | null
          farm_id: string
          field_id: string | null
          id: string
          input_name: string | null
          input_quantity: number | null
          input_unit: string | null
          metadata: Json
          performed_by: string | null
        }
        Insert: {
          activity_date: string
          activity_type: string
          cost_amount?: number | null
          cost_currency?: string | null
          created_at?: string
          crop_cycle_id?: string | null
          description?: string | null
          farm_id: string
          field_id?: string | null
          id?: string
          input_name?: string | null
          input_quantity?: number | null
          input_unit?: string | null
          metadata?: Json
          performed_by?: string | null
        }
        Update: {
          activity_date?: string
          activity_type?: string
          cost_amount?: number | null
          cost_currency?: string | null
          created_at?: string
          crop_cycle_id?: string | null
          description?: string | null
          farm_id?: string
          field_id?: string | null
          id?: string
          input_name?: string | null
          input_quantity?: number | null
          input_unit?: string | null
          metadata?: Json
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crop_activities_crop_cycle_id_fkey"
            columns: ["crop_cycle_id"]
            isOneToOne: false
            referencedRelation: "crop_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crop_activities_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crop_activities_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "farm_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crop_activities_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      crop_catalog: {
        Row: {
          common_name: string
          created_at: string
          crop_category: string | null
          id: string
          is_active: boolean
          local_names: Json
          metadata: Json
          perennial: boolean
          scientific_name: string | null
        }
        Insert: {
          common_name: string
          created_at?: string
          crop_category?: string | null
          id?: string
          is_active?: boolean
          local_names?: Json
          metadata?: Json
          perennial?: boolean
          scientific_name?: string | null
        }
        Update: {
          common_name?: string
          created_at?: string
          crop_category?: string | null
          id?: string
          is_active?: boolean
          local_names?: Json
          metadata?: Json
          perennial?: boolean
          scientific_name?: string | null
        }
        Relationships: []
      }
      crop_cycles: {
        Row: {
          actual_harvest_date: string | null
          area_unit: string
          created_at: string
          created_by: string | null
          crop_id: string
          cycle_name: string | null
          expected_harvest_date: string | null
          farm_id: string
          field_id: string | null
          id: string
          notes: string | null
          planted_area: number | null
          planting_date: string | null
          planting_method: string | null
          status: string
          updated_at: string
          variety_id: string | null
        }
        Insert: {
          actual_harvest_date?: string | null
          area_unit?: string
          created_at?: string
          created_by?: string | null
          crop_id: string
          cycle_name?: string | null
          expected_harvest_date?: string | null
          farm_id: string
          field_id?: string | null
          id?: string
          notes?: string | null
          planted_area?: number | null
          planting_date?: string | null
          planting_method?: string | null
          status?: string
          updated_at?: string
          variety_id?: string | null
        }
        Update: {
          actual_harvest_date?: string | null
          area_unit?: string
          created_at?: string
          created_by?: string | null
          crop_id?: string
          cycle_name?: string | null
          expected_harvest_date?: string | null
          farm_id?: string
          field_id?: string | null
          id?: string
          notes?: string | null
          planted_area?: number | null
          planting_date?: string | null
          planting_method?: string | null
          status?: string
          updated_at?: string
          variety_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crop_cycles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crop_cycles_crop_id_fkey"
            columns: ["crop_id"]
            isOneToOne: false
            referencedRelation: "crop_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crop_cycles_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crop_cycles_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "farm_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crop_cycles_variety_id_fkey"
            columns: ["variety_id"]
            isOneToOne: false
            referencedRelation: "crop_varieties"
            referencedColumns: ["id"]
          },
        ]
      }
      crop_varieties: {
        Row: {
          characteristics: Json
          crop_id: string
          id: string
          is_active: boolean
          origin_country_id: string | null
          variety_name: string
        }
        Insert: {
          characteristics?: Json
          crop_id: string
          id?: string
          is_active?: boolean
          origin_country_id?: string | null
          variety_name: string
        }
        Update: {
          characteristics?: Json
          crop_id?: string
          id?: string
          is_active?: boolean
          origin_country_id?: string | null
          variety_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "crop_varieties_crop_id_fkey"
            columns: ["crop_id"]
            isOneToOne: false
            referencedRelation: "crop_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crop_varieties_origin_country_id_fkey"
            columns: ["origin_country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_audio_sessions: {
        Row: {
          consultation_id: string
          created_at: string
          ended_at: string | null
          expires_at: string
          id: string
          initiated_by: string
          started_at: string | null
          status: string
        }
        Insert: {
          consultation_id: string
          created_at?: string
          ended_at?: string | null
          expires_at?: string
          id?: string
          initiated_by: string
          started_at?: string | null
          status?: string
        }
        Update: {
          consultation_id?: string
          created_at?: string
          ended_at?: string | null
          expires_at?: string
          id?: string
          initiated_by?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "expert_audio_sessions_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "expert_consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_audio_sessions_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_consultation_messages: {
        Row: {
          consultation_id: string
          content_parts: Json
          created_at: string
          id: string
          message_text: string | null
          sender_user_id: string
        }
        Insert: {
          consultation_id: string
          content_parts?: Json
          created_at?: string
          id?: string
          message_text?: string | null
          sender_user_id: string
        }
        Update: {
          consultation_id?: string
          content_parts?: Json
          created_at?: string
          id?: string
          message_text?: string | null
          sender_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expert_consultation_messages_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "expert_consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_consultation_messages_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_consultations: {
        Row: {
          consultation_mode: string
          created_at: string
          ended_at: string | null
          external_session_ref: string | null
          id: string
          request_id: string
          scheduled_end: string | null
          scheduled_start: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          consultation_mode?: string
          created_at?: string
          ended_at?: string | null
          external_session_ref?: string | null
          id?: string
          request_id: string
          scheduled_end?: string | null
          scheduled_start?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          consultation_mode?: string
          created_at?: string
          ended_at?: string | null
          external_session_ref?: string | null
          id?: string
          request_id?: string
          scheduled_end?: string | null
          scheduled_start?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "expert_consultations_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "expert_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_credentials: {
        Row: {
          created_at: string
          credential_ref: string | null
          credential_type: string
          document_ref: string | null
          expert_profile_id: string
          expires_on: string | null
          id: string
          issued_on: string | null
          issuing_body: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by_organization_id: string | null
          reviewed_by_user_id: string | null
          verification_status: string
        }
        Insert: {
          created_at?: string
          credential_ref?: string | null
          credential_type: string
          document_ref?: string | null
          expert_profile_id: string
          expires_on?: string | null
          id?: string
          issued_on?: string | null
          issuing_body?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by_organization_id?: string | null
          reviewed_by_user_id?: string | null
          verification_status?: string
        }
        Update: {
          created_at?: string
          credential_ref?: string | null
          credential_type?: string
          document_ref?: string | null
          expert_profile_id?: string
          expires_on?: string | null
          id?: string
          issued_on?: string | null
          issuing_body?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by_organization_id?: string | null
          reviewed_by_user_id?: string | null
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "expert_credentials_expert_profile_id_fkey"
            columns: ["expert_profile_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_credentials_reviewed_by_organization_id_fkey"
            columns: ["reviewed_by_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_credentials_reviewed_by_user_id_fkey"
            columns: ["reviewed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_impact_assessments: {
        Row: {
          assessed_at: string | null
          assessed_by: string | null
          assessment_version: number
          attribution_confidence: string
          confounding_factors: Json
          created_at: string
          economic_score: number | null
          id: string
          impact_record_id: string
          innovation_score: number | null
          reviewer_notes: string | null
          social_score: number | null
          sustainability_score: number | null
          technical_score: number | null
        }
        Insert: {
          assessed_at?: string | null
          assessed_by?: string | null
          assessment_version?: number
          attribution_confidence?: string
          confounding_factors?: Json
          created_at?: string
          economic_score?: number | null
          id?: string
          impact_record_id: string
          innovation_score?: number | null
          reviewer_notes?: string | null
          social_score?: number | null
          sustainability_score?: number | null
          technical_score?: number | null
        }
        Update: {
          assessed_at?: string | null
          assessed_by?: string | null
          assessment_version?: number
          attribution_confidence?: string
          confounding_factors?: Json
          created_at?: string
          economic_score?: number | null
          id?: string
          impact_record_id?: string
          innovation_score?: number | null
          reviewer_notes?: string | null
          social_score?: number | null
          sustainability_score?: number | null
          technical_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expert_impact_assessments_assessed_by_fkey"
            columns: ["assessed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_impact_assessments_impact_record_id_fkey"
            columns: ["impact_record_id"]
            isOneToOne: false
            referencedRelation: "expert_impact_records"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_impact_records: {
        Row: {
          baseline_metrics: Json
          beneficiary_consent_at: string | null
          consultation_id: string | null
          created_at: string
          evidence_refs: string[]
          expert_contribution: string | null
          expert_profile_id: string
          id: string
          innovation_details: Json
          outcome_metrics: Json
          problem_context: Json
          record_kind: string
          status: string
          submitted_at: string | null
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          baseline_metrics?: Json
          beneficiary_consent_at?: string | null
          consultation_id?: string | null
          created_at?: string
          evidence_refs?: string[]
          expert_contribution?: string | null
          expert_profile_id: string
          id?: string
          innovation_details?: Json
          outcome_metrics?: Json
          problem_context?: Json
          record_kind: string
          status?: string
          submitted_at?: string | null
          summary: string
          title: string
          updated_at?: string
        }
        Update: {
          baseline_metrics?: Json
          beneficiary_consent_at?: string | null
          consultation_id?: string | null
          created_at?: string
          evidence_refs?: string[]
          expert_contribution?: string | null
          expert_profile_id?: string
          id?: string
          innovation_details?: Json
          outcome_metrics?: Json
          problem_context?: Json
          record_kind?: string
          status?: string
          submitted_at?: string | null
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expert_impact_records_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "expert_consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_impact_records_expert_profile_id_fkey"
            columns: ["expert_profile_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_impact_signals: {
        Row: {
          acknowledged_at: string | null
          assessment_id: string | null
          attribution_confidence: string
          created_at: string
          evidence_summary: Json
          expert_profile_id: string
          generated_at: string
          id: string
          impact_record_id: string | null
          message: string
          signal_status: string
          title: string
        }
        Insert: {
          acknowledged_at?: string | null
          assessment_id?: string | null
          attribution_confidence?: string
          created_at?: string
          evidence_summary?: Json
          expert_profile_id: string
          generated_at?: string
          id?: string
          impact_record_id?: string | null
          message: string
          signal_status?: string
          title: string
        }
        Update: {
          acknowledged_at?: string | null
          assessment_id?: string | null
          attribution_confidence?: string
          created_at?: string
          evidence_summary?: Json
          expert_profile_id?: string
          generated_at?: string
          id?: string
          impact_record_id?: string | null
          message?: string
          signal_status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "expert_impact_signals_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "expert_impact_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_impact_signals_expert_profile_id_fkey"
            columns: ["expert_profile_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_impact_signals_impact_record_id_fkey"
            columns: ["impact_record_id"]
            isOneToOne: false
            referencedRelation: "expert_impact_records"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_ip_applications: {
        Row: {
          application_type: string
          co_inventors: Json
          created_at: string
          evidence_refs: string[]
          expert_profile_id: string
          id: string
          impact_record_id: string
          legal_jurisdiction: string | null
          novelty_summary: string
          proposed_claims: string | null
          status: string
          submitted_at: string
          title: string
          updated_at: string
        }
        Insert: {
          application_type: string
          co_inventors?: Json
          created_at?: string
          evidence_refs?: string[]
          expert_profile_id: string
          id?: string
          impact_record_id: string
          legal_jurisdiction?: string | null
          novelty_summary: string
          proposed_claims?: string | null
          status?: string
          submitted_at?: string
          title: string
          updated_at?: string
        }
        Update: {
          application_type?: string
          co_inventors?: Json
          created_at?: string
          evidence_refs?: string[]
          expert_profile_id?: string
          id?: string
          impact_record_id?: string
          legal_jurisdiction?: string | null
          novelty_summary?: string
          proposed_claims?: string | null
          status?: string
          submitted_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expert_ip_applications_expert_profile_id_fkey"
            columns: ["expert_profile_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_ip_applications_impact_record_id_fkey"
            columns: ["impact_record_id"]
            isOneToOne: false
            referencedRelation: "expert_impact_records"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_profiles: {
        Row: {
          biography: string | null
          consultation_modes: Json
          country_id: string | null
          created_at: string
          id: string
          languages: Json
          profile_visibility: string
          public_name: string
          updated_at: string
          user_id: string
          verification_status: string
          years_experience: number | null
        }
        Insert: {
          biography?: string | null
          consultation_modes?: Json
          country_id?: string | null
          created_at?: string
          id?: string
          languages?: Json
          profile_visibility?: string
          public_name: string
          updated_at?: string
          user_id: string
          verification_status?: string
          years_experience?: number | null
        }
        Update: {
          biography?: string | null
          consultation_modes?: Json
          country_id?: string | null
          created_at?: string
          id?: string
          languages?: Json
          profile_visibility?: string
          public_name?: string
          updated_at?: string
          user_id?: string
          verification_status?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expert_profiles_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_recognition_awards: {
        Row: {
          award_code: string
          award_level: string
          citation: string
          created_at: string
          expert_profile_id: string
          id: string
          impact_record_id: string | null
          issued_at: string | null
          issuer_authorization_ref: string | null
          issuer_name: string
          issuer_organization_id: string | null
          issuer_type: string
          issuer_user_id: string | null
          public_verification_token: string
          revoked_at: string | null
          status: string
          title: string
        }
        Insert: {
          award_code: string
          award_level: string
          citation: string
          created_at?: string
          expert_profile_id: string
          id?: string
          impact_record_id?: string | null
          issued_at?: string | null
          issuer_authorization_ref?: string | null
          issuer_name: string
          issuer_organization_id?: string | null
          issuer_type: string
          issuer_user_id?: string | null
          public_verification_token?: string
          revoked_at?: string | null
          status?: string
          title: string
        }
        Update: {
          award_code?: string
          award_level?: string
          citation?: string
          created_at?: string
          expert_profile_id?: string
          id?: string
          impact_record_id?: string | null
          issued_at?: string | null
          issuer_authorization_ref?: string | null
          issuer_name?: string
          issuer_organization_id?: string | null
          issuer_type?: string
          issuer_user_id?: string | null
          public_verification_token?: string
          revoked_at?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "expert_recognition_awards_expert_profile_id_fkey"
            columns: ["expert_profile_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_recognition_awards_impact_record_id_fkey"
            columns: ["impact_record_id"]
            isOneToOne: false
            referencedRelation: "expert_impact_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_recognition_awards_issuer_organization_id_fkey"
            columns: ["issuer_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_recognition_awards_issuer_user_id_fkey"
            columns: ["issuer_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_recognition_requests: {
        Row: {
          created_at: string
          expert_note: string | null
          expert_profile_id: string
          id: string
          impact_record_id: string
          request_type: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          signal_id: string
          status: string
          submitted_at: string
        }
        Insert: {
          created_at?: string
          expert_note?: string | null
          expert_profile_id: string
          id?: string
          impact_record_id: string
          request_type?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          signal_id: string
          status?: string
          submitted_at?: string
        }
        Update: {
          created_at?: string
          expert_note?: string | null
          expert_profile_id?: string
          id?: string
          impact_record_id?: string
          request_type?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          signal_id?: string
          status?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expert_recognition_requests_expert_profile_id_fkey"
            columns: ["expert_profile_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_recognition_requests_impact_record_id_fkey"
            columns: ["impact_record_id"]
            isOneToOne: false
            referencedRelation: "expert_impact_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_recognition_requests_reviewed_by_user_id_fkey"
            columns: ["reviewed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_recognition_requests_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: true
            referencedRelation: "expert_impact_signals"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_request_assignments: {
        Row: {
          assignment_status: string
          expert_profile_id: string
          id: string
          offered_at: string
          request_id: string
          responded_at: string | null
        }
        Insert: {
          assignment_status?: string
          expert_profile_id: string
          id?: string
          offered_at?: string
          request_id: string
          responded_at?: string | null
        }
        Update: {
          assignment_status?: string
          expert_profile_id?: string
          id?: string
          offered_at?: string
          request_id?: string
          responded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expert_request_assignments_expert_profile_id_fkey"
            columns: ["expert_profile_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_request_assignments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "expert_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_request_reports: {
        Row: {
          author_user_id: string
          consultation_id: string
          created_at: string
          evidence_notes: Json
          id: string
          limitations: string | null
          recommendations: string | null
          request_id: string
          summary: string
        }
        Insert: {
          author_user_id: string
          consultation_id: string
          created_at?: string
          evidence_notes?: Json
          id?: string
          limitations?: string | null
          recommendations?: string | null
          request_id: string
          summary: string
        }
        Update: {
          author_user_id?: string
          consultation_id?: string
          created_at?: string
          evidence_notes?: Json
          id?: string
          limitations?: string | null
          recommendations?: string | null
          request_id?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "expert_request_reports_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_request_reports_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "expert_consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_request_reports_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "expert_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_requests: {
        Row: {
          assigned_expert_profile_id: string | null
          consent_at: string | null
          consent_scope: Json
          consented_context_snapshot: Json
          created_at: string
          crop_cycle_id: string | null
          farm_id: string | null
          field_id: string | null
          id: string
          preferred_language: string
          priority: string
          problem_description: string
          request_type: string
          requested_mode: string
          requester_user_id: string
          resolved_at: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          assigned_expert_profile_id?: string | null
          consent_at?: string | null
          consent_scope?: Json
          consented_context_snapshot?: Json
          created_at?: string
          crop_cycle_id?: string | null
          farm_id?: string | null
          field_id?: string | null
          id?: string
          preferred_language?: string
          priority?: string
          problem_description: string
          request_type?: string
          requested_mode?: string
          requester_user_id: string
          resolved_at?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          assigned_expert_profile_id?: string | null
          consent_at?: string | null
          consent_scope?: Json
          consented_context_snapshot?: Json
          created_at?: string
          crop_cycle_id?: string | null
          farm_id?: string | null
          field_id?: string | null
          id?: string
          preferred_language?: string
          priority?: string
          problem_description?: string
          request_type?: string
          requested_mode?: string
          requester_user_id?: string
          resolved_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expert_requests_assigned_expert_profile_id_fkey"
            columns: ["assigned_expert_profile_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_requests_crop_cycle_id_fkey"
            columns: ["crop_cycle_id"]
            isOneToOne: false
            referencedRelation: "crop_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_requests_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_requests_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "farm_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_requests_requester_user_id_fkey"
            columns: ["requester_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_reviews: {
        Row: {
          consultation_id: string
          created_at: string
          id: string
          rating: number
          review_text: string | null
          reviewer_user_id: string
        }
        Insert: {
          consultation_id: string
          created_at?: string
          id?: string
          rating: number
          review_text?: string | null
          reviewer_user_id: string
        }
        Update: {
          consultation_id?: string
          created_at?: string
          id?: string
          rating?: number
          review_text?: string | null
          reviewer_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expert_reviews_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: true
            referencedRelation: "expert_consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_reviews_reviewer_user_id_fkey"
            columns: ["reviewer_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_specialties: {
        Row: {
          experience_note: string | null
          expert_profile_id: string
          expertise_category_id: string
        }
        Insert: {
          experience_note?: string | null
          expert_profile_id: string
          expertise_category_id: string
        }
        Update: {
          experience_note?: string | null
          expert_profile_id?: string
          expertise_category_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expert_specialties_expert_profile_id_fkey"
            columns: ["expert_profile_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_specialties_expertise_category_id_fkey"
            columns: ["expertise_category_id"]
            isOneToOne: false
            referencedRelation: "expertise_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      expertise_categories: {
        Row: {
          category_code: string
          display_name: string
          id: string
          is_active: boolean
          parent_id: string | null
        }
        Insert: {
          category_code: string
          display_name: string
          id?: string
          is_active?: boolean
          parent_id?: string | null
        }
        Update: {
          category_code?: string
          display_name?: string
          id?: string
          is_active?: boolean
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expertise_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "expertise_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      farm_documents: {
        Row: {
          created_at: string
          document_type: string
          farm_id: string
          file_name: string
          file_size_bytes: number
          id: string
          mime_type: string
          storage_path: string
          uploaded_by_user_id: string
        }
        Insert: {
          created_at?: string
          document_type?: string
          farm_id: string
          file_name: string
          file_size_bytes: number
          id?: string
          mime_type: string
          storage_path: string
          uploaded_by_user_id: string
        }
        Update: {
          created_at?: string
          document_type?: string
          farm_id?: string
          file_name?: string
          file_size_bytes?: number
          id?: string
          mime_type?: string
          storage_path?: string
          uploaded_by_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "farm_documents_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farm_documents_uploaded_by_user_id_fkey"
            columns: ["uploaded_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      farm_fields: {
        Row: {
          area: number | null
          area_unit: string
          created_at: string
          farm_id: string
          field_name: string
          id: string
          soil_description: string | null
        }
        Insert: {
          area?: number | null
          area_unit?: string
          created_at?: string
          farm_id: string
          field_name: string
          id?: string
          soil_description?: string | null
        }
        Update: {
          area?: number | null
          area_unit?: string
          created_at?: string
          farm_id?: string
          field_name?: string
          id?: string
          soil_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "farm_fields_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      farm_locations: {
        Row: {
          captured_at: string | null
          confirmed_by_user: boolean
          created_at: string
          elevation_m: number | null
          farm_id: string
          id: string
          is_primary: boolean
          latitude: number | null
          location_source: string
          longitude: number | null
          precision_m: number | null
        }
        Insert: {
          captured_at?: string | null
          confirmed_by_user?: boolean
          created_at?: string
          elevation_m?: number | null
          farm_id: string
          id?: string
          is_primary?: boolean
          latitude?: number | null
          location_source?: string
          longitude?: number | null
          precision_m?: number | null
        }
        Update: {
          captured_at?: string | null
          confirmed_by_user?: boolean
          created_at?: string
          elevation_m?: number | null
          farm_id?: string
          id?: string
          is_primary?: boolean
          latitude?: number | null
          location_source?: string
          longitude?: number | null
          precision_m?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "farm_locations_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      farm_observations: {
        Row: {
          created_at: string
          crop_cycle_id: string | null
          description: string | null
          farm_id: string
          field_id: string | null
          id: string
          image_refs: Json
          location_latitude: number | null
          location_longitude: number | null
          observation_type: string
          observed_at: string
          reported_by: string | null
          severity: string | null
        }
        Insert: {
          created_at?: string
          crop_cycle_id?: string | null
          description?: string | null
          farm_id: string
          field_id?: string | null
          id?: string
          image_refs?: Json
          location_latitude?: number | null
          location_longitude?: number | null
          observation_type: string
          observed_at: string
          reported_by?: string | null
          severity?: string | null
        }
        Update: {
          created_at?: string
          crop_cycle_id?: string | null
          description?: string | null
          farm_id?: string
          field_id?: string | null
          id?: string
          image_refs?: Json
          location_latitude?: number | null
          location_longitude?: number | null
          observation_type?: string
          observed_at?: string
          reported_by?: string | null
          severity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "farm_observations_crop_cycle_id_fkey"
            columns: ["crop_cycle_id"]
            isOneToOne: false
            referencedRelation: "crop_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farm_observations_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farm_observations_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "farm_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farm_observations_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      farm_recommendations: {
        Row: {
          analysis_run_id: string | null
          confidence_level: string | null
          created_at: string
          created_by_user_id: string | null
          crop_cycle_id: string | null
          evidence_refs: Json
          farm_id: string
          field_id: string | null
          id: string
          recommendation_text: string
          recommendation_type: string
          requires_expert_review: boolean
          risk_level: string
          status: string
          title: string
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          analysis_run_id?: string | null
          confidence_level?: string | null
          created_at?: string
          created_by_user_id?: string | null
          crop_cycle_id?: string | null
          evidence_refs?: Json
          farm_id: string
          field_id?: string | null
          id?: string
          recommendation_text: string
          recommendation_type: string
          requires_expert_review?: boolean
          risk_level?: string
          status?: string
          title: string
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          analysis_run_id?: string | null
          confidence_level?: string | null
          created_at?: string
          created_by_user_id?: string | null
          crop_cycle_id?: string | null
          evidence_refs?: Json
          farm_id?: string
          field_id?: string | null
          id?: string
          recommendation_text?: string
          recommendation_type?: string
          requires_expert_review?: boolean
          risk_level?: string
          status?: string
          title?: string
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "farm_recommendations_analysis_run_id_fkey"
            columns: ["analysis_run_id"]
            isOneToOne: false
            referencedRelation: "ai_analysis_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farm_recommendations_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farm_recommendations_crop_cycle_id_fkey"
            columns: ["crop_cycle_id"]
            isOneToOne: false
            referencedRelation: "crop_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farm_recommendations_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farm_recommendations_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "farm_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      farmer_credentials: {
        Row: {
          created_at: string
          credential_ref: string | null
          credential_type: string
          document_ref: string | null
          expires_on: string | null
          farmer_user_id: string
          id: string
          issued_on: string | null
          issuing_body: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by_organization_id: string | null
          reviewed_by_user_id: string | null
          updated_at: string
          verification_status: string
        }
        Insert: {
          created_at?: string
          credential_ref?: string | null
          credential_type: string
          document_ref?: string | null
          expires_on?: string | null
          farmer_user_id: string
          id?: string
          issued_on?: string | null
          issuing_body?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by_organization_id?: string | null
          reviewed_by_user_id?: string | null
          updated_at?: string
          verification_status?: string
        }
        Update: {
          created_at?: string
          credential_ref?: string | null
          credential_type?: string
          document_ref?: string | null
          expires_on?: string | null
          farmer_user_id?: string
          id?: string
          issued_on?: string | null
          issuing_body?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by_organization_id?: string | null
          reviewed_by_user_id?: string | null
          updated_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "farmer_credentials_farmer_user_id_fkey"
            columns: ["farmer_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farmer_credentials_reviewed_by_organization_id_fkey"
            columns: ["reviewed_by_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farmer_credentials_reviewed_by_user_id_fkey"
            columns: ["reviewed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      farmer_recognition_awards: {
        Row: {
          award_code: string
          award_level: string
          citation: string
          created_at: string
          farm_id: string | null
          farmer_user_id: string
          id: string
          issued_at: string | null
          issuer_organization_id: string | null
          issuer_type: string
          issuer_user_id: string | null
          public_verification_token: string
          revoked_at: string | null
          status: string
          title: string
        }
        Insert: {
          award_code: string
          award_level: string
          citation: string
          created_at?: string
          farm_id?: string | null
          farmer_user_id: string
          id?: string
          issued_at?: string | null
          issuer_organization_id?: string | null
          issuer_type?: string
          issuer_user_id?: string | null
          public_verification_token?: string
          revoked_at?: string | null
          status?: string
          title: string
        }
        Update: {
          award_code?: string
          award_level?: string
          citation?: string
          created_at?: string
          farm_id?: string | null
          farmer_user_id?: string
          id?: string
          issued_at?: string | null
          issuer_organization_id?: string | null
          issuer_type?: string
          issuer_user_id?: string | null
          public_verification_token?: string
          revoked_at?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "farmer_recognition_awards_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farmer_recognition_awards_farmer_user_id_fkey"
            columns: ["farmer_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farmer_recognition_awards_issuer_organization_id_fkey"
            columns: ["issuer_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farmer_recognition_awards_issuer_user_id_fkey"
            columns: ["issuer_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      farms: {
        Row: {
          area_unit: string
          country_id: string | null
          created_at: string
          farm_name: string
          id: string
          organization_id: string | null
          owner_user_id: string
          status: string
          total_area: number | null
          updated_at: string
        }
        Insert: {
          area_unit?: string
          country_id?: string | null
          created_at?: string
          farm_name: string
          id?: string
          organization_id?: string | null
          owner_user_id: string
          status?: string
          total_area?: number | null
          updated_at?: string
        }
        Update: {
          area_unit?: string
          country_id?: string | null
          created_at?: string
          farm_name?: string
          id?: string
          organization_id?: string | null
          owner_user_id?: string
          status?: string
          total_area?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "farms_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farms_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      institutional_request_events: {
        Row: {
          actor_organization_id: string | null
          actor_user_id: string | null
          event_type: string
          from_status: string | null
          id: string
          is_visible_to_farmer: boolean
          message: string | null
          metadata: Json
          occurred_at: string
          request_id: string
          to_status: string | null
        }
        Insert: {
          actor_organization_id?: string | null
          actor_user_id?: string | null
          event_type: string
          from_status?: string | null
          id?: string
          is_visible_to_farmer?: boolean
          message?: string | null
          metadata?: Json
          occurred_at?: string
          request_id: string
          to_status?: string | null
        }
        Update: {
          actor_organization_id?: string | null
          actor_user_id?: string | null
          event_type?: string
          from_status?: string | null
          id?: string
          is_visible_to_farmer?: boolean
          message?: string | null
          metadata?: Json
          occurred_at?: string
          request_id?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "institutional_request_events_actor_organization_id_fkey"
            columns: ["actor_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_request_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_request_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "institutional_service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      institutional_service_requests: {
        Row: {
          acknowledged_at: string | null
          attachments: Json
          consent_scope: Json
          external_tracking_reference: string | null
          farm_id: string | null
          farmer_consent_at: string
          farmer_message: string
          farmer_user_id: string
          id: string
          official_reference: string | null
          official_submission_at: string | null
          organization_id: string
          organization_response: string | null
          organization_service_id: string
          rejection_reason: string | null
          request_data: Json
          request_number: number
          request_title: string
          resolved_at: string | null
          status: string
          submission_mode: string
          submitted_at: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          attachments?: Json
          consent_scope?: Json
          external_tracking_reference?: string | null
          farm_id?: string | null
          farmer_consent_at: string
          farmer_message?: string
          farmer_user_id: string
          id?: string
          official_reference?: string | null
          official_submission_at?: string | null
          organization_id: string
          organization_response?: string | null
          organization_service_id: string
          rejection_reason?: string | null
          request_data?: Json
          request_number?: never
          request_title: string
          resolved_at?: string | null
          status?: string
          submission_mode: string
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          attachments?: Json
          consent_scope?: Json
          external_tracking_reference?: string | null
          farm_id?: string | null
          farmer_consent_at?: string
          farmer_message?: string
          farmer_user_id?: string
          id?: string
          official_reference?: string | null
          official_submission_at?: string | null
          organization_id?: string
          organization_response?: string | null
          organization_service_id?: string
          rejection_reason?: string | null
          request_data?: Json
          request_number?: never
          request_title?: string
          resolved_at?: string | null
          status?: string
          submission_mode?: string
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "institutional_service_requests_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_service_requests_farmer_user_id_fkey"
            columns: ["farmer_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_service_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_service_requests_organization_service_id_fkey"
            columns: ["organization_service_id"]
            isOneToOne: false
            referencedRelation: "organization_services"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_connections: {
        Row: {
          auth_method: string | null
          configuration: Json
          created_at: string
          credentials_secret_ref: string | null
          environment: string
          id: string
          integration_name: string
          integration_type: string
          organization_id: string
          status: string
          updated_at: string
        }
        Insert: {
          auth_method?: string | null
          configuration?: Json
          created_at?: string
          credentials_secret_ref?: string | null
          environment?: string
          id?: string
          integration_name: string
          integration_type: string
          organization_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          auth_method?: string | null
          configuration?: Json
          created_at?: string
          credentials_secret_ref?: string | null
          environment?: string
          id?: string
          integration_name?: string
          integration_type?: string
          organization_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_endpoints: {
        Row: {
          connection_id: string
          created_at: string
          data_domain: string | null
          direction: string
          endpoint_name: string
          endpoint_path: string | null
          http_method: string | null
          id: string
          is_active: boolean
        }
        Insert: {
          connection_id: string
          created_at?: string
          data_domain?: string | null
          direction: string
          endpoint_name: string
          endpoint_path?: string | null
          http_method?: string | null
          id?: string
          is_active?: boolean
        }
        Update: {
          connection_id?: string
          created_at?: string
          data_domain?: string | null
          direction?: string
          endpoint_name?: string
          endpoint_path?: string | null
          http_method?: string | null
          id?: string
          is_active?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "integration_endpoints_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_logs: {
        Row: {
          connection_id: string
          details: Json
          event_type: string
          id: string
          message: string | null
          occurred_at: string
          severity: string
          sync_job_id: string | null
        }
        Insert: {
          connection_id: string
          details?: Json
          event_type: string
          id?: string
          message?: string | null
          occurred_at?: string
          severity?: string
          sync_job_id?: string | null
        }
        Update: {
          connection_id?: string
          details?: Json
          event_type?: string
          id?: string
          message?: string | null
          occurred_at?: string
          severity?: string
          sync_job_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_logs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_logs_sync_job_id_fkey"
            columns: ["sync_job_id"]
            isOneToOne: false
            referencedRelation: "integration_sync_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_sync_jobs: {
        Row: {
          connection_id: string
          created_at: string
          endpoint_id: string | null
          error_summary: string | null
          finished_at: string | null
          id: string
          idempotency_key: string | null
          records_read: number
          records_written: number
          started_at: string | null
          status: string
          sync_direction: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          endpoint_id?: string | null
          error_summary?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string | null
          records_read?: number
          records_written?: number
          started_at?: string | null
          status?: string
          sync_direction: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          endpoint_id?: string | null
          error_summary?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string | null
          records_read?: number
          records_written?: number
          started_at?: string | null
          status?: string
          sync_direction?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_sync_jobs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_sync_jobs_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "integration_endpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      irrigation_events: {
        Row: {
          created_at: string
          crop_cycle_id: string | null
          duration_minutes: number | null
          ended_at: string | null
          farm_id: string
          field_id: string | null
          id: string
          irrigation_method: string
          notes: string | null
          recorded_by: string | null
          started_at: string
          water_source: string | null
          water_volume_m3: number | null
        }
        Insert: {
          created_at?: string
          crop_cycle_id?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          farm_id: string
          field_id?: string | null
          id?: string
          irrigation_method: string
          notes?: string | null
          recorded_by?: string | null
          started_at: string
          water_source?: string | null
          water_volume_m3?: number | null
        }
        Update: {
          created_at?: string
          crop_cycle_id?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          farm_id?: string
          field_id?: string | null
          id?: string
          irrigation_method?: string
          notes?: string | null
          recorded_by?: string | null
          started_at?: string
          water_source?: string | null
          water_volume_m3?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "irrigation_events_crop_cycle_id_fkey"
            columns: ["crop_cycle_id"]
            isOneToOne: false
            referencedRelation: "crop_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "irrigation_events_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "irrigation_events_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "farm_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "irrigation_events_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      job_applications: {
        Row: {
          applicant_user_id: string
          cover_message: string | null
          created_at: string
          id: string
          job_id: string
          proposed_pay: number | null
          status: string
          updated_at: string
        }
        Insert: {
          applicant_user_id: string
          cover_message?: string | null
          created_at?: string
          id?: string
          job_id: string
          proposed_pay?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          applicant_user_id?: string
          cover_message?: string | null
          created_at?: string
          id?: string
          job_id?: string
          proposed_pay?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_applicant_user_id_fkey"
            columns: ["applicant_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      job_listings: {
        Row: {
          category: string
          city: string | null
          country_id: string | null
          created_at: string
          description: string
          employer_user_id: string
          employment_type: string
          ends_on: string | null
          experience_min_years: number | null
          expires_at: string | null
          farm_id: string | null
          id: string
          location_label: string | null
          pay_currency: string | null
          pay_max: number | null
          pay_min: number | null
          pay_type: string
          region: string | null
          required_skills: string[]
          starts_on: string | null
          status: string
          title: string
          updated_at: string
          worker_count: number
        }
        Insert: {
          category: string
          city?: string | null
          country_id?: string | null
          created_at?: string
          description: string
          employer_user_id: string
          employment_type: string
          ends_on?: string | null
          experience_min_years?: number | null
          expires_at?: string | null
          farm_id?: string | null
          id?: string
          location_label?: string | null
          pay_currency?: string | null
          pay_max?: number | null
          pay_min?: number | null
          pay_type?: string
          region?: string | null
          required_skills?: string[]
          starts_on?: string | null
          status?: string
          title: string
          updated_at?: string
          worker_count?: number
        }
        Update: {
          category?: string
          city?: string | null
          country_id?: string | null
          created_at?: string
          description?: string
          employer_user_id?: string
          employment_type?: string
          ends_on?: string | null
          experience_min_years?: number | null
          expires_at?: string | null
          farm_id?: string | null
          id?: string
          location_label?: string | null
          pay_currency?: string | null
          pay_max?: number | null
          pay_min?: number | null
          pay_type?: string
          region?: string | null
          required_skills?: string[]
          starts_on?: string | null
          status?: string
          title?: string
          updated_at?: string
          worker_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "job_listings_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_listings_employer_user_id_fkey"
            columns: ["employer_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_listings_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      job_profiles: {
        Row: {
          availability: string
          bio: string | null
          city: string | null
          country_id: string | null
          created_at: string
          display_name: string
          employment_preferences: string[]
          expected_pay_max: number | null
          expected_pay_min: number | null
          experience_years: number | null
          headline: string | null
          id: string
          is_published: boolean
          location_label: string | null
          pay_currency: string | null
          region: string | null
          skills: string[]
          updated_at: string
          user_id: string
          worker_type: string
        }
        Insert: {
          availability?: string
          bio?: string | null
          city?: string | null
          country_id?: string | null
          created_at?: string
          display_name: string
          employment_preferences?: string[]
          expected_pay_max?: number | null
          expected_pay_min?: number | null
          experience_years?: number | null
          headline?: string | null
          id?: string
          is_published?: boolean
          location_label?: string | null
          pay_currency?: string | null
          region?: string | null
          skills?: string[]
          updated_at?: string
          user_id: string
          worker_type?: string
        }
        Update: {
          availability?: string
          bio?: string | null
          city?: string | null
          country_id?: string | null
          created_at?: string
          display_name?: string
          employment_preferences?: string[]
          expected_pay_max?: number | null
          expected_pay_min?: number | null
          experience_years?: number | null
          headline?: string | null
          id?: string
          is_published?: boolean
          location_label?: string | null
          pay_currency?: string | null
          region?: string | null
          skills?: string[]
          updated_at?: string
          user_id?: string
          worker_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_profiles_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      location_permissions: {
        Row: {
          consent_status: string
          consent_version: string
          farm_id: string | null
          id: string
          purpose: string
          recorded_at: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          consent_status: string
          consent_version: string
          farm_id?: string | null
          id?: string
          purpose: string
          recorded_at?: string
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          consent_status?: string
          consent_version?: string
          farm_id?: string | null
          id?: string
          purpose?: string
          recorded_at?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_permissions_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_cart_items: {
        Row: {
          buyer_user_id: string
          created_at: string
          id: string
          product_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          buyer_user_id: string
          created_at?: string
          id?: string
          product_id: string
          quantity: number
          updated_at?: string
        }
        Update: {
          buyer_user_id?: string
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_cart_items_buyer_user_id_fkey"
            columns: ["buyer_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_categories: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          market_section: string
          name_en: string
          name_fa: string
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          market_section: string
          name_en: string
          name_fa: string
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          market_section?: string
          name_en?: string
          name_fa?: string
          sort_order?: number
        }
        Relationships: []
      }
      marketplace_invoices: {
        Row: {
          created_at: string
          currency: string
          id: string
          invoice_number: string
          issued_at: string | null
          order_id: string
          status: string
          subtotal: number
          tax_amount: number
          tax_status: string
          total_amount: number
        }
        Insert: {
          created_at?: string
          currency: string
          id?: string
          invoice_number: string
          issued_at?: string | null
          order_id: string
          status?: string
          subtotal: number
          tax_amount?: number
          tax_status?: string
          total_amount: number
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          invoice_number?: string
          issued_at?: string | null
          order_id?: string
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_status?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_order_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          order_id: string
          product_id: string | null
          product_name_snapshot: string
          product_snapshot: Json
          quantity: number
          sku_snapshot: string | null
          unit_label: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total: number
          order_id: string
          product_id?: string | null
          product_name_snapshot: string
          product_snapshot?: Json
          quantity: number
          sku_snapshot?: string | null
          unit_label: string
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          order_id?: string
          product_id?: string | null
          product_name_snapshot?: string
          product_snapshot?: Json
          quantity?: number
          sku_snapshot?: string | null
          unit_label?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_orders: {
        Row: {
          buyer_note: string | null
          buyer_user_id: string
          currency: string
          discount_amount: number
          fulfillment_status: string
          id: string
          order_number: string
          payment_status: string
          placed_at: string
          reservation_expires_at: string
          seller_id: string
          seller_note: string | null
          shipping_address: Json
          shipping_amount: number
          status: string
          subtotal: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          buyer_note?: string | null
          buyer_user_id: string
          currency: string
          discount_amount?: number
          fulfillment_status?: string
          id?: string
          order_number: string
          payment_status?: string
          placed_at?: string
          reservation_expires_at?: string
          seller_id: string
          seller_note?: string | null
          shipping_address?: Json
          shipping_amount?: number
          status?: string
          subtotal: number
          total_amount: number
          updated_at?: string
        }
        Update: {
          buyer_note?: string | null
          buyer_user_id?: string
          currency?: string
          discount_amount?: number
          fulfillment_status?: string
          id?: string
          order_number?: string
          payment_status?: string
          placed_at?: string
          reservation_expires_at?: string
          seller_id?: string
          seller_note?: string | null
          shipping_address?: Json
          shipping_amount?: number
          status?: string
          subtotal?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_orders_buyer_user_id_fkey"
            columns: ["buyer_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_payment_events: {
        Row: {
          amount: number
          created_at: string
          currency: string
          event_type: string
          id: string
          order_id: string
          provider: string
          provider_event_id: string
          raw_reference: Json
          verified_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          event_type: string
          id?: string
          order_id: string
          provider: string
          provider_event_id: string
          raw_reference?: Json
          verified_at: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          event_type?: string
          id?: string
          order_id?: string
          provider?: string
          provider_event_id?: string
          raw_reference?: Json
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_payment_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_price_observations: {
        Row: {
          created_at: string
          currency: string
          destination_country: string
          id: string
          market_region: string | null
          notes: string | null
          observed_at: string
          price_max: number
          price_min: number
          product_id: string
          quality_grade: string | null
          seller_id: string
          source_name: string
          source_url: string | null
          source_verified: boolean
          trade_basis: string
          unit_label: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          destination_country: string
          id?: string
          market_region?: string | null
          notes?: string | null
          observed_at: string
          price_max: number
          price_min: number
          product_id: string
          quality_grade?: string | null
          seller_id: string
          source_name: string
          source_url?: string | null
          source_verified?: boolean
          trade_basis?: string
          unit_label: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          destination_country?: string
          id?: string
          market_region?: string | null
          notes?: string | null
          observed_at?: string
          price_max?: number
          price_min?: number
          product_id?: string
          quality_grade?: string | null
          seller_id?: string
          source_name?: string
          source_url?: string | null
          source_verified?: boolean
          trade_basis?: string
          unit_label?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_price_observations_product_seller_fk"
            columns: ["product_id", "seller_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id", "seller_id"]
          },
          {
            foreignKeyName: "marketplace_price_observations_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_product_external_links: {
        Row: {
          created_at: string
          id: string
          is_public: boolean
          label: string
          link_type: string
          product_id: string
          seller_id: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_public?: boolean
          label: string
          link_type: string
          product_id: string
          seller_id: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          is_public?: boolean
          label?: string
          link_type?: string
          product_id?: string
          seller_id?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_product_external_links_product_seller_fk"
            columns: ["product_id", "seller_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id", "seller_id"]
          },
          {
            foreignKeyName: "marketplace_product_external_links_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_product_service_needs: {
        Row: {
          created_at: string
          description: string | null
          id: string
          notes: string | null
          organization_service_id: string | null
          product_id: string | null
          provider_contact: string | null
          provider_name: string | null
          provider_url: string | null
          seller_id: string
          service_code: string
          status: string
          target_date: string | null
          updated_at: string
          urgency: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          organization_service_id?: string | null
          product_id?: string | null
          provider_contact?: string | null
          provider_name?: string | null
          provider_url?: string | null
          seller_id: string
          service_code: string
          status?: string
          target_date?: string | null
          updated_at?: string
          urgency?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          organization_service_id?: string | null
          product_id?: string | null
          provider_contact?: string | null
          provider_name?: string | null
          provider_url?: string | null
          seller_id?: string
          service_code?: string
          status?: string
          target_date?: string | null
          updated_at?: string
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_product_service_needs_organization_service_id_fkey"
            columns: ["organization_service_id"]
            isOneToOne: false
            referencedRelation: "organization_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_product_service_needs_product_seller_fk"
            columns: ["product_id", "seller_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id", "seller_id"]
          },
          {
            foreignKeyName: "marketplace_product_service_needs_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_products: {
        Row: {
          available_until: string | null
          category_id: string
          created_at: string
          currency: string
          description: string | null
          harvest_at: string | null
          id: string
          image_urls: Json
          license_reference: string | null
          market_section: string
          minimum_order_qty: number
          name: string
          origin_country: string | null
          origin_region: string | null
          price: number | null
          pricing_model: string
          published_at: string | null
          quality_grade: string | null
          regulated: boolean
          regulatory_metadata: Json
          regulatory_reviewed_at: string | null
          regulatory_status: string
          reserved_qty: number
          seller_id: string
          sku: string | null
          specifications: Json
          status: string
          stock_qty: number | null
          unit_label: string
          updated_at: string
        }
        Insert: {
          available_until?: string | null
          category_id: string
          created_at?: string
          currency?: string
          description?: string | null
          harvest_at?: string | null
          id?: string
          image_urls?: Json
          license_reference?: string | null
          market_section: string
          minimum_order_qty?: number
          name: string
          origin_country?: string | null
          origin_region?: string | null
          price?: number | null
          pricing_model?: string
          published_at?: string | null
          quality_grade?: string | null
          regulated?: boolean
          regulatory_metadata?: Json
          regulatory_reviewed_at?: string | null
          regulatory_status?: string
          reserved_qty?: number
          seller_id: string
          sku?: string | null
          specifications?: Json
          status?: string
          stock_qty?: number | null
          unit_label?: string
          updated_at?: string
        }
        Update: {
          available_until?: string | null
          category_id?: string
          created_at?: string
          currency?: string
          description?: string | null
          harvest_at?: string | null
          id?: string
          image_urls?: Json
          license_reference?: string | null
          market_section?: string
          minimum_order_qty?: number
          name?: string
          origin_country?: string | null
          origin_region?: string | null
          price?: number | null
          pricing_model?: string
          published_at?: string | null
          quality_grade?: string | null
          regulated?: boolean
          regulatory_metadata?: Json
          regulatory_reviewed_at?: string | null
          regulatory_status?: string
          reserved_qty?: number
          seller_id?: string
          sku?: string | null
          specifications?: Json
          status?: string
          stock_qty?: number | null
          unit_label?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "marketplace_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_products_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_quote_requests: {
        Row: {
          buyer_user_id: string
          created_at: string
          id: string
          message: string
          product_id: string | null
          quantity: number | null
          seller_id: string
          seller_response: string | null
          status: string
          unit_label: string | null
          updated_at: string
        }
        Insert: {
          buyer_user_id: string
          created_at?: string
          id?: string
          message: string
          product_id?: string | null
          quantity?: number | null
          seller_id: string
          seller_response?: string | null
          status?: string
          unit_label?: string | null
          updated_at?: string
        }
        Update: {
          buyer_user_id?: string
          created_at?: string
          id?: string
          message?: string
          product_id?: string | null
          quantity?: number | null
          seller_id?: string
          seller_response?: string | null
          status?: string
          unit_label?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_quote_requests_buyer_user_id_fkey"
            columns: ["buyer_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_quote_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_quote_requests_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_sales_leads: {
        Row: {
          buyer_name: string
          buyer_type: string
          city: string | null
          contact_email: string | null
          contact_method: string | null
          contact_name: string | null
          contact_phone: string | null
          country: string | null
          created_at: string
          currency: string
          expected_unit_price: number | null
          id: string
          need_description: string | null
          next_action: string | null
          next_action_at: string | null
          notes: string | null
          product_id: string | null
          provenance: Json
          region: string | null
          seller_id: string
          source_name: string | null
          source_type: string
          source_url: string | null
          stage: string
          target_quantity: number | null
          unit_label: string | null
          updated_at: string
          verification_status: string
        }
        Insert: {
          buyer_name: string
          buyer_type?: string
          city?: string | null
          contact_email?: string | null
          contact_method?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          expected_unit_price?: number | null
          id?: string
          need_description?: string | null
          next_action?: string | null
          next_action_at?: string | null
          notes?: string | null
          product_id?: string | null
          provenance?: Json
          region?: string | null
          seller_id: string
          source_name?: string | null
          source_type?: string
          source_url?: string | null
          stage?: string
          target_quantity?: number | null
          unit_label?: string | null
          updated_at?: string
          verification_status?: string
        }
        Update: {
          buyer_name?: string
          buyer_type?: string
          city?: string | null
          contact_email?: string | null
          contact_method?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          expected_unit_price?: number | null
          id?: string
          need_description?: string | null
          next_action?: string | null
          next_action_at?: string | null
          notes?: string | null
          product_id?: string | null
          provenance?: Json
          region?: string | null
          seller_id?: string
          source_name?: string | null
          source_type?: string
          source_url?: string | null
          stage?: string
          target_quantity?: number | null
          unit_label?: string | null
          updated_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_sales_leads_product_seller_fk"
            columns: ["product_id", "seller_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id", "seller_id"]
          },
          {
            foreignKeyName: "marketplace_sales_leads_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_sales_tasks: {
        Row: {
          completion_note: string | null
          created_at: string
          due_at: string | null
          farm_id: string | null
          id: string
          lead_id: string | null
          notes: string | null
          priority: string
          product_id: string | null
          seller_id: string
          status: string
          task_type: string
          title: string
          updated_at: string
        }
        Insert: {
          completion_note?: string | null
          created_at?: string
          due_at?: string | null
          farm_id?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          priority?: string
          product_id?: string | null
          seller_id: string
          status?: string
          task_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          completion_note?: string | null
          created_at?: string
          due_at?: string | null
          farm_id?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          priority?: string
          product_id?: string | null
          seller_id?: string
          status?: string
          task_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_sales_tasks_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_sales_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sales_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_sales_tasks_product_seller_fk"
            columns: ["product_id", "seller_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id", "seller_id"]
          },
          {
            foreignKeyName: "marketplace_sales_tasks_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_seller_change_requests: {
        Row: {
          created_at: string
          id: string
          proposed_changes: Json
          reason: string | null
          requested_by: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          seller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          proposed_changes: Json
          reason?: string | null
          requested_by: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          seller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          proposed_changes?: Json
          reason?: string | null
          requested_by?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          seller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_seller_change_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_seller_change_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_seller_change_requests_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_sellers: {
        Row: {
          city: string | null
          contact_email: string | null
          contact_phone: string | null
          country_code: string | null
          created_at: string
          description: string | null
          display_name: string
          id: string
          legal_name: string | null
          organization_id: string | null
          owner_user_id: string
          region: string | null
          seller_type: string
          updated_at: string
          verification_notes: string | null
          verification_status: string
          website_url: string | null
        }
        Insert: {
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country_code?: string | null
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          legal_name?: string | null
          organization_id?: string | null
          owner_user_id: string
          region?: string | null
          seller_type: string
          updated_at?: string
          verification_notes?: string | null
          verification_status?: string
          website_url?: string | null
        }
        Update: {
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country_code?: string | null
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          legal_name?: string | null
          organization_id?: string | null
          owner_user_id?: string
          region?: string | null
          seller_type?: string
          updated_at?: string
          verification_notes?: string | null
          verification_status?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_sellers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_sellers_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_shipments: {
        Row: {
          carrier_name: string | null
          created_at: string
          delivered_at: string | null
          estimated_delivery: string | null
          id: string
          notes: string | null
          order_id: string
          seller_id: string
          shipped_at: string | null
          status: string
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
        }
        Insert: {
          carrier_name?: string | null
          created_at?: string
          delivered_at?: string | null
          estimated_delivery?: string | null
          id?: string
          notes?: string | null
          order_id: string
          seller_id: string
          shipped_at?: string | null
          status?: string
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Update: {
          carrier_name?: string | null
          created_at?: string
          delivered_at?: string | null
          estimated_delivery?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          seller_id?: string
          shipped_at?: string | null
          status?: string
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_shipments_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_trade_checklist_items: {
        Row: {
          category: string
          created_at: string
          id: string
          item_code: string
          notes: string | null
          provider_name: string | null
          route_id: string
          seller_id: string
          source_url: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          item_code: string
          notes?: string | null
          provider_name?: string | null
          route_id: string
          seller_id: string
          source_url?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          item_code?: string
          notes?: string | null
          provider_name?: string | null
          route_id?: string
          seller_id?: string
          source_url?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_trade_checklist_items_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_trade_checklist_route_seller_fk"
            columns: ["route_id", "seller_id"]
            isOneToOne: false
            referencedRelation: "marketplace_trade_routes"
            referencedColumns: ["id", "seller_id"]
          },
        ]
      }
      marketplace_trade_cost_models: {
        Row: {
          assumptions: Json
          calculated_unit_cost: number
          certification_cost: number
          contingency_percent: number
          created_at: string
          currency: string
          customs_cost: number
          destination_country: string
          farmgate_cost: number
          grading_cost: number
          id: string
          inland_transport_cost: number
          insurance_cost: number
          international_freight_cost: number
          notes: string | null
          other_cost: number
          packaging_cost: number
          platform_fee_percent: number
          product_id: string
          seller_id: string
          storage_cost: number
          suggested_unit_price: number
          target_margin_percent: number
          unit_label: string
          updated_at: string
        }
        Insert: {
          assumptions?: Json
          calculated_unit_cost: number
          certification_cost?: number
          contingency_percent?: number
          created_at?: string
          currency?: string
          customs_cost?: number
          destination_country: string
          farmgate_cost?: number
          grading_cost?: number
          id?: string
          inland_transport_cost?: number
          insurance_cost?: number
          international_freight_cost?: number
          notes?: string | null
          other_cost?: number
          packaging_cost?: number
          platform_fee_percent?: number
          product_id: string
          seller_id: string
          storage_cost?: number
          suggested_unit_price: number
          target_margin_percent?: number
          unit_label: string
          updated_at?: string
        }
        Update: {
          assumptions?: Json
          calculated_unit_cost?: number
          certification_cost?: number
          contingency_percent?: number
          created_at?: string
          currency?: string
          customs_cost?: number
          destination_country?: string
          farmgate_cost?: number
          grading_cost?: number
          id?: string
          inland_transport_cost?: number
          insurance_cost?: number
          international_freight_cost?: number
          notes?: string | null
          other_cost?: number
          packaging_cost?: number
          platform_fee_percent?: number
          product_id?: string
          seller_id?: string
          storage_cost?: number
          suggested_unit_price?: number
          target_margin_percent?: number
          unit_label?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_trade_cost_models_product_seller_fk"
            columns: ["product_id", "seller_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id", "seller_id"]
          },
          {
            foreignKeyName: "marketplace_trade_cost_models_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_trade_routes: {
        Row: {
          created_at: string
          destination_country: string
          hs_code: string | null
          id: string
          incoterm: string | null
          notes: string | null
          product_id: string
          seller_id: string
          shipment_mode: string
          status: string
          target_buyer_type: string
          target_quantity: number | null
          unit_label: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          destination_country: string
          hs_code?: string | null
          id?: string
          incoterm?: string | null
          notes?: string | null
          product_id: string
          seller_id: string
          shipment_mode?: string
          status?: string
          target_buyer_type?: string
          target_quantity?: number | null
          unit_label?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          destination_country?: string
          hs_code?: string | null
          id?: string
          incoterm?: string | null
          notes?: string | null
          product_id?: string
          seller_id?: string
          shipment_mode?: string
          status?: string
          target_buyer_type?: string
          target_quantity?: number | null
          unit_label?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_trade_routes_product_seller_fk"
            columns: ["product_id", "seller_id"]
            isOneToOne: false
            referencedRelation: "marketplace_products"
            referencedColumns: ["id", "seller_id"]
          },
          {
            foreignKeyName: "marketplace_trade_routes_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      messaging_channels: {
        Row: {
          channel_code: string
          channel_type: string
          display_name: string
          id: string
          is_active: boolean
        }
        Insert: {
          channel_code: string
          channel_type: string
          display_name: string
          id?: string
          is_active?: boolean
        }
        Update: {
          channel_code?: string
          channel_type?: string
          display_name?: string
          id?: string
          is_active?: boolean
        }
        Relationships: []
      }
      messaging_connections: {
        Row: {
          channel_id: string
          configuration: Json
          connection_status: string
          country_id: string | null
          created_at: string
          credentials_secret_ref: string | null
          external_account_ref: string | null
          id: string
          organization_id: string | null
          provider_name: string | null
          updated_at: string
        }
        Insert: {
          channel_id: string
          configuration?: Json
          connection_status?: string
          country_id?: string | null
          created_at?: string
          credentials_secret_ref?: string | null
          external_account_ref?: string | null
          id?: string
          organization_id?: string | null
          provider_name?: string | null
          updated_at?: string
        }
        Update: {
          channel_id?: string
          configuration?: Json
          connection_status?: string
          country_id?: string | null
          created_at?: string
          credentials_secret_ref?: string | null
          external_account_ref?: string | null
          id?: string
          organization_id?: string | null
          provider_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messaging_connections_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "messaging_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messaging_connections_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messaging_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_access_scopes: {
        Row: {
          country_id: string | null
          created_at: string
          created_by_user_id: string | null
          id: string
          label: string | null
          organization_id: string
          scope_type: string
          target_farm_id: string | null
          target_user_id: string | null
        }
        Insert: {
          country_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          label?: string | null
          organization_id: string
          scope_type: string
          target_farm_id?: string | null
          target_user_id?: string | null
        }
        Update: {
          country_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          label?: string | null
          organization_id?: string
          scope_type?: string
          target_farm_id?: string | null
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_access_scopes_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_access_scopes_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_access_scopes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_access_scopes_target_farm_id_fkey"
            columns: ["target_farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_access_scopes_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_applications: {
        Row: {
          address: string | null
          applicant_user_id: string
          city: string | null
          contact_email: string | null
          contact_phone: string | null
          contact_phones: string[]
          country_id: string | null
          country_name: string | null
          created_at: string
          description: string | null
          display_name: string
          id: string
          latitude: number | null
          legal_documents: Json
          legal_name: string
          longitude: number | null
          office_locations: Json
          organization_type: string
          registration_number: string | null
          service_regions: string[]
          social_links: Json
          status: string
          submitted_at: string
          support_areas: string[]
          updated_at: string
          website_url: string | null
        }
        Insert: {
          address?: string | null
          applicant_user_id: string
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          contact_phones?: string[]
          country_id?: string | null
          country_name?: string | null
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          latitude?: number | null
          legal_documents?: Json
          legal_name: string
          longitude?: number | null
          office_locations?: Json
          organization_type: string
          registration_number?: string | null
          service_regions?: string[]
          social_links?: Json
          status?: string
          submitted_at?: string
          support_areas?: string[]
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          address?: string | null
          applicant_user_id?: string
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          contact_phones?: string[]
          country_id?: string | null
          country_name?: string | null
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          latitude?: number | null
          legal_documents?: Json
          legal_name?: string
          longitude?: number | null
          office_locations?: Json
          organization_type?: string
          registration_number?: string | null
          service_regions?: string[]
          social_links?: Json
          status?: string
          submitted_at?: string
          support_areas?: string[]
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_applications_applicant_user_id_fkey"
            columns: ["applicant_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_applications_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_audit_events: {
        Row: {
          actor_user_id: string | null
          details: Json
          event_code: string
          id: string
          occurred_at: string
          organization_id: string | null
          subject_id: string | null
          subject_type: string | null
        }
        Insert: {
          actor_user_id?: string | null
          details?: Json
          event_code: string
          id?: string
          occurred_at?: string
          organization_id?: string | null
          subject_id?: string | null
          subject_type?: string | null
        }
        Update: {
          actor_user_id?: string | null
          details?: Json
          event_code?: string
          id?: string
          occurred_at?: string
          organization_id?: string | null
          subject_id?: string | null
          subject_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_audit_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_capabilities: {
        Row: {
          capability_code: string
          configuration: Json
          created_at: string
          id: string
          is_enabled: boolean
          organization_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          capability_code: string
          configuration?: Json
          created_at?: string
          id?: string
          is_enabled?: boolean
          organization_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          capability_code?: string
          configuration?: Json
          created_at?: string
          id?: string
          is_enabled?: boolean
          organization_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_capabilities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_capabilities_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          joined_at: string | null
          member_title: string | null
          membership_role: string
          organization_id: string
          status: string
          user_id: string
        }
        Insert: {
          joined_at?: string | null
          member_title?: string | null
          membership_role?: string
          organization_id: string
          status?: string
          user_id: string
        }
        Update: {
          joined_at?: string | null
          member_title?: string | null
          membership_role?: string
          organization_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_profiles: {
        Row: {
          applicant_user_id: string
          completion_percent: number
          created_at: string
          id: string
          profile_data: Json
          review_notes: string | null
          reviewed_at: string | null
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          applicant_user_id: string
          completion_percent?: number
          created_at?: string
          id?: string
          profile_data?: Json
          review_notes?: string | null
          reviewed_at?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          applicant_user_id?: string
          completion_percent?: number
          created_at?: string
          id?: string
          profile_data?: Json
          review_notes?: string | null
          reviewed_at?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_profiles_applicant_user_id_fkey"
            columns: ["applicant_user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_reviews: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          rating: number
          review_text: string | null
          reviewer_user_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          rating: number
          review_text?: string | null
          reviewer_user_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          rating?: number
          review_text?: string | null
          reviewer_user_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_reviews_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_reviews_reviewer_user_id_fkey"
            columns: ["reviewer_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_services: {
        Row: {
          audience: string[]
          authority_scope: Json
          configuration: Json
          created_at: string
          created_by_user_id: string | null
          description: string | null
          eligibility_rules: Json
          ends_at: string | null
          external_service_code: string | null
          id: string
          is_official_authority: boolean
          legal_basis: string | null
          official_contact: string | null
          official_service_url: string | null
          organization_id: string
          public_description: string | null
          required_documents: Json
          response_sla_days: number | null
          service_category: string | null
          service_code: string
          service_regions: string[]
          starts_at: string | null
          status: string
          submission_mode: string
          title: string
          updated_at: string
        }
        Insert: {
          audience?: string[]
          authority_scope?: Json
          configuration?: Json
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          eligibility_rules?: Json
          ends_at?: string | null
          external_service_code?: string | null
          id?: string
          is_official_authority?: boolean
          legal_basis?: string | null
          official_contact?: string | null
          official_service_url?: string | null
          organization_id: string
          public_description?: string | null
          required_documents?: Json
          response_sla_days?: number | null
          service_category?: string | null
          service_code: string
          service_regions?: string[]
          starts_at?: string | null
          status?: string
          submission_mode?: string
          title: string
          updated_at?: string
        }
        Update: {
          audience?: string[]
          authority_scope?: Json
          configuration?: Json
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          eligibility_rules?: Json
          ends_at?: string | null
          external_service_code?: string | null
          id?: string
          is_official_authority?: boolean
          legal_basis?: string | null
          official_contact?: string | null
          official_service_url?: string | null
          organization_id?: string
          public_description?: string | null
          required_documents?: Json
          response_sla_days?: number | null
          service_category?: string | null
          service_code?: string
          service_regions?: string[]
          starts_at?: string | null
          status?: string
          submission_mode?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_services_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          city: string | null
          contact_email: string | null
          contact_phone: string | null
          country_id: string | null
          created_at: string
          creation_source: string
          description: string | null
          display_name: string
          id: string
          legal_name: string
          metadata: Json
          organization_type: string
          registration_number: string | null
          service_regions: string[]
          specialties: string[]
          status: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country_id?: string | null
          created_at?: string
          creation_source?: string
          description?: string | null
          display_name: string
          id?: string
          legal_name: string
          metadata?: Json
          organization_type: string
          registration_number?: string | null
          service_regions?: string[]
          specialties?: string[]
          status?: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country_id?: string | null
          created_at?: string
          creation_source?: string
          description?: string | null
          display_name?: string
          id?: string
          legal_name?: string
          metadata?: Json
          organization_type?: string
          registration_number?: string | null
          service_regions?: string[]
          specialties?: string[]
          status?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          confirmed_at: string | null
          created_at: string
          currency_code: string
          id: string
          idempotency_key: string | null
          initiated_at: string
          invoice_id: string
          payer_user_id: string
          payment_provider: string
          provider_payload_ref: string | null
          provider_transaction_ref: string | null
          status: string
        }
        Insert: {
          amount: number
          confirmed_at?: string | null
          created_at?: string
          currency_code: string
          id?: string
          idempotency_key?: string | null
          initiated_at?: string
          invoice_id: string
          payer_user_id: string
          payment_provider: string
          provider_payload_ref?: string | null
          provider_transaction_ref?: string | null
          status?: string
        }
        Update: {
          amount?: number
          confirmed_at?: string | null
          created_at?: string
          currency_code?: string
          id?: string
          idempotency_key?: string | null
          initiated_at?: string
          invoice_id?: string
          payer_user_id?: string
          payment_provider?: string
          provider_payload_ref?: string | null
          provider_transaction_ref?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "contract_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_payer_user_id_fkey"
            columns: ["payer_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          code: string
          description: string | null
          id: string
        }
        Insert: {
          code: string
          description?: string | null
          id?: string
        }
        Update: {
          code?: string
          description?: string | null
          id?: string
        }
        Relationships: []
      }
      recommendation_actions: {
        Row: {
          action_type: string
          id: string
          notes: string | null
          occurred_at: string
          recommendation_id: string
          user_id: string
        }
        Insert: {
          action_type: string
          id?: string
          notes?: string | null
          occurred_at?: string
          recommendation_id: string
          user_id: string
        }
        Update: {
          action_type?: string
          id?: string
          notes?: string | null
          occurred_at?: string
          recommendation_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_actions_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "farm_recommendations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_actions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      regional_data_sources: {
        Row: {
          coverage_notes: string | null
          created_at: string
          id: string
          is_active: boolean
          license_name: string | null
          provider: string | null
          source_name: string
          source_url: string | null
          update_frequency: string | null
        }
        Insert: {
          coverage_notes?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          license_name?: string | null
          provider?: string | null
          source_name: string
          source_url?: string | null
          update_frequency?: string | null
        }
        Update: {
          coverage_notes?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          license_name?: string | null
          provider?: string | null
          source_name?: string
          source_url?: string | null
          update_frequency?: string | null
        }
        Relationships: []
      }
      regional_datasets: {
        Row: {
          confidence_level: string | null
          dataset_type: string
          farm_id: string
          id: string
          observed_at: string | null
          payload: Json
          quality_score: number | null
          retrieved_at: string
          source_id: string
          valid_until: string | null
        }
        Insert: {
          confidence_level?: string | null
          dataset_type: string
          farm_id: string
          id?: string
          observed_at?: string | null
          payload?: Json
          quality_score?: number | null
          retrieved_at?: string
          source_id: string
          valid_until?: string | null
        }
        Update: {
          confidence_level?: string | null
          dataset_type?: string
          farm_id?: string
          id?: string
          observed_at?: string | null
          payload?: Json
          quality_score?: number | null
          retrieved_at?: string
          source_id?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regional_datasets_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regional_datasets_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "regional_data_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          code: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      sarina_service_entitlements: {
        Row: {
          access_status: string
          created_at: string
          expires_at: string | null
          id: string
          metadata: Json
          service_code: string
          source_code: string
          starts_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_status?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          service_code: string
          source_code?: string
          starts_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_status?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          service_code?: string
          source_code?: string
          starts_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sarina_service_entitlements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      service_contracts: {
        Row: {
          base_amount: number
          cancelled_at: string | null
          completed_at: string | null
          contract_code: string
          created_at: string
          currency_code: string
          description: string
          end_at: string | null
          expert_accepted_at: string | null
          expert_profile_id: string | null
          expert_result_share_rate: number | null
          farm_id: string | null
          farmer_accepted_at: string | null
          farmer_user_id: string
          id: string
          payment_schedule: Json
          platform_fee_model: string
          platform_fee_rate: number | null
          pricing_model: string
          proposed_at: string | null
          result_definition: Json
          service_key: string | null
          service_type: string
          source_request_id: string | null
          start_at: string | null
          status: string
          terms_snapshot: Json
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          base_amount?: number
          cancelled_at?: string | null
          completed_at?: string | null
          contract_code?: string
          created_at?: string
          currency_code?: string
          description?: string
          end_at?: string | null
          expert_accepted_at?: string | null
          expert_profile_id?: string | null
          expert_result_share_rate?: number | null
          farm_id?: string | null
          farmer_accepted_at?: string | null
          farmer_user_id: string
          id?: string
          payment_schedule?: Json
          platform_fee_model?: string
          platform_fee_rate?: number | null
          pricing_model: string
          proposed_at?: string | null
          result_definition?: Json
          service_key?: string | null
          service_type: string
          source_request_id?: string | null
          start_at?: string | null
          status?: string
          terms_snapshot?: Json
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          base_amount?: number
          cancelled_at?: string | null
          completed_at?: string | null
          contract_code?: string
          created_at?: string
          currency_code?: string
          description?: string
          end_at?: string | null
          expert_accepted_at?: string | null
          expert_profile_id?: string | null
          expert_result_share_rate?: number | null
          farm_id?: string | null
          farmer_accepted_at?: string | null
          farmer_user_id?: string
          id?: string
          payment_schedule?: Json
          platform_fee_model?: string
          platform_fee_rate?: number | null
          pricing_model?: string
          proposed_at?: string | null
          result_definition?: Json
          service_key?: string | null
          service_type?: string
          source_request_id?: string | null
          start_at?: string | null
          status?: string
          terms_snapshot?: Json
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_contracts_expert_profile_id_fkey"
            columns: ["expert_profile_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_contracts_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_contracts_farmer_user_id_fkey"
            columns: ["farmer_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_contracts_source_request_id_fkey"
            columns: ["source_request_id"]
            isOneToOne: false
            referencedRelation: "expert_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      siacp_key_registry: {
        Row: {
          alg: string
          created_at: string
          id: string
          kid: string
          notes: Json
          public_key_b64url: string
          public_key_fingerprint: string
          revoked_at: string | null
          sender: string
          status: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          alg: string
          created_at?: string
          id?: string
          kid: string
          notes?: Json
          public_key_b64url: string
          public_key_fingerprint: string
          revoked_at?: string | null
          sender: string
          status?: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          alg?: string
          created_at?: string
          id?: string
          kid?: string
          notes?: Json
          public_key_b64url?: string
          public_key_fingerprint?: string
          revoked_at?: string | null
          sender?: string
          status?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      soil_tests: {
        Row: {
          calcium_carbonate_pct: number | null
          cec_cmol_kg: number | null
          chloride_mg_kg: number | null
          created_at: string
          created_by: string | null
          data_source: string
          ec_ds_m: number | null
          farm_id: string
          field_id: string | null
          id: string
          laboratory_name: string | null
          nitrogen_mg_kg: number | null
          notes: string | null
          organic_matter_pct: number | null
          ph: number | null
          phosphorus_mg_kg: number | null
          potassium_mg_kg: number | null
          report_file_ref: string | null
          sample_code: string | null
          sampled_at: string
          sodium_mg_kg: number | null
          soil_texture: string | null
          test_method: string | null
        }
        Insert: {
          calcium_carbonate_pct?: number | null
          cec_cmol_kg?: number | null
          chloride_mg_kg?: number | null
          created_at?: string
          created_by?: string | null
          data_source?: string
          ec_ds_m?: number | null
          farm_id: string
          field_id?: string | null
          id?: string
          laboratory_name?: string | null
          nitrogen_mg_kg?: number | null
          notes?: string | null
          organic_matter_pct?: number | null
          ph?: number | null
          phosphorus_mg_kg?: number | null
          potassium_mg_kg?: number | null
          report_file_ref?: string | null
          sample_code?: string | null
          sampled_at: string
          sodium_mg_kg?: number | null
          soil_texture?: string | null
          test_method?: string | null
        }
        Update: {
          calcium_carbonate_pct?: number | null
          cec_cmol_kg?: number | null
          chloride_mg_kg?: number | null
          created_at?: string
          created_by?: string | null
          data_source?: string
          ec_ds_m?: number | null
          farm_id?: string
          field_id?: string | null
          id?: string
          laboratory_name?: string | null
          nitrogen_mg_kg?: number | null
          notes?: string | null
          organic_matter_pct?: number | null
          ph?: number | null
          phosphorus_mg_kg?: number | null
          potassium_mg_kg?: number | null
          report_file_ref?: string | null
          sample_code?: string | null
          sampled_at?: string
          sodium_mg_kg?: number | null
          soil_texture?: string | null
          test_method?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "soil_tests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soil_tests_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soil_tests_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "farm_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          role_id: string
          scope_id: string | null
          scope_type: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          role_id: string
          scope_id?: string | null
          scope_type?: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          role_id?: string
          scope_id?: string | null
          scope_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          account_status: string
          auth_user_id: string | null
          communication_preferences: Json
          country_id: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone_e164: string | null
          preferred_language: string
          updated_at: string
        }
        Insert: {
          account_status?: string
          auth_user_id?: string | null
          communication_preferences?: Json
          country_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone_e164?: string | null
          preferred_language?: string
          updated_at?: string
        }
        Update: {
          account_status?: string
          auth_user_id?: string | null
          communication_preferences?: Json
          country_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone_e164?: string | null
          preferred_language?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      water_tests: {
        Row: {
          bicarbonate_mg_l: number | null
          boron_mg_l: number | null
          calcium_mg_l: number | null
          chloride_mg_l: number | null
          created_at: string
          created_by: string | null
          data_source: string
          ec_ds_m: number | null
          farm_id: string
          id: string
          laboratory_name: string | null
          magnesium_mg_l: number | null
          notes: string | null
          ph: number | null
          report_file_ref: string | null
          sample_code: string | null
          sampled_at: string
          sar: number | null
          sodium_mg_l: number | null
          tds_mg_l: number | null
          test_method: string | null
          water_source: string | null
        }
        Insert: {
          bicarbonate_mg_l?: number | null
          boron_mg_l?: number | null
          calcium_mg_l?: number | null
          chloride_mg_l?: number | null
          created_at?: string
          created_by?: string | null
          data_source?: string
          ec_ds_m?: number | null
          farm_id: string
          id?: string
          laboratory_name?: string | null
          magnesium_mg_l?: number | null
          notes?: string | null
          ph?: number | null
          report_file_ref?: string | null
          sample_code?: string | null
          sampled_at: string
          sar?: number | null
          sodium_mg_l?: number | null
          tds_mg_l?: number | null
          test_method?: string | null
          water_source?: string | null
        }
        Update: {
          bicarbonate_mg_l?: number | null
          boron_mg_l?: number | null
          calcium_mg_l?: number | null
          chloride_mg_l?: number | null
          created_at?: string
          created_by?: string | null
          data_source?: string
          ec_ds_m?: number | null
          farm_id?: string
          id?: string
          laboratory_name?: string | null
          magnesium_mg_l?: number | null
          notes?: string | null
          ph?: number | null
          report_file_ref?: string | null
          sample_code?: string | null
          sampled_at?: string
          sar?: number | null
          sodium_mg_l?: number | null
          tds_mg_l?: number | null
          test_method?: string | null
          water_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "water_tests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "water_tests_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      weather_records: {
        Row: {
          created_at: string
          data_kind: string
          farm_id: string
          feels_like_c: number | null
          id: string
          observed_at: string
          precipitation_mm: number | null
          quality_score: number | null
          raw_payload: Json
          relative_humidity_pct: number | null
          solar_radiation_w_m2: number | null
          source_id: string | null
          temperature_c: number | null
          wind_direction_deg: number | null
          wind_speed_m_s: number | null
        }
        Insert: {
          created_at?: string
          data_kind?: string
          farm_id: string
          feels_like_c?: number | null
          id?: string
          observed_at: string
          precipitation_mm?: number | null
          quality_score?: number | null
          raw_payload?: Json
          relative_humidity_pct?: number | null
          solar_radiation_w_m2?: number | null
          source_id?: string | null
          temperature_c?: number | null
          wind_direction_deg?: number | null
          wind_speed_m_s?: number | null
        }
        Update: {
          created_at?: string
          data_kind?: string
          farm_id?: string
          feels_like_c?: number | null
          id?: string
          observed_at?: string
          precipitation_mm?: number | null
          quality_score?: number | null
          raw_payload?: Json
          relative_humidity_pct?: number | null
          solar_radiation_w_m2?: number | null
          source_id?: string | null
          temperature_c?: number | null
          wind_direction_deg?: number | null
          wind_speed_m_s?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "weather_records_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weather_records_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "regional_data_sources"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      organization_rating_summary: {
        Row: {
          average_rating: number | null
          organization_id: string | null
          review_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_reviews_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      cancel_marketplace_order: {
        Args: { p_order_id: string }
        Returns: boolean
      }
      create_marketplace_order: {
        Args: {
          p_buyer_note?: string
          p_seller_id: string
          p_shipping_address: Json
        }
        Returns: string
      }
      create_marketplace_quote_request: {
        Args: {
          p_message: string
          p_product_id: string
          p_quantity: number
          p_seller_id: string
          p_unit_label: string
        }
        Returns: string
      }
      current_sarina_user_id: { Args: never; Returns: string }
      current_user_has_role: { Args: { p_role_code: string }; Returns: boolean }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      gettransactionid: { Args: never; Returns: unknown }
      is_sarina_admin: { Args: never; Returns: boolean }
      list_my_marketplace_organizations: {
        Args: never
        Returns: {
          display_name: string
          organization_id: string
        }[]
      }
      list_my_marketplace_seller_change_requests: {
        Args: { p_seller_id: string }
        Returns: {
          created_at: string
          id: string
          proposed_changes: Json
          reason: string
          review_note: string
          reviewed_at: string
          status: string
        }[]
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      organization_has_scoped_access: {
        Args: {
          p_capability_code: string
          p_organization_id: string
          p_target_country_id?: string
          p_target_farm_id?: string
          p_target_user_id?: string
        }
        Returns: boolean
      }
      organization_member_has_capability: {
        Args: { p_capability_code: string; p_organization_id: string }
        Returns: boolean
      }
      organization_update_institutional_request: {
        Args: {
          p_external_tracking_reference?: string
          p_message?: string
          p_new_status: string
          p_official_reference?: string
          p_request_id: string
        }
        Returns: boolean
      }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      review_marketplace_seller_change_request: {
        Args: {
          p_decision: string
          p_request_id: string
          p_review_note?: string
        }
        Returns: boolean
      }
      set_my_sarina_roles: {
        Args: { p_role_codes: string[] }
        Returns: {
          role_code: string
        }[]
      }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      submit_marketplace_seller_change_request: {
        Args: {
          p_proposed_changes: Json
          p_reason?: string
          p_seller_id: string
        }
        Returns: string
      }
      submit_organization_review: {
        Args: {
          p_organization_id: string
          p_rating: number
          p_review_text?: string
        }
        Returns: string
      }
      transition_service_contract: {
        Args: {
          p_action: string
          p_actor_user_id: string
          p_contract_id: string
        }
        Returns: Json
      }
      unlockrows: { Args: { "": string }; Returns: number }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
