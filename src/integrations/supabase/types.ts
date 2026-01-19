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
      ads: {
        Row: {
          chat_id: number | null
          companhia: string
          created_at: string | null
          id: string
          message_id: number | null
          quantidade: number
          status: Database["public"]["Enums"]["ad_status"]
          updated_at: string | null
          user_id: number
          username: string | null
          valor_milheiro: number
        }
        Insert: {
          chat_id?: number | null
          companhia: string
          created_at?: string | null
          id?: string
          message_id?: number | null
          quantidade: number
          status?: Database["public"]["Enums"]["ad_status"]
          updated_at?: string | null
          user_id: number
          username?: string | null
          valor_milheiro: number
        }
        Update: {
          chat_id?: number | null
          companhia?: string
          created_at?: string | null
          id?: string
          message_id?: number | null
          quantidade?: number
          status?: Database["public"]["Enums"]["ad_status"]
          updated_at?: string | null
          user_id?: number
          username?: string | null
          valor_milheiro?: number
        }
        Relationships: []
      }
      proposals: {
        Row: {
          ad_id: string
          created_at: string | null
          from_user_id: number
          from_username: string | null
          id: string
          status: Database["public"]["Enums"]["proposal_status"]
          updated_at: string | null
          valor_proposta: number
        }
        Insert: {
          ad_id: string
          created_at?: string | null
          from_user_id: number
          from_username?: string | null
          id?: string
          status?: Database["public"]["Enums"]["proposal_status"]
          updated_at?: string | null
          valor_proposta: number
        }
        Update: {
          ad_id?: string
          created_at?: string | null
          from_user_id?: number
          from_username?: string | null
          id?: string
          status?: Database["public"]["Enums"]["proposal_status"]
          updated_at?: string | null
          valor_proposta?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposals_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
        ]
      }
      user_states: {
        Row: {
          state: Database["public"]["Enums"]["user_state"]
          temp_data: Json | null
          updated_at: string | null
          user_id: number
        }
        Insert: {
          state?: Database["public"]["Enums"]["user_state"]
          temp_data?: Json | null
          updated_at?: string | null
          user_id: number
        }
        Update: {
          state?: Database["public"]["Enums"]["user_state"]
          temp_data?: Json | null
          updated_at?: string | null
          user_id?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      ad_status: "ACTIVE" | "SOLD" | "CANCELLED"
      proposal_status: "PENDING" | "ACCEPTED" | "REJECTED"
      user_state:
        | "IDLE"
        | "ASK_COMPANY"
        | "ASK_QUANTITY"
        | "ASK_PRICE"
        | "ASK_PROPOSAL_VALUE"
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
      ad_status: ["ACTIVE", "SOLD", "CANCELLED"],
      proposal_status: ["PENDING", "ACCEPTED", "REJECTED"],
      user_state: [
        "IDLE",
        "ASK_COMPANY",
        "ASK_QUANTITY",
        "ASK_PRICE",
        "ASK_PROPOSAL_VALUE",
      ],
    },
  },
} as const
