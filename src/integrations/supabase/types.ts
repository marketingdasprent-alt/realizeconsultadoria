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
      absence_documents: {
        Row: {
          absence_id: string
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string
          uploaded_by: string
        }
        Insert: {
          absence_id: string
          created_at?: string
          file_name: string
          file_path: string
          file_size: number
          id?: string
          mime_type: string
          uploaded_by: string
        }
        Update: {
          absence_id?: string
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "absence_documents_absence_id_fkey"
            columns: ["absence_id"]
            isOneToOne: false
            referencedRelation: "absences"
            referencedColumns: ["id"]
          },
        ]
      }
      absence_periods: {
        Row: {
          absence_id: string
          business_days: number
          created_at: string
          end_date: string
          end_time: string | null
          id: string
          period_type: string
          start_date: string
          start_time: string | null
          status: string
        }
        Insert: {
          absence_id: string
          business_days?: number
          created_at?: string
          end_date: string
          end_time?: string | null
          id?: string
          period_type?: string
          start_date: string
          start_time?: string | null
          status?: string
        }
        Update: {
          absence_id?: string
          business_days?: number
          created_at?: string
          end_date?: string
          end_time?: string | null
          id?: string
          period_type?: string
          start_date?: string
          start_time?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "absence_periods_absence_id_fkey"
            columns: ["absence_id"]
            isOneToOne: false
            referencedRelation: "absences"
            referencedColumns: ["id"]
          },
        ]
      }
      absences: {
        Row: {
          absence_type: string
          approved_at: string | null
          approved_by: string | null
          company_id: string
          created_at: string
          created_by_role: string | null
          employee_id: string
          end_date: string
          id: string
          notes: string | null
          rejection_reason: string | null
          start_date: string
          status: string
          training_mode: string | null
          updated_at: string
        }
        Insert: {
          absence_type: string
          approved_at?: string | null
          approved_by?: string | null
          company_id: string
          created_at?: string
          created_by_role?: string | null
          employee_id: string
          end_date: string
          id?: string
          notes?: string | null
          rejection_reason?: string | null
          start_date: string
          status?: string
          training_mode?: string | null
          updated_at?: string
        }
        Update: {
          absence_type?: string
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          created_at?: string
          created_by_role?: string | null
          employee_id?: string
          end_date?: string
          id?: string
          notes?: string | null
          rejection_reason?: string | null
          start_date?: string
          status?: string
          training_mode?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "absences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      access_categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      accesses: {
        Row: {
          category_id: string | null
          company_id: string
          created_at: string
          employee_id: string | null
          id: string
          notes: string | null
          password: string
          title: string
          updated_at: string
          url: string | null
          username: string
        }
        Insert: {
          category_id?: string | null
          company_id: string
          created_at?: string
          employee_id?: string | null
          id?: string
          notes?: string | null
          password: string
          title: string
          updated_at?: string
          url?: string | null
          username: string
        }
        Update: {
          category_id?: string | null
          company_id?: string
          created_at?: string
          employee_id?: string | null
          id?: string
          notes?: string | null
          password?: string
          title?: string
          updated_at?: string
          url?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "accesses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "access_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accesses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accesses_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_group_permissions: {
        Row: {
          can_edit: boolean
          can_execute: boolean
          can_view: boolean
          created_at: string
          group_id: string
          id: string
          module_key: string
          topic_key: string | null
        }
        Insert: {
          can_edit?: boolean
          can_execute?: boolean
          can_view?: boolean
          created_at?: string
          group_id: string
          id?: string
          module_key: string
          topic_key?: string | null
        }
        Update: {
          can_edit?: boolean
          can_execute?: boolean
          can_view?: boolean
          created_at?: string
          group_id?: string
          id?: string
          module_key?: string
          topic_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_group_permissions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_group_support_departments: {
        Row: {
          created_at: string
          department_id: string
          group_id: string
          id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          group_id: string
          id?: string
        }
        Update: {
          created_at?: string
          department_id?: string
          group_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_group_support_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "support_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_group_support_departments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admin_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_super_admin: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_super_admin?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_super_admin?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_notification_preferences: {
        Row: {
          created_at: string
          id: string
          notify_absences: boolean
          notify_support_tickets: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notify_absences?: boolean
          notify_support_tickets?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notify_absences?: boolean
          notify_support_tickets?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      assignment_items: {
        Row: {
          assignment_id: string
          created_at: string
          equipment_id: string
          has_bag: boolean
          has_case: boolean
          has_charger: boolean
          has_keyboard: boolean
          has_mouse: boolean
          has_mouse_pad: boolean
          has_pen: boolean
          has_screen_protector: boolean
          id: string
          phone_id: string | null
        }
        Insert: {
          assignment_id: string
          created_at?: string
          equipment_id: string
          has_bag?: boolean
          has_case?: boolean
          has_charger?: boolean
          has_keyboard?: boolean
          has_mouse?: boolean
          has_mouse_pad?: boolean
          has_pen?: boolean
          has_screen_protector?: boolean
          id?: string
          phone_id?: string | null
        }
        Update: {
          assignment_id?: string
          created_at?: string
          equipment_id?: string
          has_bag?: boolean
          has_case?: boolean
          has_charger?: boolean
          has_keyboard?: boolean
          has_mouse?: boolean
          has_mouse_pad?: boolean
          has_pen?: boolean
          has_screen_protector?: boolean
          id?: string
          phone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignment_items_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_items_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_items_phone_id_fkey"
            columns: ["phone_id"]
            isOneToOne: false
            referencedRelation: "phones"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          assigned_date: string
          company_id: string
          created_at: string
          employee_id: string
          id: string
          keys_count: number | null
          keys_locations: string[] | null
          return_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_date?: string
          company_id: string
          created_at?: string
          employee_id: string
          id?: string
          keys_count?: number | null
          keys_locations?: string[] | null
          return_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_date?: string
          company_id?: string
          created_at?: string
          employee_id?: string
          id?: string
          keys_count?: number | null
          keys_locations?: string[] | null
          return_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string
          domain: string | null
          email: string
          id: string
          is_active: boolean
          name: string
          nif: string
          notes: string | null
          phone: string | null
          postal_code: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          domain?: string | null
          email: string
          id?: string
          is_active?: boolean
          name: string
          nif: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          domain?: string | null
          email?: string
          id?: string
          is_active?: boolean
          name?: string
          nif?: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      employee_attachments: {
        Row: {
          created_at: string
          description: string | null
          employee_id: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string
          source: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          employee_id: string
          file_name: string
          file_path: string
          file_size: number
          id?: string
          mime_type: string
          source?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          description?: string | null
          employee_id?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string
          source?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_attachments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_department_emails: {
        Row: {
          access_id: string
          created_at: string
          employee_id: string
          id: string
        }
        Insert: {
          access_id: string
          created_at?: string
          employee_id: string
          id?: string
        }
        Update: {
          access_id?: string
          created_at?: string
          employee_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_department_emails_access_id_fkey"
            columns: ["access_id"]
            isOneToOne: false
            referencedRelation: "accesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_department_emails_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_documents: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          employee_id: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string
          uploaded_by: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          employee_id: string
          file_name: string
          file_path: string
          file_size: number
          id?: string
          mime_type: string
          uploaded_by: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          employee_id?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_vacation_balances: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          self_schedulable_days: number | null
          total_days: number
          updated_at: string
          used_days: number
          year: number
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          self_schedulable_days?: number | null
          total_days?: number
          updated_at?: string
          used_days?: number
          year: number
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          self_schedulable_days?: number | null
          total_days?: number
          updated_at?: string
          used_days?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "employee_vacation_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          cartao_da: string | null
          cartao_refeicao: string | null
          company_id: string
          created_at: string
          department: string | null
          document_number: string | null
          email: string
          hire_date: string | null
          iban: string | null
          id: string
          is_active: boolean
          name: string
          nationality: string | null
          notes: string | null
          phone: string | null
          position: string | null
          safety_checkup_date: string | null
          safety_checkup_renewal_months: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cartao_da?: string | null
          cartao_refeicao?: string | null
          company_id: string
          created_at?: string
          department?: string | null
          document_number?: string | null
          email: string
          hire_date?: string | null
          iban?: string | null
          id?: string
          is_active?: boolean
          name: string
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          position?: string | null
          safety_checkup_date?: string | null
          safety_checkup_renewal_months?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cartao_da?: string | null
          cartao_refeicao?: string | null
          company_id?: string
          created_at?: string
          department?: string | null
          document_number?: string | null
          email?: string
          hire_date?: string | null
          iban?: string | null
          id?: string
          is_active?: boolean
          name?: string
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          position?: string | null
          safety_checkup_date?: string | null
          safety_checkup_renewal_months?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_categories: {
        Row: {
          created_at: string | null
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      equipments: {
        Row: {
          brand: string
          category_id: string | null
          color: string | null
          company_id: string
          created_at: string | null
          employee_id: string | null
          id: string
          model: string | null
          notes: string | null
          pass_year: string | null
          serial_number: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          brand: string
          category_id?: string | null
          color?: string | null
          company_id: string
          created_at?: string | null
          employee_id?: string | null
          id?: string
          model?: string | null
          notes?: string | null
          pass_year?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          brand?: string
          category_id?: string | null
          color?: string | null
          company_id?: string
          created_at?: string | null
          employee_id?: string | null
          id?: string
          model?: string | null
          notes?: string | null
          pass_year?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "equipment_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          created_at: string
          date: string
          id: string
          is_national: boolean
          name: string
          year: number
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          is_national?: boolean
          name: string
          year: number
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          is_national?: boolean
          name?: string
          year?: number
        }
        Relationships: []
      }
      notification_emails_absences: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          id: string
          is_active: boolean
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          is_active?: boolean
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          is_active?: boolean
        }
        Relationships: []
      }
      notification_emails_support: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string
          email: string
          id: string
          is_active: boolean
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id: string
          email: string
          id?: string
          is_active?: boolean
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string
          email?: string
          id?: string
          is_active?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notification_emails_support_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "support_departments"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_reads: {
        Row: {
          employee_id: string
          id: string
          notification_id: string
          read_at: string
        }
        Insert: {
          employee_id: string
          id?: string
          notification_id: string
          read_at?: string
        }
        Update: {
          employee_id?: string
          id?: string
          notification_id?: string
          read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string
          employee_id: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          message: string
          title: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by: string
          employee_id?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          message: string
          title: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string
          employee_id?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          message?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      phones: {
        Row: {
          company_id: string
          created_at: string
          employee_id: string | null
          id: string
          label: string | null
          notes: string | null
          operator: string | null
          phone_number: string
          pin: string | null
          puk: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          employee_id?: string | null
          id?: string
          label?: string | null
          notes?: string | null
          operator?: string | null
          phone_number: string
          pin?: string | null
          puk?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          employee_id?: string | null
          id?: string
          label?: string | null
          notes?: string | null
          operator?: string | null
          phone_number?: string
          pin?: string | null
          puk?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "phones_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phones_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      session_transfers: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string
          id?: string
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      support_departments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      support_ticket_attachments: {
        Row: {
          content_type: string
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          ticket_id: string
          uploaded_by: string
        }
        Insert: {
          content_type: string
          created_at?: string
          file_name: string
          file_path: string
          file_size: number
          id?: string
          ticket_id: string
          uploaded_by: string
        }
        Update: {
          content_type?: string
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          ticket_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_replies: {
        Row: {
          created_at: string
          id: string
          message: string
          sender_role: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          sender_role: string
          ticket_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          sender_role?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_replies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_subjects: {
        Row: {
          created_at: string
          default_priority: string
          department_id: string | null
          id: string
          is_active: boolean
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_priority?: string
          department_id?: string | null
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_priority?: string
          department_id?: string | null
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_subjects_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "support_departments"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_notes: string | null
          company_id: string
          created_at: string
          department_id: string | null
          employee_id: string
          id: string
          message: string
          priority: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          company_id: string
          created_at?: string
          department_id?: string | null
          employee_id: string
          id?: string
          message: string
          priority?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          company_id?: string
          created_at?: string
          department_id?: string | null
          employee_id?: string
          id?: string
          message?: string
          priority?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "support_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
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
          role?: Database["public"]["Enums"]["app_role"]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_session_transfers: { Args: never; Returns: undefined }
      get_admin_permissions: {
        Args: { _user_id: string }
        Returns: {
          can_edit: boolean
          can_execute: boolean
          can_view: boolean
          module_key: string
          topic_key: string
        }[]
      }
      get_employee_company_id: { Args: { _user_id: string }; Returns: string }
      get_employee_id_from_user: { Args: { _user_id: string }; Returns: string }
      get_user_support_departments: {
        Args: { _user_id: string }
        Returns: string[]
      }
      has_module_permission: {
        Args: {
          _module_key: string
          _permission?: string
          _topic_key?: string
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "company_admin" | "employee"
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
      app_role: ["admin", "company_admin", "employee"],
    },
  },
} as const
