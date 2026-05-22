export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UUID = string

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      assignments: {
        Row: {
          allocated_hours: number | null
          created_at: string | null
          end_time: string | null
          id: string
          organization_id: string
          start_time: string | null
          task_id: string
          user_id: string
        }
        Insert: {
          allocated_hours?: number | null
          created_at?: string | null
          end_time?: string | null
          id?: string
          organization_id: string
          start_time?: string | null
          task_id: string
          user_id: string
        }
        Update: {
          allocated_hours?: number | null
          created_at?: string | null
          end_time?: string | null
          id?: string
          organization_id?: string
          start_time?: string | null
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: true
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          organization_id: string
          project_id: string | null
          task_id: string
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          organization_id: string
          project_id?: string | null
          task_id: string
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          organization_id?: string
          project_id?: string | null
          task_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_employees: {
        Row: {
          created_at: string | null
          employee_id: string
          manager_id: string
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          employee_id: string
          manager_id: string
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          employee_id?: string
          manager_id?: string
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manager_employees_organization_id_employee_id_fkey"
            columns: ["organization_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "org_members"
            referencedColumns: ["organization_id", "user_id"]
          },
          {
            foreignKeyName: "manager_employees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_employees_organization_id_manager_id_fkey"
            columns: ["organization_id", "manager_id"]
            isOneToOne: false
            referencedRelation: "org_members"
            referencedColumns: ["organization_id", "user_id"]
          },
        ]
      }
      invites: {
        Row: {
          accepted_at: string | null
          content: string
          created_at: string | null
          declined_at: string | null
          expires_at: string
          id: string
          invite_email: string
          inviter_id: string
          organization_id: string
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          content: string
          created_at?: string | null
          declined_at?: string | null
          expires_at: string
          id?: string
          invite_email: string
          inviter_id: string
          organization_id: string
          status?: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          content?: string
          created_at?: string | null
          declined_at?: string | null
          expires_at?: string
          id?: string
          invite_email?: string
          inviter_id?: string
          organization_id?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          deleted_at: string | null
          id: string
          organization_id: string
          project_id: string | null
          recipient_id: string | null
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          organization_id: string
          project_id?: string | null
          recipient_id?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          organization_id?: string
          project_id?: string | null
          recipient_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["role_type"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["role_type"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["role_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_org_members_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active_organization_id: string | null
          created_at: string | null
          full_name: string | null
          id: string
          username: string | null
        }
        Insert: {
          active_organization_id?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          username?: string | null
        }
        Update: {
          active_organization_id?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_organization_id_fkey"
            columns: ["active_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string | null
          id: string
          joined_at: string | null
          left_at: string | null
          organization_id: string
          project_id: string
          role: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          joined_at?: string | null
          left_at?: string | null
          organization_id: string
          project_id: string
          role?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          joined_at?: string | null
          left_at?: string | null
          organization_id?: string
          project_id?: string
          role?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          end_date: string | null
          id: string
          name: string
          organization_id: string
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"] | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          name: string
          organization_id: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          name?: string
          organization_id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          description: string | null
          due_date: string | null
          id: string
          organization_id: string
          project_id: string | null
          status: Database["public"]["Enums"]["task_status"] | null
          title: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id: string
          project_id?: string | null
          status?: Database["public"]["Enums"]["task_status"] | null
          title: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id?: string
          project_id?: string | null
          status?: Database["public"]["Enums"]["task_status"] | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite: { Args: { invite_id: string }; Returns: undefined }
      is_manager: { Args: { org: string }; Returns: boolean }
      is_org_member: { Args: { org: string }; Returns: boolean }
      list_projects_with_meta: {
        Args: { org_uuid: string; page_size: number; page_offset: number }
        Returns: Array<{
          id: string
          name: string
          status: string | null
          start_date: string | null
          end_date: string | null
          member_count: number | null
          completed: number | null
          total: number | null
        }>
      }
    }
    Enums: {
      project_status: "active" | "paused" | "archived"
      resource_type: "human" | "equipment" | "room" | "vehicle" | "software"
      role_type: "owner" | "admin" | "manager" | "employee" | "viewer"
      task_status: "todo" | "in_progress" | "blocked" | "done"
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
      project_status: ["active", "paused", "archived"],
      resource_type: ["human", "equipment", "room", "vehicle", "software"],
      role_type: ["owner", "admin", "manager", "employee", "viewer"],
      task_status: ["todo", "in_progress", "blocked", "done"],
    },
  },
} as const
