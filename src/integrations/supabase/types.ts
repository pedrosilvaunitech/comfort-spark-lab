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
      counters: {
        Row: {
          created_at: string
          current_ticket_id: string | null
          id: string
          is_active: boolean
          name: string
          number: number
          operator_name: string | null
        }
        Insert: {
          created_at?: string
          current_ticket_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          number: number
          operator_name?: string | null
        }
        Update: {
          created_at?: string
          current_ticket_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          number?: number
          operator_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "counters_current_ticket_fk"
            columns: ["current_ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_sequence: {
        Row: {
          date: string
          id: string
          last_number: number
          service_type_id: string | null
        }
        Insert: {
          date?: string
          id?: string
          last_number?: number
          service_type_id?: string | null
        }
        Update: {
          date?: string
          id?: string
          last_number?: number
          service_type_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_sequence_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      print_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          print_method: string | null
          status: Database["public"]["Enums"]["print_status"]
          ticket_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          print_method?: string | null
          status?: Database["public"]["Enums"]["print_status"]
          ticket_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          print_method?: string | null
          status?: Database["public"]["Enums"]["print_status"]
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "print_logs_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
        }
        Relationships: []
      }
      service_types: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          prefix: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          prefix: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          prefix?: string
        }
        Relationships: []
      }
      system_config: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      tickets: {
        Row: {
          called_at: string | null
          completed_at: string | null
          counter_id: string | null
          created_at: string
          display_number: string
          id: string
          operator_id: string | null
          patient_cpf: string | null
          patient_name: string | null
          service_type_id: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          ticket_number: string
          ticket_type: Database["public"]["Enums"]["ticket_type"]
          updated_at: string
        }
        Insert: {
          called_at?: string | null
          completed_at?: string | null
          counter_id?: string | null
          created_at?: string
          display_number: string
          id?: string
          operator_id?: string | null
          patient_cpf?: string | null
          patient_name?: string | null
          service_type_id?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          ticket_number: string
          ticket_type?: Database["public"]["Enums"]["ticket_type"]
          updated_at?: string
        }
        Update: {
          called_at?: string | null
          completed_at?: string | null
          counter_id?: string | null
          created_at?: string
          display_number?: string
          id?: string
          operator_id?: string | null
          patient_cpf?: string | null
          patient_name?: string | null
          service_type_id?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          ticket_number?: string
          ticket_type?: Database["public"]["Enums"]["ticket_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_counter_id_fkey"
            columns: ["counter_id"]
            isOneToOne: false
            referencedRelation: "counters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "operator"
      print_status: "success" | "failed" | "pending"
      ticket_status:
        | "waiting"
        | "called"
        | "in_service"
        | "completed"
        | "cancelled"
        | "no_show"
      ticket_type: "normal" | "priority" | "preferential"
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
      app_role: ["admin", "operator"],
      print_status: ["success", "failed", "pending"],
      ticket_status: [
        "waiting",
        "called",
        "in_service",
        "completed",
        "cancelled",
        "no_show",
      ],
      ticket_type: ["normal", "priority", "preferential"],
    },
  },
} as const
