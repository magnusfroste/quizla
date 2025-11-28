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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      analysis_progress: {
        Row: {
          collection_id: string
          created_at: string | null
          current_file_name: string | null
          current_page: number
          id: string
          status: string
          total_pages: number
          updated_at: string | null
        }
        Insert: {
          collection_id: string
          created_at?: string | null
          current_file_name?: string | null
          current_page?: number
          id?: string
          status?: string
          total_pages: number
          updated_at?: string | null
        }
        Update: {
          collection_id?: string
          created_at?: string | null
          current_file_name?: string | null
          current_page?: number
          id?: string
          status?: string
          total_pages?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analysis_progress_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      answers: {
        Row: {
          attempt_id: string
          created_at: string
          id: string
          is_correct: boolean
          question_id: string
          selected_answer: string
        }
        Insert: {
          attempt_id: string
          created_at?: string
          id?: string
          is_correct: boolean
          question_id: string
          selected_answer: string
        }
        Update: {
          attempt_id?: string
          created_at?: string
          id?: string
          is_correct?: boolean
          question_id?: string
          selected_answer?: string
        }
        Relationships: [
          {
            foreignKeyName: "answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      attempts: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          quiz_id: string
          score: number | null
          total_questions: number
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          quiz_id: string
          score?: number | null
          total_questions: number
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          quiz_id?: string
          score?: number | null
          total_questions?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_shares: {
        Row: {
          collection_id: string
          created_at: string
          id: string
          shared_with_user_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          id?: string
          shared_with_user_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          id?: string
          shared_with_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_shares_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_shares_shared_with_user_id_fkey"
            columns: ["shared_with_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      material_analysis: {
        Row: {
          analyzed_at: string | null
          collection_id: string
          created_at: string | null
          definitions: Json | null
          emphasis_markers: string[] | null
          extracted_text: string
          formulas: string[] | null
          id: string
          is_foundational: boolean | null
          key_concepts: string[]
          learning_objectives: string[] | null
          major_topics: string[]
          material_id: string
          page_number: number | null
          token_count: number | null
          visual_elements: string[] | null
        }
        Insert: {
          analyzed_at?: string | null
          collection_id: string
          created_at?: string | null
          definitions?: Json | null
          emphasis_markers?: string[] | null
          extracted_text: string
          formulas?: string[] | null
          id?: string
          is_foundational?: boolean | null
          key_concepts?: string[]
          learning_objectives?: string[] | null
          major_topics?: string[]
          material_id: string
          page_number?: number | null
          token_count?: number | null
          visual_elements?: string[] | null
        }
        Update: {
          analyzed_at?: string | null
          collection_id?: string
          created_at?: string | null
          definitions?: Json | null
          emphasis_markers?: string[] | null
          extracted_text?: string
          formulas?: string[] | null
          id?: string
          is_foundational?: boolean | null
          key_concepts?: string[]
          learning_objectives?: string[] | null
          major_topics?: string[]
          material_id?: string
          page_number?: number | null
          token_count?: number | null
          visual_elements?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "material_analysis_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_analysis_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: true
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          collection_id: string
          created_at: string
          file_name: string
          file_size: number | null
          id: string
          material_type: Database["public"]["Enums"]["material_type"]
          mime_type: string | null
          storage_path: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          file_name: string
          file_size?: number | null
          id?: string
          material_type?: Database["public"]["Enums"]["material_type"]
          mime_type?: string | null
          storage_path: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          file_name?: string
          file_size?: number | null
          id?: string
          material_type?: Database["public"]["Enums"]["material_type"]
          mime_type?: string | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          bloom_level: string | null
          correct_answer: string
          created_at: string
          difficulty_level: string | null
          exam_likelihood: string | null
          exam_tip: string | null
          explanation: string | null
          id: string
          order_index: number
          page_references: string[] | null
          question_text: string
          question_type: string | null
          quiz_id: string
          topic_category: string | null
          wrong_answers: string[]
        }
        Insert: {
          bloom_level?: string | null
          correct_answer: string
          created_at?: string
          difficulty_level?: string | null
          exam_likelihood?: string | null
          exam_tip?: string | null
          explanation?: string | null
          id?: string
          order_index: number
          page_references?: string[] | null
          question_text: string
          question_type?: string | null
          quiz_id: string
          topic_category?: string | null
          wrong_answers: string[]
        }
        Update: {
          bloom_level?: string | null
          correct_answer?: string
          created_at?: string
          difficulty_level?: string | null
          exam_likelihood?: string | null
          exam_tip?: string | null
          explanation?: string | null
          id?: string
          order_index?: number
          page_references?: string[] | null
          question_text?: string
          question_type?: string | null
          quiz_id?: string
          topic_category?: string | null
          wrong_answers?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_shares: {
        Row: {
          created_at: string
          id: string
          quiz_id: string
          shared_with_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          quiz_id: string
          shared_with_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          quiz_id?: string
          shared_with_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_shares_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_shares_shared_with_user_id_fkey"
            columns: ["shared_with_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          collection_id: string
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          title: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          title: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
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
      has_collection_share_access: {
        Args: { _collection_id: string; _user_id: string }
        Returns: boolean
      }
      has_quiz_share_access: {
        Args: { _quiz_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_collection_owner: {
        Args: { _collection_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      material_type: "content" | "learning_objectives" | "reference"
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
      app_role: ["admin", "moderator", "user"],
      material_type: ["content", "learning_objectives", "reference"],
    },
  },
} as const
