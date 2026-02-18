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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          lifecycle_context: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          lifecycle_context?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          lifecycle_context?: Json | null
        }
        Relationships: []
      }
      card_deliveries: {
        Row: {
          created_at: string
          id: string
          invitee_locator: string | null
          issuance_id: string
          recipient_member_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          invitee_locator?: string | null
          issuance_id: string
          recipient_member_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          invitee_locator?: string | null
          issuance_id?: string
          recipient_member_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_deliveries_issuance_id_fkey"
            columns: ["issuance_id"]
            isOneToOne: false
            referencedRelation: "card_issuances"
            referencedColumns: ["id"]
          },
        ]
      }
      card_forms: {
        Row: {
          created_at: string
          form_type: Database["public"]["Enums"]["card_form_type"]
          id: string
          name: string
          registered_at: string | null
          schema_definition: Json
          status: Database["public"]["Enums"]["card_form_status"]
        }
        Insert: {
          created_at?: string
          form_type: Database["public"]["Enums"]["card_form_type"]
          id?: string
          name: string
          registered_at?: string | null
          schema_definition: Json
          status?: Database["public"]["Enums"]["card_form_status"]
        }
        Update: {
          created_at?: string
          form_type?: Database["public"]["Enums"]["card_form_type"]
          id?: string
          name?: string
          registered_at?: string | null
          schema_definition?: Json
          status?: Database["public"]["Enums"]["card_form_status"]
        }
        Relationships: []
      }
      card_instances: {
        Row: {
          created_at: string
          form_id: string
          id: string
          is_current: boolean
          member_id: string
          payload: Json
          superseded_at: string | null
          superseded_by: string | null
        }
        Insert: {
          created_at?: string
          form_id: string
          id?: string
          is_current?: boolean
          member_id: string
          payload: Json
          superseded_at?: string | null
          superseded_by?: string | null
        }
        Update: {
          created_at?: string
          form_id?: string
          id?: string
          is_current?: boolean
          member_id?: string
          payload?: Json
          superseded_at?: string | null
          superseded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_instances_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "card_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_instances_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "card_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      card_issuances: {
        Row: {
          id: string
          instance_id: string
          invitee_locator: string | null
          issued_at: string
          issuer_id: string
          recipient_member_id: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["issuance_status"]
        }
        Insert: {
          id?: string
          instance_id: string
          invitee_locator?: string | null
          issued_at?: string
          issuer_id: string
          recipient_member_id?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["issuance_status"]
        }
        Update: {
          id?: string
          instance_id?: string
          invitee_locator?: string | null
          issued_at?: string
          issuer_id?: string
          recipient_member_id?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["issuance_status"]
        }
        Relationships: [
          {
            foreignKeyName: "card_issuances_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "card_instances"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_card_instance: {
        Args: { p_form_id: string; p_payload: Json }
        Returns: {
          error_code: string
          error_message: string
          instance_id: string
        }[]
      }
      get_audit_trail: {
        Args: { p_entity_id: string; p_entity_type: string }
        Returns: {
          action: string
          actor_id: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          lifecycle_context: Json
        }[]
      }
      get_card_lineage: {
        Args: { p_instance_id: string }
        Returns: {
          created_at: string
          form_id: string
          instance_id: string
          is_current: boolean
          payload: Json
          superseded_at: string
          superseded_by: string
        }[]
      }
      get_issued_card_instance: {
        Args: { p_issuance_id: string }
        Returns: {
          created_at: string
          form_id: string
          instance_id: string
          payload: Json
        }[]
      }
      get_my_recent_audit: {
        Args: { p_limit?: number }
        Returns: {
          action: string
          actor_id: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          lifecycle_context: Json
        }[]
      }
      issue_card: {
        Args: {
          p_instance_id: string
          p_invitee_locator?: string
          p_recipient_member_id?: string
        }
        Returns: {
          delivery_id: string
          issuance_id: string
        }[]
      }
      json_matches_schema: {
        Args: { instance: Json; schema: Json }
        Returns: boolean
      }
      jsonb_matches_schema: {
        Args: { instance: Json; schema: Json }
        Returns: boolean
      }
      jsonschema_is_valid: { Args: { schema: Json }; Returns: boolean }
      jsonschema_validation_errors: {
        Args: { instance: Json; schema: Json }
        Returns: string[]
      }
      opn_jsonb_path_exists: {
        Args: { data: Json; dot_path: string }
        Returns: boolean
      }
      opn_validate_card_payload: {
        Args: {
          p_form: Database["public"]["Tables"]["card_forms"]["Row"]
          p_payload: Json
        }
        Returns: undefined
      }
      register_card_form: {
        Args: {
          p_form_type: Database["public"]["Enums"]["card_form_type"]
          p_name: string
          p_schema_definition: Json
        }
        Returns: string
      }
      resolve_card_issuance: {
        Args: { p_issuance_id: string; p_resolution: string }
        Returns: undefined
      }
      revoke_card_issuance: {
        Args: { p_issuance_id: string }
        Returns: undefined
      }
      supersede_card_instance: {
        Args: { p_new_payload: Json; p_old_instance_id: string }
        Returns: {
          error_code: string
          error_message: string
          new_instance_id: string
        }[]
      }
    }
    Enums: {
      card_form_status: "draft" | "registered"
      card_form_type: "entity" | "data" | "use"
      card_issuance_status: "issued" | "accepted" | "rejected" | "revoked"
      issuance_status: "issued" | "accepted" | "rejected" | "revoked"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      card_form_status: ["draft", "registered"],
      card_form_type: ["entity", "data", "use"],
      card_issuance_status: ["issued", "accepted", "rejected", "revoked"],
      issuance_status: ["issued", "accepted", "rejected", "revoked"],
    },
  },
} as const
