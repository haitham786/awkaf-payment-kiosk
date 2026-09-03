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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      apex_invoice_map: {
        Row: {
          created_at: string
          invoice_number: string
          kiosk_id: string
          transaction_id: string
        }
        Insert: {
          created_at?: string
          invoice_number: string
          kiosk_id: string
          transaction_id: string
        }
        Update: {
          created_at?: string
          invoice_number?: string
          kiosk_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "apex_invoice_map_kiosk_id_fkey"
            columns: ["kiosk_id"]
            isOneToOne: false
            referencedRelation: "kiosks"
            referencedColumns: ["id"]
          },
        ]
      }
      apex_invoice_sequences: {
        Row: {
          kiosk_id: string
          next_value: number
          updated_at: string
        }
        Insert: {
          kiosk_id: string
          next_value?: number
          updated_at?: string
        }
        Update: {
          kiosk_id?: string
          next_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "apex_invoice_sequences_kiosk_id_fkey"
            columns: ["kiosk_id"]
            isOneToOne: true
            referencedRelation: "kiosks"
            referencedColumns: ["id"]
          },
        ]
      }
      apex_terminal_sessions: {
        Row: {
          cancel_cooldown_until: string | null
          cancel_requested: boolean
          created_at: string
          kiosk_id: string
          lease_expires_at: string
          pending_transaction_id: string | null
          result: Json | null
          state: string
          terminal_id: string
          transaction_id: string
          updated_at: string
        }
        Insert: {
          cancel_cooldown_until?: string | null
          cancel_requested?: boolean
          created_at?: string
          kiosk_id: string
          lease_expires_at: string
          pending_transaction_id?: string | null
          result?: Json | null
          state: string
          terminal_id: string
          transaction_id: string
          updated_at?: string
        }
        Update: {
          cancel_cooldown_until?: string | null
          cancel_requested?: boolean
          created_at?: string
          kiosk_id?: string
          lease_expires_at?: string
          pending_transaction_id?: string | null
          result?: Json | null
          state?: string
          terminal_id?: string
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "apex_terminal_sessions_kiosk_id_fkey"
            columns: ["kiosk_id"]
            isOneToOne: true
            referencedRelation: "kiosks"
            referencedColumns: ["id"]
          },
        ]
      }
      donation_categories: {
        Row: {
          category_id: string
          category_reference: string | null
          created_at: string | null
          description: string
          description_en: string | null
          display_order: number
          icon_url: string | null
          id: string
          info_text: string | null
          info_text_en: string | null
          is_visible: boolean | null
          title: string
          title_en: string | null
          updated_at: string | null
        }
        Insert: {
          category_id: string
          category_reference?: string | null
          created_at?: string | null
          description: string
          description_en?: string | null
          display_order: number
          icon_url?: string | null
          id?: string
          info_text?: string | null
          info_text_en?: string | null
          is_visible?: boolean | null
          title: string
          title_en?: string | null
          updated_at?: string | null
        }
        Update: {
          category_id?: string
          category_reference?: string | null
          created_at?: string | null
          description?: string
          description_en?: string | null
          display_order?: number
          icon_url?: string | null
          id?: string
          info_text?: string | null
          info_text_en?: string | null
          is_visible?: boolean | null
          title?: string
          title_en?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      kiosk_pos_status: {
        Row: {
          alerted_at: string | null
          alerted_state: string | null
          app_version: string | null
          battery_ok: boolean | null
          connection_info: string | null
          error_code: string | null
          firmware_version: string | null
          kiosk_id: string
          last_transaction_at: string | null
          last_transaction_result: string | null
          message: string | null
          paper_ok: boolean | null
          printer_status: string | null
          reader_status: string | null
          responded: boolean
          serial_number: string | null
          state: string
          state_since: string
          terminal_label: string | null
          tid: string | null
          transport_connected: boolean
          updated_at: string
        }
        Insert: {
          alerted_at?: string | null
          alerted_state?: string | null
          app_version?: string | null
          battery_ok?: boolean | null
          connection_info?: string | null
          error_code?: string | null
          firmware_version?: string | null
          kiosk_id: string
          last_transaction_at?: string | null
          last_transaction_result?: string | null
          message?: string | null
          paper_ok?: boolean | null
          printer_status?: string | null
          reader_status?: string | null
          responded?: boolean
          serial_number?: string | null
          state?: string
          state_since?: string
          terminal_label?: string | null
          tid?: string | null
          transport_connected?: boolean
          updated_at?: string
        }
        Update: {
          alerted_at?: string | null
          alerted_state?: string | null
          app_version?: string | null
          battery_ok?: boolean | null
          connection_info?: string | null
          error_code?: string | null
          firmware_version?: string | null
          kiosk_id?: string
          last_transaction_at?: string | null
          last_transaction_result?: string | null
          message?: string | null
          paper_ok?: boolean | null
          printer_status?: string | null
          reader_status?: string | null
          responded?: boolean
          serial_number?: string | null
          state?: string
          state_since?: string
          terminal_label?: string | null
          tid?: string | null
          transport_connected?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kiosk_pos_status_kiosk_id_fkey"
            columns: ["kiosk_id"]
            isOneToOne: true
            referencedRelation: "kiosks"
            referencedColumns: ["id"]
          },
        ]
      }
      kiosk_pos_status_history: {
        Row: {
          battery_ok: boolean | null
          created_at: string
          error_code: string | null
          id: string
          kiosk_id: string
          message: string | null
          paper_ok: boolean | null
          previous_state: string | null
          responded: boolean | null
          state: string
          transport_connected: boolean | null
        }
        Insert: {
          battery_ok?: boolean | null
          created_at?: string
          error_code?: string | null
          id?: string
          kiosk_id: string
          message?: string | null
          paper_ok?: boolean | null
          previous_state?: string | null
          responded?: boolean | null
          state: string
          transport_connected?: boolean | null
        }
        Update: {
          battery_ok?: boolean | null
          created_at?: string
          error_code?: string | null
          id?: string
          kiosk_id?: string
          message?: string | null
          paper_ok?: boolean | null
          previous_state?: string | null
          responded?: boolean | null
          state?: string
          transport_connected?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "kiosk_pos_status_history_kiosk_id_fkey"
            columns: ["kiosk_id"]
            isOneToOne: false
            referencedRelation: "kiosks"
            referencedColumns: ["id"]
          },
        ]
      }
      kiosk_secrets: {
        Row: {
          access_token: string
          apex_secure_key: string | null
          created_at: string
          kiosk_id: string
          soft_pos_auth_key: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string
          apex_secure_key?: string | null
          created_at?: string
          kiosk_id: string
          soft_pos_auth_key?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          apex_secure_key?: string | null
          created_at?: string
          kiosk_id?: string
          soft_pos_auth_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kiosk_secrets_kiosk_id_fkey"
            columns: ["kiosk_id"]
            isOneToOne: true
            referencedRelation: "kiosks"
            referencedColumns: ["id"]
          },
        ]
      }
      kiosk_settings: {
        Row: {
          background_image_url: string | null
          created_at: string | null
          id: string
          logo_url: string | null
          pos_type: string | null
          quranic_verse: string | null
          quranic_verse_surah: string | null
          updated_at: string | null
        }
        Insert: {
          background_image_url?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          pos_type?: string | null
          quranic_verse?: string | null
          quranic_verse_surah?: string | null
          updated_at?: string | null
        }
        Update: {
          background_image_url?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          pos_type?: string | null
          quranic_verse?: string | null
          quranic_verse_surah?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      kiosks: {
        Row: {
          configuration: Json | null
          created_at: string
          id: string
          last_heartbeat: string | null
          location: string
          name: string
          reference_number: string | null
          status: Database["public"]["Enums"]["kiosk_status"]
          updated_at: string
        }
        Insert: {
          configuration?: Json | null
          created_at?: string
          id?: string
          last_heartbeat?: string | null
          location: string
          name: string
          reference_number?: string | null
          status?: Database["public"]["Enums"]["kiosk_status"]
          updated_at?: string
        }
        Update: {
          configuration?: Json | null
          created_at?: string
          id?: string
          last_heartbeat?: string | null
          location?: string
          name?: string
          reference_number?: string | null
          status?: Database["public"]["Enums"]["kiosk_status"]
          updated_at?: string
        }
        Relationships: []
      }
      messaging_rates: {
        Row: {
          created_at: string
          id: string
          sms_unit_cost_omr: number
          updated_at: string
          whatsapp_unit_cost_omr: number
        }
        Insert: {
          created_at?: string
          id?: string
          sms_unit_cost_omr?: number
          updated_at?: string
          whatsapp_unit_cost_omr?: number
        }
        Update: {
          created_at?: string
          id?: string
          sms_unit_cost_omr?: number
          updated_at?: string
          whatsapp_unit_cost_omr?: number
        }
        Relationships: []
      }
      offline_transaction_queue: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          kiosk_id: string | null
          retry_count: number
          status: string
          synced_at: string | null
          transaction_data: Json
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          kiosk_id?: string | null
          retry_count?: number
          status?: string
          synced_at?: string | null
          transaction_data: Json
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          kiosk_id?: string | null
          retry_count?: number
          status?: string
          synced_at?: string | null
          transaction_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "offline_transaction_queue_kiosk_id_fkey"
            columns: ["kiosk_id"]
            isOneToOne: false
            referencedRelation: "kiosks"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_alert_settings: {
        Row: {
          alert_on_attention: boolean
          channel: string
          enabled: boolean
          id: string
          kiosk_id: string | null
          offline_threshold_seconds: number
          quiet_hours_end: number | null
          quiet_hours_start: number | null
          recipients: string[]
          updated_at: string
        }
        Insert: {
          alert_on_attention?: boolean
          channel?: string
          enabled?: boolean
          id?: string
          kiosk_id?: string | null
          offline_threshold_seconds?: number
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          recipients?: string[]
          updated_at?: string
        }
        Update: {
          alert_on_attention?: boolean
          channel?: string
          enabled?: boolean
          id?: string
          kiosk_id?: string | null
          offline_threshold_seconds?: number
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          recipients?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_alert_settings_kiosk_id_fkey"
            columns: ["kiosk_id"]
            isOneToOne: false
            referencedRelation: "kiosks"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_diagnostics: {
        Row: {
          afs_round_trip_ms: number | null
          amount_baisas: number | null
          correlation_id: string | null
          created_at: string
          dispatch_attempts: number | null
          dispatched: boolean | null
          failure_type: string | null
          http_status: number | null
          id: string
          invoice_number: string | null
          kiosk_id: string | null
          outcome: string | null
          pos_resp_code: string | null
          pos_resp_status: string | null
          request_to_dispatch_ms: number | null
          seconds_since_previous_attempt: number | null
          session_state_before: string | null
          transaction_id: string | null
          web_response_error: string | null
          web_response_status: string | null
        }
        Insert: {
          afs_round_trip_ms?: number | null
          amount_baisas?: number | null
          correlation_id?: string | null
          created_at?: string
          dispatch_attempts?: number | null
          dispatched?: boolean | null
          failure_type?: string | null
          http_status?: number | null
          id?: string
          invoice_number?: string | null
          kiosk_id?: string | null
          outcome?: string | null
          pos_resp_code?: string | null
          pos_resp_status?: string | null
          request_to_dispatch_ms?: number | null
          seconds_since_previous_attempt?: number | null
          session_state_before?: string | null
          transaction_id?: string | null
          web_response_error?: string | null
          web_response_status?: string | null
        }
        Update: {
          afs_round_trip_ms?: number | null
          amount_baisas?: number | null
          correlation_id?: string | null
          created_at?: string
          dispatch_attempts?: number | null
          dispatched?: boolean | null
          failure_type?: string | null
          http_status?: number | null
          id?: string
          invoice_number?: string | null
          kiosk_id?: string | null
          outcome?: string | null
          pos_resp_code?: string | null
          pos_resp_status?: string | null
          request_to_dispatch_ms?: number | null
          seconds_since_previous_attempt?: number | null
          session_state_before?: string | null
          transaction_id?: string | null
          web_response_error?: string | null
          web_response_status?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          first_login: boolean | null
          full_name: string | null
          id: string
          mobile_number: string | null
          profile_picture_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          first_login?: boolean | null
          full_name?: string | null
          id: string
          mobile_number?: string | null
          profile_picture_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_login?: boolean | null
          full_name?: string | null
          id?: string
          mobile_number?: string | null
          profile_picture_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sms_settings: {
        Row: {
          api_endpoint: string
          api_key: string | null
          api_password: string | null
          api_username: string | null
          created_at: string | null
          id: string
          sender_id: string | null
          updated_at: string | null
        }
        Insert: {
          api_endpoint: string
          api_key?: string | null
          api_password?: string | null
          api_username?: string | null
          created_at?: string | null
          id?: string
          sender_id?: string | null
          updated_at?: string | null
        }
        Update: {
          api_endpoint?: string
          api_key?: string | null
          api_password?: string | null
          api_username?: string | null
          created_at?: string | null
          id?: string
          sender_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount_baisas: number
          card_last_four: string | null
          category: Database["public"]["Enums"]["donation_category"]
          category_reference: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          kiosk_id: string | null
          mobile_number: string | null
          payment_method: string | null
          payment_reference: string | null
          pos_auth_code: string | null
          pos_mid: string | null
          pos_response: Json | null
          pos_response_code: string | null
          pos_rrn: string | null
          pos_tid: string | null
          receipt_printed: boolean | null
          receipt_sent: boolean | null
          reference_number: string | null
          sms_status: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          whatsapp_status: string | null
        }
        Insert: {
          amount_baisas: number
          card_last_four?: string | null
          category: Database["public"]["Enums"]["donation_category"]
          category_reference?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          kiosk_id?: string | null
          mobile_number?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          pos_auth_code?: string | null
          pos_mid?: string | null
          pos_response?: Json | null
          pos_response_code?: string | null
          pos_rrn?: string | null
          pos_tid?: string | null
          receipt_printed?: boolean | null
          receipt_sent?: boolean | null
          reference_number?: string | null
          sms_status?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          whatsapp_status?: string | null
        }
        Update: {
          amount_baisas?: number
          card_last_four?: string | null
          category?: Database["public"]["Enums"]["donation_category"]
          category_reference?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          kiosk_id?: string | null
          mobile_number?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          pos_auth_code?: string | null
          pos_mid?: string | null
          pos_response?: Json | null
          pos_response_code?: string | null
          pos_rrn?: string | null
          pos_tid?: string | null
          receipt_printed?: boolean | null
          receipt_sent?: boolean | null
          reference_number?: string | null
          sms_status?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          whatsapp_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_kiosk_id_fkey"
            columns: ["kiosk_id"]
            isOneToOne: false
            referencedRelation: "kiosks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_settings: {
        Row: {
          created_at: string
          from_number: string
          id: string
          is_enabled: boolean
          template_language: string
          template_sid: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          from_number?: string
          id?: string
          is_enabled?: boolean
          template_language?: string
          template_sid?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          from_number?: string
          id?: string
          is_enabled?: boolean
          template_language?: string
          template_sid?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acquire_apex_terminal_session: {
        Args: {
          _kiosk_id: string
          _lease_seconds?: number
          _terminal_id: string
          _transaction_id: string
        }
        Returns: {
          acquisition: string
          cancel_cooldown_until: string
          owner_transaction_id: string
          session_state: string
          stored_result: Json
        }[]
      }
      activate_recovered_apex_session: {
        Args: {
          _kiosk_id: string
          _lease_seconds?: number
          _transaction_id: string
        }
        Returns: boolean
      }
      apex_invoice_for: {
        Args: { _kiosk_id: string; _transaction_id: string }
        Returns: string
      }
      begin_apex_sale: {
        Args: {
          _kiosk_id: string
          _lease_seconds?: number
          _transaction_id: string
        }
        Returns: {
          acquisition: string
          cancel_cooldown_until: string
          configuration: Json
          kiosk_status: string
          owner_transaction_id: string
          secure_key: string
          session_state: string
          stored_result: Json
        }[]
      }
      claim_stale_apex_session: {
        Args: { _kiosk_id: string; _transaction_id: string }
        Returns: boolean
      }
      finish_apex_terminal_session: {
        Args: {
          _kiosk_id: string
          _result?: Json
          _state: string
          _transaction_id: string
        }
        Returns: boolean
      }
      generate_reference_number: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_apex_cancel_dispatched: {
        Args: { _cooldown_ms?: number; _kiosk_id: string }
        Returns: undefined
      }
      request_apex_terminal_cancellation: {
        Args: { _kiosk_id: string; _transaction_id: string }
        Returns: {
          allowed: boolean
          session_state: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "operator" | "viewer" | "super_admin"
      donation_category: "donation" | "zakat" | "sadaqah" | "general"
      kiosk_status: "active" | "inactive" | "maintenance" | "pending_approval"
      transaction_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
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
    Enums: {
      app_role: ["admin", "operator", "viewer", "super_admin"],
      donation_category: ["donation", "zakat", "sadaqah", "general"],
      kiosk_status: ["active", "inactive", "maintenance", "pending_approval"],
      transaction_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "cancelled",
      ],
    },
  },
} as const
