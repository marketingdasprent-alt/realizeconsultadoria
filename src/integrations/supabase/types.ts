export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.1';
  };
  public: {
    Tables: {
      absence_documents: {
        Row: {
          absence_id: string;
          created_at: string;
          file_name: string;
          file_path: string;
          file_size: number;
          id: string;
          mime_type: string;
          uploaded_by: string;
        };
        Insert: {
          absence_id: string;
          created_at?: string;
          file_name: string;
          file_path: string;
          file_size: number;
          id?: string;
          mime_type: string;
          uploaded_by: string;
        };
        Update: {
          absence_id?: string;
          created_at?: string;
          file_name?: string;
          file_path?: string;
          file_size?: number;
          id?: string;
          mime_type?: string;
          uploaded_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'absence_documents_absence_id_fkey';
            columns: ['absence_id'];
            isOneToOne: false;
            referencedRelation: 'absences';
            referencedColumns: ['id'];
          },
        ];
      };
      absence_periods: {
        Row: {
          absence_id: string;
          business_days: number;
          created_at: string;
          end_date: string;
          end_time: string | null;
          id: string;
          period_type: string;
          start_date: string;
          start_time: string | null;
          status: string;
        };
        Insert: {
          absence_id: string;
          business_days?: number;
          created_at?: string;
          end_date: string;
          end_time?: string | null;
          id?: string;
          period_type?: string;
          start_date: string;
          start_time?: string | null;
          status?: string;
        };
        Update: {
          absence_id?: string;
          business_days?: number;
          created_at?: string;
          end_date?: string;
          end_time?: string | null;
          id?: string;
          period_type?: string;
          start_date?: string;
          start_time?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'absence_periods_absence_id_fkey';
            columns: ['absence_id'];
            isOneToOne: false;
            referencedRelation: 'absences';
            referencedColumns: ['id'];
          },
        ];
      };
      absences: {
        Row: {
          absence_type: string;
          approved_at: string | null;
          approved_by: string | null;
          company_id: string;
          created_at: string;
          created_by_role: string | null;
          employee_id: string;
          end_date: string;
          id: string;
          notes: string | null;
          rejection_reason: string | null;
          start_date: string;
          status: string;
          training_mode: string | null;
          updated_at: string;
        };
        Insert: {
          absence_type: string;
          approved_at?: string | null;
          approved_by?: string | null;
          company_id: string;
          created_at?: string;
          created_by_role?: string | null;
          employee_id: string;
          end_date: string;
          id?: string;
          notes?: string | null;
          rejection_reason?: string | null;
          start_date: string;
          status?: string;
          training_mode?: string | null;
          updated_at?: string;
        };
        Update: {
          absence_type?: string;
          approved_at?: string | null;
          approved_by?: string | null;
          company_id?: string;
          created_at?: string;
          created_by_role?: string | null;
          employee_id?: string;
          end_date?: string;
          id?: string;
          notes?: string | null;
          rejection_reason?: string | null;
          start_date?: string;
          status?: string;
          training_mode?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'absences_company_id_fkey';
            columns: ['company_id'];
            isOneToOne: false;
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'absences_employee_id_fkey';
            columns: ['employee_id'];
            isOneToOne: false;
            referencedRelation: 'employees';
            referencedColumns: ['id'];
          },
        ];
      };
      access_categories: {
        Row: {
          created_at: string;
          icon: string | null;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          icon?: string | null;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string;
          icon?: string | null;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      accesses: {
        Row: {
          category_id: string | null;
          company_id: string;
          created_at: string;
          employee_id: string | null;
          id: string;
          notes: string | null;
          password: string;
          title: string;
          updated_at: string;
          url: string | null;
          username: string;
        };
        Insert: {
          category_id?: string | null;
          company_id: string;
          created_at?: string;
          employee_id?: string | null;
          id?: string;
          notes?: string | null;
          password: string;
          title: string;
          updated_at?: string;
          url?: string | null;
          username: string;
        };
        Update: {
          category_id?: string | null;
          company_id?: string;
          created_at?: string;
          employee_id?: string | null;
          id?: string;
          notes?: string | null;
          password?: string;
          title?: string;
          updated_at?: string;
          url?: string | null;
          username?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'accesses_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'access_categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'accesses_company_id_fkey';
            columns: ['company_id'];
            isOneToOne: false;
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'accesses_employee_id_fkey';
            columns: ['employee_id'];
            isOneToOne: false;
            referencedRelation: 'employees';
            referencedColumns: ['id'];
          },
        ];
      };
      admin_group_members: {
        Row: {
          created_at: string;
          group_id: string;
          id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          group_id: string;
          id?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          group_id?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'admin_group_members_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'admin_groups';
            referencedColumns: ['id'];
          },
        ];
      };
      admin_group_permissions: {
        Row: {
          can_edit: boolean;
          can_execute: boolean;
          can_view: boolean;
          created_at: string;
          group_id: string;
          id: string;
          module_key: string;
          topic_key: string | null;
        };
        Insert: {
          can_edit?: boolean;
          can_execute?: boolean;
          can_view?: boolean;
          created_at?: string;
          group_id: string;
          id?: string;
          module_key: string;
          topic_key?: string | null;
        };
        Update: {
          can_edit?: boolean;
          can_execute?: boolean;
          can_view?: boolean;
          created_at?: string;
          group_id?: string;
          id?: string;
          module_key?: string;
          topic_key?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'admin_group_permissions_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'admin_groups';
            referencedColumns: ['id'];
          },
        ];
      };
      admin_group_support_departments: {
        Row: {
          created_at: string;
          department_id: string;
          group_id: string;
          id: string;
        };
        Insert: {
          created_at?: string;
          department_id: string;
          group_id: string;
          id?: string;
        };
        Update: {
          created_at?: string;
          department_id?: string;
          group_id?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'admin_group_support_departments_department_id_fkey';
            columns: ['department_id'];
            isOneToOne: false;
            referencedRelation: 'support_departments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'admin_group_support_departments_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'admin_groups';
            referencedColumns: ['id'];
          },
        ];
      };
      admin_groups: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          is_super_admin: boolean;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          is_super_admin?: boolean;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          is_super_admin?: boolean;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      admin_notification_preferences: {
        Row: {
          created_at: string;
          id: string;
          notify_absences: boolean;
          notify_support_tickets: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          notify_absences?: boolean;
          notify_support_tickets?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          notify_absences?: boolean;
          notify_support_tickets?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      appreciations: {
        Row: {
          company_id: string;
          created_at: string;
          id: string;
          is_public: boolean;
          kind: string;
          message: string | null;
          recipient_id: string;
          sender_id: string | null;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          id?: string;
          is_public?: boolean;
          kind: string;
          message?: string | null;
          recipient_id: string;
          sender_id?: string | null;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          id?: string;
          is_public?: boolean;
          kind?: string;
          message?: string | null;
          recipient_id?: string;
          sender_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'appreciations_company_id_fkey';
            columns: ['company_id'];
            isOneToOne: false;
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
        ];
      };
      assignment_items: {
        Row: {
          assignment_id: string;
          created_at: string;
          equipment_id: string;
          has_bag: boolean;
          has_case: boolean;
          has_charger: boolean;
          has_keyboard: boolean;
          has_mouse: boolean;
          has_mouse_pad: boolean;
          has_pen: boolean;
          has_screen_protector: boolean;
          id: string;
          phone_id: string | null;
        };
        Insert: {
          assignment_id: string;
          created_at?: string;
          equipment_id: string;
          has_bag?: boolean;
          has_case?: boolean;
          has_charger?: boolean;
          has_keyboard?: boolean;
          has_mouse?: boolean;
          has_mouse_pad?: boolean;
          has_pen?: boolean;
          has_screen_protector?: boolean;
          id?: string;
          phone_id?: string | null;
        };
        Update: {
          assignment_id?: string;
          created_at?: string;
          equipment_id?: string;
          has_bag?: boolean;
          has_case?: boolean;
          has_charger?: boolean;
          has_keyboard?: boolean;
          has_mouse?: boolean;
          has_mouse_pad?: boolean;
          has_pen?: boolean;
          has_screen_protector?: boolean;
          id?: string;
          phone_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'assignment_items_assignment_id_fkey';
            columns: ['assignment_id'];
            isOneToOne: false;
            referencedRelation: 'assignments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'assignment_items_equipment_id_fkey';
            columns: ['equipment_id'];
            isOneToOne: false;
            referencedRelation: 'equipments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'assignment_items_phone_id_fkey';
            columns: ['phone_id'];
            isOneToOne: false;
            referencedRelation: 'phones';
            referencedColumns: ['id'];
          },
        ];
      };
      assignments: {
        Row: {
          assigned_date: string;
          company_id: string;
          created_at: string;
          employee_id: string;
          id: string;
          keys_count: number | null;
          keys_locations: string[] | null;
          return_date: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          assigned_date?: string;
          company_id: string;
          created_at?: string;
          employee_id: string;
          id?: string;
          keys_count?: number | null;
          keys_locations?: string[] | null;
          return_date?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          assigned_date?: string;
          company_id?: string;
          created_at?: string;
          employee_id?: string;
          id?: string;
          keys_count?: number | null;
          keys_locations?: string[] | null;
          return_date?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'assignments_company_id_fkey';
            columns: ['company_id'];
            isOneToOne: false;
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'assignments_employee_id_fkey';
            columns: ['employee_id'];
            isOneToOne: false;
            referencedRelation: 'employees';
            referencedColumns: ['id'];
          },
        ];
      };
      calendar_event_attendees: {
        Row: {
          event_id: string;
          response: string;
          user_id: string;
        };
        Insert: {
          event_id: string;
          response?: string;
          user_id: string;
        };
        Update: {
          event_id?: string;
          response?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'calendar_event_attendees_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'calendar_events';
            referencedColumns: ['id'];
          },
        ];
      };
      calendar_events: {
        Row: {
          all_day: boolean;
          color: string;
          company_id: string;
          created_at: string;
          description: string | null;
          ends_at: string;
          id: string;
          location: string | null;
          meeting_url: string | null;
          owner_id: string;
          recurrence: string | null;
          recurrence_until: string | null;
          reminder_minutes: number | null;
          starts_at: string;
          task_id: string | null;
          title: string;
          updated_at: string;
          visibility: string;
        };
        Insert: {
          all_day?: boolean;
          color?: string;
          company_id: string;
          created_at?: string;
          description?: string | null;
          ends_at: string;
          id?: string;
          location?: string | null;
          meeting_url?: string | null;
          owner_id: string;
          recurrence?: string | null;
          recurrence_until?: string | null;
          reminder_minutes?: number | null;
          starts_at: string;
          task_id?: string | null;
          title: string;
          updated_at?: string;
          visibility?: string;
        };
        Update: {
          all_day?: boolean;
          color?: string;
          company_id?: string;
          created_at?: string;
          description?: string | null;
          ends_at?: string;
          id?: string;
          location?: string | null;
          meeting_url?: string | null;
          owner_id?: string;
          recurrence?: string | null;
          recurrence_until?: string | null;
          reminder_minutes?: number | null;
          starts_at?: string;
          task_id?: string | null;
          title?: string;
          updated_at?: string;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'calendar_events_company_id_fkey';
            columns: ['company_id'];
            isOneToOne: false;
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'calendar_events_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
        ];
      };
      calendar_reminders_sent: {
        Row: {
          event_id: string;
          occurrence_start: string;
        };
        Insert: {
          event_id: string;
          occurrence_start: string;
        };
        Update: {
          event_id?: string;
          occurrence_start?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'calendar_reminders_sent_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'calendar_events';
            referencedColumns: ['id'];
          },
        ];
      };
      chat_conversations: {
        Row: {
          company_id: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          direct_key: string | null;
          id: string;
          is_default: boolean;
          kind: string;
          last_message_at: string | null;
          last_message_id: string | null;
          title: string | null;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          direct_key?: string | null;
          id?: string;
          is_default?: boolean;
          kind: string;
          last_message_at?: string | null;
          last_message_id?: string | null;
          title?: string | null;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          direct_key?: string | null;
          id?: string;
          is_default?: boolean;
          kind?: string;
          last_message_at?: string | null;
          last_message_id?: string | null;
          title?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'chat_conversations_company_id_fkey';
            columns: ['company_id'];
            isOneToOne: false;
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'chat_conversations_last_message_fk';
            columns: ['last_message_id'];
            isOneToOne: false;
            referencedRelation: 'chat_messages';
            referencedColumns: ['id'];
          },
        ];
      };
      chat_members: {
        Row: {
          conversation_id: string;
          is_archived: boolean;
          is_muted: boolean;
          is_pinned: boolean;
          joined_at: string;
          last_read_at: string;
          role: string;
          user_id: string;
        };
        Insert: {
          conversation_id: string;
          is_archived?: boolean;
          is_muted?: boolean;
          is_pinned?: boolean;
          joined_at?: string;
          last_read_at?: string;
          role?: string;
          user_id: string;
        };
        Update: {
          conversation_id?: string;
          is_archived?: boolean;
          is_muted?: boolean;
          is_pinned?: boolean;
          joined_at?: string;
          last_read_at?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'chat_members_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'chat_conversations';
            referencedColumns: ['id'];
          },
        ];
      };
      chat_messages: {
        Row: {
          attachment_mime: string | null;
          attachment_name: string | null;
          attachment_path: string | null;
          attachment_size: number | null;
          body: string | null;
          conversation_id: string;
          created_at: string;
          deleted_at: string | null;
          duration_sec: number | null;
          edited_at: string | null;
          id: string;
          kind: string;
          reply_to_id: string | null;
          sender_id: string | null;
        };
        Insert: {
          attachment_mime?: string | null;
          attachment_name?: string | null;
          attachment_path?: string | null;
          attachment_size?: number | null;
          body?: string | null;
          conversation_id: string;
          created_at?: string;
          deleted_at?: string | null;
          duration_sec?: number | null;
          edited_at?: string | null;
          id?: string;
          kind?: string;
          reply_to_id?: string | null;
          sender_id?: string | null;
        };
        Update: {
          attachment_mime?: string | null;
          attachment_name?: string | null;
          attachment_path?: string | null;
          attachment_size?: number | null;
          body?: string | null;
          conversation_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          duration_sec?: number | null;
          edited_at?: string | null;
          id?: string;
          kind?: string;
          reply_to_id?: string | null;
          sender_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'chat_messages_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'chat_conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'chat_messages_reply_to_id_fkey';
            columns: ['reply_to_id'];
            isOneToOne: false;
            referencedRelation: 'chat_messages';
            referencedColumns: ['id'];
          },
        ];
      };
      chat_reactions: {
        Row: {
          conversation_id: string;
          created_at: string;
          emoji: string;
          message_id: string;
          user_id: string;
        };
        Insert: {
          conversation_id: string;
          created_at?: string;
          emoji: string;
          message_id: string;
          user_id: string;
        };
        Update: {
          conversation_id?: string;
          created_at?: string;
          emoji?: string;
          message_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'chat_reactions_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'chat_conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'chat_reactions_message_id_fkey';
            columns: ['message_id'];
            isOneToOne: false;
            referencedRelation: 'chat_messages';
            referencedColumns: ['id'];
          },
        ];
      };
      companies: {
        Row: {
          address: string | null;
          city: string | null;
          country: string | null;
          created_at: string;
          domain: string | null;
          email: string;
          id: string;
          is_active: boolean;
          name: string;
          nif: string;
          notes: string | null;
          phone: string | null;
          postal_code: string | null;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          domain?: string | null;
          email: string;
          id?: string;
          is_active?: boolean;
          name: string;
          nif: string;
          notes?: string | null;
          phone?: string | null;
          postal_code?: string | null;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          domain?: string | null;
          email?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          nif?: string;
          notes?: string | null;
          phone?: string | null;
          postal_code?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      employee_attachments: {
        Row: {
          created_at: string;
          description: string | null;
          employee_id: string;
          file_name: string;
          file_path: string;
          file_size: number;
          id: string;
          mime_type: string;
          source: string;
          uploaded_by: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          employee_id: string;
          file_name: string;
          file_path: string;
          file_size: number;
          id?: string;
          mime_type: string;
          source?: string;
          uploaded_by: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          employee_id?: string;
          file_name?: string;
          file_path?: string;
          file_size?: number;
          id?: string;
          mime_type?: string;
          source?: string;
          uploaded_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'employee_attachments_employee_id_fkey';
            columns: ['employee_id'];
            isOneToOne: false;
            referencedRelation: 'employees';
            referencedColumns: ['id'];
          },
        ];
      };
      employee_department_emails: {
        Row: {
          access_id: string;
          created_at: string;
          employee_id: string;
          id: string;
        };
        Insert: {
          access_id: string;
          created_at?: string;
          employee_id: string;
          id?: string;
        };
        Update: {
          access_id?: string;
          created_at?: string;
          employee_id?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'employee_department_emails_access_id_fkey';
            columns: ['access_id'];
            isOneToOne: false;
            referencedRelation: 'accesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'employee_department_emails_employee_id_fkey';
            columns: ['employee_id'];
            isOneToOne: false;
            referencedRelation: 'employees';
            referencedColumns: ['id'];
          },
        ];
      };
      employee_documents: {
        Row: {
          category: string | null;
          created_at: string;
          description: string | null;
          employee_id: string;
          file_name: string;
          file_path: string;
          file_size: number;
          id: string;
          mime_type: string;
          uploaded_by: string;
          uploaded_by_name: string | null;
          uploaded_by_role: string | null;
          status: string;
          document_number: string | null;
          issue_date: string | null;
          expiry_date: string | null;
          period_month: string | null;
          is_current: boolean;
          reviewed_by: string | null;
          reviewed_at: string | null;
          review_notes: string | null;
          replaces_document_id: string | null;
        };
        Insert: {
          category?: string | null;
          created_at?: string;
          description?: string | null;
          employee_id: string;
          file_name: string;
          file_path: string;
          file_size: number;
          id?: string;
          mime_type: string;
          uploaded_by: string;
          uploaded_by_name?: string | null;
          uploaded_by_role?: string | null;
          status?: string;
          document_number?: string | null;
          issue_date?: string | null;
          expiry_date?: string | null;
          period_month?: string | null;
          is_current?: boolean;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_notes?: string | null;
          replaces_document_id?: string | null;
        };
        Update: {
          category?: string | null;
          created_at?: string;
          description?: string | null;
          employee_id?: string;
          file_name?: string;
          file_path?: string;
          file_size?: number;
          id?: string;
          mime_type?: string;
          uploaded_by?: string;
          uploaded_by_name?: string | null;
          uploaded_by_role?: string | null;
          status?: string;
          document_number?: string | null;
          issue_date?: string | null;
          expiry_date?: string | null;
          period_month?: string | null;
          is_current?: boolean;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_notes?: string | null;
          replaces_document_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'employee_documents_employee_id_fkey';
            columns: ['employee_id'];
            isOneToOne: false;
            referencedRelation: 'employees';
            referencedColumns: ['id'];
          },
        ];
      };
      employee_monthly_finances: {
        Row: {
          created_at: string;
          discount_items: unknown;
          employee_id: string;
          id: string;
          km_extras: number;
          month: number;
          notes: string | null;
          taxa_km: number;
          updated_at: string;
          valor_cartao_da: number;
          valor_descontado: number;
          valor_recebido: number;
          valor_subsidio_alimentacao: number;
          year: number;
        };
        Insert: {
          created_at?: string;
          discount_items?: unknown;
          employee_id: string;
          id?: string;
          km_extras?: number;
          month: number;
          notes?: string | null;
          taxa_km?: number;
          updated_at?: string;
          valor_cartao_da?: number;
          valor_descontado?: number;
          valor_recebido?: number;
          valor_subsidio_alimentacao?: number;
          year: number;
        };
        Update: {
          created_at?: string;
          discount_items?: unknown;
          employee_id?: string;
          id?: string;
          km_extras?: number;
          month?: number;
          notes?: string | null;
          taxa_km?: number;
          updated_at?: string;
          valor_cartao_da?: number;
          valor_descontado?: number;
          valor_recebido?: number;
          valor_subsidio_alimentacao?: number;
          year?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'employee_monthly_finances_employee_id_fkey';
            columns: ['employee_id'];
            isOneToOne: false;
            referencedRelation: 'employees';
            referencedColumns: ['id'];
          },
        ];
      };
      employee_vacation_balances: {
        Row: {
          created_at: string;
          employee_id: string;
          id: string;
          self_schedulable_days: number | null;
          total_days: number;
          updated_at: string;
          used_days: number;
          year: number;
        };
        Insert: {
          created_at?: string;
          employee_id: string;
          id?: string;
          self_schedulable_days?: number | null;
          total_days?: number;
          updated_at?: string;
          used_days?: number;
          year: number;
        };
        Update: {
          created_at?: string;
          employee_id?: string;
          id?: string;
          self_schedulable_days?: number | null;
          total_days?: number;
          updated_at?: string;
          used_days?: number;
          year?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'employee_vacation_balances_employee_id_fkey';
            columns: ['employee_id'];
            isOneToOne: false;
            referencedRelation: 'employees';
            referencedColumns: ['id'];
          },
        ];
      };
      employees: {
        Row: {
          birth_date: string | null;
          cartao_da: string | null;
          cartao_refeicao: string | null;
          company_id: string;
          created_at: string;
          department: string | null;
          document_number: string | null;
          email: string;
          hire_date: string | null;
          iban: string | null;
          id: string;
          is_active: boolean;
          name: string;
          nationality: string | null;
          notes: string | null;
          phone: string | null;
          position: string | null;
          safety_checkup_date: string | null;
          safety_checkup_renewal_months: number | null;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          birth_date?: string | null;
          cartao_da?: string | null;
          cartao_refeicao?: string | null;
          company_id: string;
          created_at?: string;
          department?: string | null;
          document_number?: string | null;
          email: string;
          hire_date?: string | null;
          iban?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          nationality?: string | null;
          notes?: string | null;
          phone?: string | null;
          position?: string | null;
          safety_checkup_date?: string | null;
          safety_checkup_renewal_months?: number | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          birth_date?: string | null;
          cartao_da?: string | null;
          cartao_refeicao?: string | null;
          company_id?: string;
          created_at?: string;
          department?: string | null;
          document_number?: string | null;
          email?: string;
          hire_date?: string | null;
          iban?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          nationality?: string | null;
          notes?: string | null;
          phone?: string | null;
          position?: string | null;
          safety_checkup_date?: string | null;
          safety_checkup_renewal_months?: number | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'employees_company_id_fkey';
            columns: ['company_id'];
            isOneToOne: false;
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
        ];
      };
      equipment_categories: {
        Row: {
          created_at: string | null;
          icon: string | null;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string | null;
          icon?: string | null;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string | null;
          icon?: string | null;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      equipments: {
        Row: {
          brand: string;
          category_id: string | null;
          color: string | null;
          company_id: string;
          created_at: string | null;
          employee_id: string | null;
          id: string;
          model: string | null;
          notes: string | null;
          pass_year: string | null;
          serial_number: string | null;
          status: string;
          updated_at: string | null;
        };
        Insert: {
          brand: string;
          category_id?: string | null;
          color?: string | null;
          company_id: string;
          created_at?: string | null;
          employee_id?: string | null;
          id?: string;
          model?: string | null;
          notes?: string | null;
          pass_year?: string | null;
          serial_number?: string | null;
          status?: string;
          updated_at?: string | null;
        };
        Update: {
          brand?: string;
          category_id?: string | null;
          color?: string | null;
          company_id?: string;
          created_at?: string | null;
          employee_id?: string | null;
          id?: string;
          model?: string | null;
          notes?: string | null;
          pass_year?: string | null;
          serial_number?: string | null;
          status?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'equipments_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'equipment_categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'equipments_company_id_fkey';
            columns: ['company_id'];
            isOneToOne: false;
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'equipments_employee_id_fkey';
            columns: ['employee_id'];
            isOneToOne: false;
            referencedRelation: 'employees';
            referencedColumns: ['id'];
          },
        ];
      };
      feed_comments: {
        Row: {
          author_id: string | null;
          body: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          post_id: string;
        };
        Insert: {
          author_id?: string | null;
          body: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          post_id: string;
        };
        Update: {
          author_id?: string | null;
          body?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          post_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'feed_comments_post_id_fkey';
            columns: ['post_id'];
            isOneToOne: false;
            referencedRelation: 'feed_posts';
            referencedColumns: ['id'];
          },
        ];
      };
      feed_posts: {
        Row: {
          attachments: Json;
          audience: string;
          author_id: string | null;
          body: string | null;
          company_id: string;
          created_at: string;
          deleted_at: string | null;
          department: string | null;
          edited_at: string | null;
          id: string;
        };
        Insert: {
          attachments?: Json;
          audience?: string;
          author_id?: string | null;
          body?: string | null;
          company_id: string;
          created_at?: string;
          deleted_at?: string | null;
          department?: string | null;
          edited_at?: string | null;
          id?: string;
        };
        Update: {
          attachments?: Json;
          audience?: string;
          author_id?: string | null;
          body?: string | null;
          company_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          department?: string | null;
          edited_at?: string | null;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'feed_posts_company_id_fkey';
            columns: ['company_id'];
            isOneToOne: false;
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
        ];
      };
      feed_reactions: {
        Row: {
          created_at: string;
          emoji: string;
          post_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          emoji: string;
          post_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          emoji?: string;
          post_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'feed_reactions_post_id_fkey';
            columns: ['post_id'];
            isOneToOne: false;
            referencedRelation: 'feed_posts';
            referencedColumns: ['id'];
          },
        ];
      };
      holidays: {
        Row: {
          created_at: string;
          date: string;
          id: string;
          is_national: boolean;
          name: string;
          year: number;
        };
        Insert: {
          created_at?: string;
          date: string;
          id?: string;
          is_national?: boolean;
          name: string;
          year: number;
        };
        Update: {
          created_at?: string;
          date?: string;
          id?: string;
          is_national?: boolean;
          name?: string;
          year?: number;
        };
        Relationships: [];
      };
      mail_account_members: {
        Row: {
          account_id: string;
          created_at: string;
          user_id: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          user_id: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'mail_account_members_account_id_fkey';
            columns: ['account_id'];
            isOneToOne: false;
            referencedRelation: 'mail_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      mail_accounts: {
        Row: {
          access_id: string | null;
          auth_method: string;
          color: string;
          company_id: string | null;
          created_at: string;
          display_name: string | null;
          email: string;
          id: string;
          imap_host: string | null;
          imap_port: number | null;
          is_default: boolean;
          last_error: string | null;
          last_sync_at: string | null;
          provider: string;
          secret_id: string | null;
          signature: string | null;
          smtp_host: string | null;
          smtp_port: number | null;
          status: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          access_id?: string | null;
          auth_method: string;
          color?: string;
          company_id?: string | null;
          created_at?: string;
          display_name?: string | null;
          email: string;
          id?: string;
          imap_host?: string | null;
          imap_port?: number | null;
          is_default?: boolean;
          last_error?: string | null;
          last_sync_at?: string | null;
          provider: string;
          secret_id?: string | null;
          signature?: string | null;
          smtp_host?: string | null;
          smtp_port?: number | null;
          status?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          access_id?: string | null;
          auth_method?: string;
          color?: string;
          company_id?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string;
          id?: string;
          imap_host?: string | null;
          imap_port?: number | null;
          is_default?: boolean;
          last_error?: string | null;
          last_sync_at?: string | null;
          provider?: string;
          secret_id?: string | null;
          signature?: string | null;
          smtp_host?: string | null;
          smtp_port?: number | null;
          status?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'mail_accounts_access_id_fkey';
            columns: ['access_id'];
            isOneToOne: true;
            referencedRelation: 'accesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'mail_accounts_company_id_fkey';
            columns: ['company_id'];
            isOneToOne: false;
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
        ];
      };
      mail_oauth_states: {
        Row: {
          code_verifier: string;
          created_at: string;
          mail_provider: string;
          oauth_provider: string;
          redirect_to: string;
          state: string;
          user_id: string;
        };
        Insert: {
          code_verifier: string;
          created_at?: string;
          mail_provider: string;
          oauth_provider: string;
          redirect_to: string;
          state: string;
          user_id: string;
        };
        Update: {
          code_verifier?: string;
          created_at?: string;
          mail_provider?: string;
          oauth_provider?: string;
          redirect_to?: string;
          state?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      notification_emails_absences: {
        Row: {
          created_at: string;
          created_by: string | null;
          email: string;
          id: string;
          is_active: boolean;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          email: string;
          id?: string;
          is_active?: boolean;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          email?: string;
          id?: string;
          is_active?: boolean;
        };
        Relationships: [];
      };
      notification_emails_birthdays: {
        Row: {
          created_at: string;
          created_by: string | null;
          email: string;
          id: string;
          is_active: boolean;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          email: string;
          id?: string;
          is_active?: boolean;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          email?: string;
          id?: string;
          is_active?: boolean;
        };
        Relationships: [];
      };
      notification_emails_support: {
        Row: {
          created_at: string;
          created_by: string | null;
          department_id: string;
          email: string;
          id: string;
          is_active: boolean;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          department_id: string;
          email: string;
          id?: string;
          is_active?: boolean;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          department_id?: string;
          email?: string;
          id?: string;
          is_active?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'notification_emails_support_department_id_fkey';
            columns: ['department_id'];
            isOneToOne: false;
            referencedRelation: 'support_departments';
            referencedColumns: ['id'];
          },
        ];
      };
      notification_reads: {
        Row: {
          employee_id: string;
          id: string;
          notification_id: string;
          read_at: string;
        };
        Insert: {
          employee_id: string;
          id?: string;
          notification_id: string;
          read_at?: string;
        };
        Update: {
          employee_id?: string;
          id?: string;
          notification_id?: string;
          read_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notification_reads_employee_id_fkey';
            columns: ['employee_id'];
            isOneToOne: false;
            referencedRelation: 'employees';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notification_reads_notification_id_fkey';
            columns: ['notification_id'];
            isOneToOne: false;
            referencedRelation: 'notifications';
            referencedColumns: ['id'];
          },
        ];
      };
      notification_emails_timeclock: {
        Row: {
          created_at: string;

          created_by: string | null;

          email: string;

          id: string;

          is_active: boolean;
        };

        Insert: {
          created_at?: string;

          created_by?: string | null;

          email: string;

          id?: string;

          is_active?: boolean;
        };

        Update: {
          created_at?: string;

          created_by?: string | null;

          email?: string;

          id?: string;

          is_active?: boolean;
        };

        Relationships: [];
      };

      notifications: {
        Row: {
          company_id: string | null;
          created_at: string;
          created_by: string;
          employee_id: string | null;
          expires_at: string | null;
          id: string;
          is_active: boolean;
          message: string;
          title: string;
        };
        Insert: {
          company_id?: string | null;
          created_at?: string;
          created_by: string;
          employee_id?: string | null;
          expires_at?: string | null;
          id?: string;
          is_active?: boolean;
          message: string;
          title: string;
        };
        Update: {
          company_id?: string | null;
          created_at?: string;
          created_by?: string;
          employee_id?: string | null;
          expires_at?: string | null;
          id?: string;
          is_active?: boolean;
          message?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_company_id_fkey';
            columns: ['company_id'];
            isOneToOne: false;
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_employee_id_fkey';
            columns: ['employee_id'];
            isOneToOne: false;
            referencedRelation: 'employees';
            referencedColumns: ['id'];
          },
        ];
      };
      phones: {
        Row: {
          company_id: string;
          created_at: string;
          employee_id: string | null;
          id: string;
          label: string | null;
          notes: string | null;
          operator: string | null;
          phone_number: string;
          pin: string | null;
          puk: string | null;
          updated_at: string;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          employee_id?: string | null;
          id?: string;
          label?: string | null;
          notes?: string | null;
          operator?: string | null;
          phone_number: string;
          pin?: string | null;
          puk?: string | null;
          updated_at?: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          employee_id?: string | null;
          id?: string;
          label?: string | null;
          notes?: string | null;
          operator?: string | null;
          phone_number?: string;
          pin?: string | null;
          puk?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'phones_company_id_fkey';
            columns: ['company_id'];
            isOneToOne: false;
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'phones_employee_id_fkey';
            columns: ['employee_id'];
            isOneToOne: false;
            referencedRelation: 'employees';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string;
          id: string;
          name: string;
          phone: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email: string;
          id?: string;
          name: string;
          phone?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string;
          id?: string;
          name?: string;
          phone?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      session_transfers: {
        Row: {
          created_at: string | null;
          expires_at: string;
          id: string;
          token: string;
          used_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          expires_at?: string;
          id?: string;
          token: string;
          used_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          expires_at?: string;
          id?: string;
          token?: string;
          used_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      support_departments: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      support_ticket_attachments: {
        Row: {
          content_type: string;
          created_at: string;
          file_name: string;
          file_path: string;
          file_size: number;
          id: string;
          ticket_id: string;
          uploaded_by: string;
        };
        Insert: {
          content_type: string;
          created_at?: string;
          file_name: string;
          file_path: string;
          file_size: number;
          id?: string;
          ticket_id: string;
          uploaded_by: string;
        };
        Update: {
          content_type?: string;
          created_at?: string;
          file_name?: string;
          file_path?: string;
          file_size?: number;
          id?: string;
          ticket_id?: string;
          uploaded_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'support_ticket_attachments_ticket_id_fkey';
            columns: ['ticket_id'];
            isOneToOne: false;
            referencedRelation: 'support_tickets';
            referencedColumns: ['id'];
          },
        ];
      };
      support_ticket_replies: {
        Row: {
          created_at: string;
          id: string;
          message: string;
          sender_role: string;
          ticket_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          message: string;
          sender_role: string;
          ticket_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          message?: string;
          sender_role?: string;
          ticket_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'support_ticket_replies_ticket_id_fkey';
            columns: ['ticket_id'];
            isOneToOne: false;
            referencedRelation: 'support_tickets';
            referencedColumns: ['id'];
          },
        ];
      };
      support_ticket_subjects: {
        Row: {
          created_at: string;
          default_priority: string;
          department_id: string | null;
          id: string;
          is_active: boolean;
          label: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          default_priority?: string;
          department_id?: string | null;
          id?: string;
          is_active?: boolean;
          label: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          default_priority?: string;
          department_id?: string | null;
          id?: string;
          is_active?: boolean;
          label?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'support_ticket_subjects_department_id_fkey';
            columns: ['department_id'];
            isOneToOne: false;
            referencedRelation: 'support_departments';
            referencedColumns: ['id'];
          },
        ];
      };
      support_tickets: {
        Row: {
          admin_notes: string | null;
          company_id: string;
          created_at: string;
          department_id: string | null;
          employee_id: string;
          id: string;
          message: string;
          priority: string;
          resolved_at: string | null;
          resolved_by: string | null;
          status: string;
          subject: string;
          updated_at: string;
        };
        Insert: {
          admin_notes?: string | null;
          company_id: string;
          created_at?: string;
          department_id?: string | null;
          employee_id: string;
          id?: string;
          message: string;
          priority?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: string;
          subject: string;
          updated_at?: string;
        };
        Update: {
          admin_notes?: string | null;
          company_id?: string;
          created_at?: string;
          department_id?: string | null;
          employee_id?: string;
          id?: string;
          message?: string;
          priority?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: string;
          subject?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'support_tickets_company_id_fkey';
            columns: ['company_id'];
            isOneToOne: false;
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'support_tickets_department_id_fkey';
            columns: ['department_id'];
            isOneToOne: false;
            referencedRelation: 'support_departments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'support_tickets_employee_id_fkey';
            columns: ['employee_id'];
            isOneToOne: false;
            referencedRelation: 'employees';
            referencedColumns: ['id'];
          },
        ];
      };
      system_settings: {
        Row: {
          key: string;
          updated_at: string;
          updated_by: string | null;
          value: string;
        };
        Insert: {
          key: string;
          updated_at?: string;
          updated_by?: string | null;
          value: string;
        };
        Update: {
          key?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: string;
        };
        Relationships: [];
      };
      task_attachments: {
        Row: {
          created_at: string;
          id: string;
          mime: string | null;
          name: string;
          path: string;
          size: number;
          task_id: string;
          uploaded_by: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          mime?: string | null;
          name: string;
          path: string;
          size?: number;
          task_id: string;
          uploaded_by?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          mime?: string | null;
          name?: string;
          path?: string;
          size?: number;
          task_id?: string;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'task_attachments_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
        ];
      };
      task_checklist_items: {
        Row: {
          created_at: string;
          done: boolean;
          id: string;
          position: number;
          task_id: string;
          text: string;
        };
        Insert: {
          created_at?: string;
          done?: boolean;
          id?: string;
          position?: number;
          task_id: string;
          text: string;
        };
        Update: {
          created_at?: string;
          done?: boolean;
          id?: string;
          position?: number;
          task_id?: string;
          text?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_checklist_items_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
        ];
      };
      task_comments: {
        Row: {
          author_id: string | null;
          body: string;
          created_at: string;
          id: string;
          task_id: string;
        };
        Insert: {
          author_id?: string | null;
          body: string;
          created_at?: string;
          id?: string;
          task_id: string;
        };
        Update: {
          author_id?: string | null;
          body?: string;
          created_at?: string;
          id?: string;
          task_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_comments_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
        ];
      };
      task_participants: {
        Row: {
          task_id: string;
          user_id: string;
        };
        Insert: {
          task_id: string;
          user_id: string;
        };
        Update: {
          task_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_participants_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
        ];
      };
      tasks: {
        Row: {
          assignee_id: string | null;
          company_id: string;
          completed_at: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          due_at: string | null;
          due_notified_at: string | null;
          id: string;
          parent_id: string | null;
          position: number;
          priority: string;
          recurrence: string | null;
          source_ref: string | null;
          source_type: string | null;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          assignee_id?: string | null;
          company_id: string;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          due_at?: string | null;
          due_notified_at?: string | null;
          id?: string;
          parent_id?: string | null;
          position?: number;
          priority?: string;
          recurrence?: string | null;
          source_ref?: string | null;
          source_type?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          assignee_id?: string | null;
          company_id?: string;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          due_at?: string | null;
          due_notified_at?: string | null;
          id?: string;
          parent_id?: string | null;
          position?: number;
          priority?: string;
          recurrence?: string | null;
          source_ref?: string | null;
          source_type?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tasks_company_id_fkey';
            columns: ['company_id'];
            isOneToOne: false;
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
        ];
      };
      time_clock_attempts: {
        Row: {
          accuracy_m: number | null;
          created_at: string;
          device_id: string | null;
          distance_m: number | null;
          employee_id: string | null;
          flags: string[];
          id: string;
          ip_address: string | null;
          ip_country: string | null;
          latitude: number | null;
          location_id: string | null;
          longitude: number | null;
          reason: string;
          source: string | null;
          tag_id: string | null;
          user_agent: string | null;
          user_id: string | null;
        };
        Insert: {
          accuracy_m?: number | null;
          created_at?: string;
          device_id?: string | null;
          distance_m?: number | null;
          employee_id?: string | null;
          flags?: string[];
          id?: string;
          ip_address?: string | null;
          ip_country?: string | null;
          latitude?: number | null;
          location_id?: string | null;
          longitude?: number | null;
          reason: string;
          source?: string | null;
          tag_id?: string | null;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Update: {
          accuracy_m?: number | null;
          created_at?: string;
          device_id?: string | null;
          distance_m?: number | null;
          employee_id?: string | null;
          flags?: string[];
          id?: string;
          ip_address?: string | null;
          ip_country?: string | null;
          latitude?: number | null;
          location_id?: string | null;
          longitude?: number | null;
          reason?: string;
          source?: string | null;
          tag_id?: string | null;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'time_clock_attempts_employee_id_fkey';
            columns: ['employee_id'];
            isOneToOne: false;
            referencedRelation: 'employees';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'time_clock_attempts_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: false;
            referencedRelation: 'time_clock_locations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'time_clock_attempts_tag_id_fkey';
            columns: ['tag_id'];
            isOneToOne: false;
            referencedRelation: 'time_clock_tags';
            referencedColumns: ['id'];
          },
        ];
      };
      time_clock_config_history: {
        Row: {
          action: string;

          changed_at: string;

          changed_by: string | null;

          changed_by_name: string | null;

          changed_fields: string[];

          id: string;

          new_data: Json | null;

          old_data: Json | null;

          record_id: string;

          table_name: string;
        };

        Insert: {
          action: string;

          changed_at?: string;

          changed_by?: string | null;

          changed_by_name?: string | null;

          changed_fields?: string[];

          id?: string;

          new_data?: Json | null;

          old_data?: Json | null;

          record_id: string;

          table_name: string;
        };

        Update: {
          action?: string;

          changed_at?: string;

          changed_by?: string | null;

          changed_by_name?: string | null;

          changed_fields?: string[];

          id?: string;

          new_data?: Json | null;

          old_data?: Json | null;

          record_id?: string;

          table_name?: string;
        };

        Relationships: [];
      };

      time_clock_entries: {
        Row: {
          accuracy_m: number | null;
          address: string | null;
          company_id: string;
          created_at: string;
          created_by: string | null;
          device_id: string | null;
          distance_m: number | null;
          employee_id: string;
          entry_type: string;
          flags: string[];
          id: string;
          kind: string;
          ip_address: string | null;
          ip_city: string | null;
          ip_country: string | null;
          ip_is_proxy: boolean | null;
          latitude: number | null;
          location_id: string | null;
          longitude: number | null;
          notes: string | null;
          punched_at: string;
          source: string;
          status: string;
          tag_id: string | null;
          updated_at: string;
          updated_by: string | null;
          user_agent: string | null;
          work_mode: string;
          employee_note: string | null;
        };
        Insert: {
          accuracy_m?: number | null;
          address?: string | null;
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          device_id?: string | null;
          distance_m?: number | null;
          employee_id: string;
          entry_type: string;
          flags?: string[];
          id?: string;
          kind?: string;
          ip_address?: string | null;
          ip_city?: string | null;
          ip_country?: string | null;
          ip_is_proxy?: boolean | null;
          latitude?: number | null;
          location_id?: string | null;
          longitude?: number | null;
          notes?: string | null;
          punched_at?: string;
          source: string;
          status?: string;
          tag_id?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          user_agent?: string | null;
          work_mode?: string;
          employee_note?: string | null;
        };
        Update: {
          accuracy_m?: number | null;
          address?: string | null;
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          device_id?: string | null;
          distance_m?: number | null;
          employee_id?: string;
          entry_type?: string;
          flags?: string[];
          id?: string;
          kind?: string;
          ip_address?: string | null;
          ip_city?: string | null;
          ip_country?: string | null;
          ip_is_proxy?: boolean | null;
          latitude?: number | null;
          location_id?: string | null;
          longitude?: number | null;
          notes?: string | null;
          punched_at?: string;
          source?: string;
          status?: string;
          tag_id?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          user_agent?: string | null;
          work_mode?: string;
          employee_note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'time_clock_entries_company_id_fkey';
            columns: ['company_id'];
            isOneToOne: false;
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'time_clock_entries_employee_id_fkey';
            columns: ['employee_id'];
            isOneToOne: false;
            referencedRelation: 'employees';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'time_clock_entries_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: false;
            referencedRelation: 'time_clock_locations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'time_clock_entries_tag_id_fkey';
            columns: ['tag_id'];
            isOneToOne: false;
            referencedRelation: 'time_clock_tags';
            referencedColumns: ['id'];
          },
        ];
      };
      time_clock_entry_history: {
        Row: {
          action: string;
          changed_at: string;
          changed_by: string | null;
          changed_by_name: string | null;
          changed_fields: string[];
          employee_id: string;
          entry_id: string;
          id: string;
          new_data: Json | null;
          old_data: Json | null;
          reason: string | null;
        };
        Insert: {
          action: string;
          changed_at?: string;
          changed_by?: string | null;
          changed_by_name?: string | null;
          changed_fields?: string[];
          employee_id: string;
          entry_id: string;
          id?: string;
          new_data?: Json | null;
          old_data?: Json | null;
          reason?: string | null;
        };
        Update: {
          action?: string;
          changed_at?: string;
          changed_by?: string | null;
          changed_by_name?: string | null;
          changed_fields?: string[];
          employee_id?: string;
          entry_id?: string;
          id?: string;
          new_data?: Json | null;
          old_data?: Json | null;
          reason?: string | null;
        };
        Relationships: [];
      };
      time_clock_locations: {
        Row: {
          address: string | null;
          allow_manual: boolean;
          block_vpn: boolean;
          company_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          is_active: boolean;
          latitude: number;
          longitude: number;
          max_accuracy_m: number;
          name: string;
          radius_m: number;
          trusted_ips: string[];
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          allow_manual?: boolean;
          block_vpn?: boolean;
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          latitude: number;
          longitude: number;
          max_accuracy_m?: number;
          name: string;
          radius_m?: number;
          trusted_ips?: string[];
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          allow_manual?: boolean;
          block_vpn?: boolean;
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          latitude?: number;
          longitude?: number;
          max_accuracy_m?: number;
          name?: string;
          radius_m?: number;
          trusted_ips?: string[];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'time_clock_locations_company_id_fkey';
            columns: ['company_id'];
            isOneToOne: false;
            referencedRelation: 'companies';
            referencedColumns: ['id'];
          },
        ];
      };
      time_clock_tags: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          is_active: boolean;
          label: string;
          last_counter: number;
          last_used_at: string | null;
          location_id: string;
          tag_type: string;
          token_hash: string | null;
          uid: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          label: string;
          last_counter?: number;
          last_used_at?: string | null;
          location_id: string;
          tag_type: string;
          token_hash?: string | null;
          uid?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          label?: string;
          last_counter?: number;
          last_used_at?: string | null;
          location_id?: string;
          tag_type?: string;
          token_hash?: string | null;
          uid?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'time_clock_tags_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: false;
            referencedRelation: 'time_clock_locations';
            referencedColumns: ['id'];
          },
        ];
      };
      user_notifications: {
        Row: {
          actor_id: string | null;
          body: string | null;
          created_at: string;
          id: string;
          kind: string;
          link: string | null;
          read_at: string | null;
          title: string;
          user_id: string;
        };
        Insert: {
          actor_id?: string | null;
          body?: string | null;
          created_at?: string;
          id?: string;
          kind: string;
          link?: string | null;
          read_at?: string | null;
          title: string;
          user_id: string;
        };
        Update: {
          actor_id?: string | null;
          body?: string | null;
          created_at?: string;
          id?: string;
          kind?: string;
          link?: string | null;
          read_at?: string | null;
          title?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database['public']['Enums']['app_role'];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role?: Database['public']['Enums']['app_role'];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database['public']['Enums']['app_role'];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      chat_bootstrap: { Args: never; Returns: undefined };
      chat_can_post: { Args: { _conversation_id: string }; Returns: boolean };
      chat_create_group: {
        Args: { _member_ids: string[]; _title: string };
        Returns: string;
      };
      chat_directory: {
        Args: never;
        Returns: {
          company_id: string;
          company_name: string;
          department: string;
          email: string;
          employee_id: string;
          name: string;
          position: string;
          user_id: string;
        }[];
      };
      chat_is_colleague: { Args: { _user_id: string }; Returns: boolean };
      chat_is_member: { Args: { _conversation_id: string }; Returns: boolean };
      chat_list_conversations: {
        Args: never;
        Returns: {
          created_at: string;
          id: string;
          is_archived: boolean;
          is_default: boolean;
          is_muted: boolean;
          is_pinned: boolean;
          kind: string;
          last_attachment_name: string;
          last_body: string;
          last_deleted: boolean;
          last_kind: string;
          last_message_at: string;
          last_sender_id: string;
          last_sender_name: string;
          member_count: number;
          my_role: string;
          peer_department: string;
          peer_name: string;
          peer_position: string;
          peer_user_id: string;
          title: string;
          unread: number;
        }[];
      };
      chat_mark_read: { Args: { _conversation_id: string }; Returns: undefined };
      chat_path_conversation: { Args: { _name: string }; Returns: string };
      chat_start_direct: { Args: { _other_user_id: string }; Returns: string };
      cleanup_expired_session_transfers: { Args: never; Returns: undefined };
      event_can_see: { Args: { _event_id: string }; Returns: boolean };
      event_is_attendee: { Args: { _event_id: string }; Returns: boolean };
      feed_can_see: { Args: { _post_id: string }; Returns: boolean };
      feed_can_see_row: {
        Args: {
          _audience: string;
          _author_id: string;
          _company_id: string;
          _department: string;
        };
        Returns: boolean;
      };
      feed_is_author: { Args: { _post_id: string }; Returns: boolean };
      feed_list_posts: {
        Args: { _before?: string; _limit?: number };
        Returns: {
          attachments: Json;
          audience: string;
          author_id: string;
          body: string;
          comment_count: number;
          created_at: string;
          department: string;
          edited_at: string;
          id: string;
          reactions: Json;
        }[];
      };
      get_admin_permissions: {
        Args: { _user_id: string };
        Returns: {
          can_edit: boolean;
          can_execute: boolean;
          can_view: boolean;
          module_key: string;
          topic_key: string;
        }[];
      };
      get_employee_company_id: { Args: { _user_id: string }; Returns: string };
      get_employee_id_from_user: { Args: { _user_id: string }; Returns: string };
      get_user_support_departments: {
        Args: { _user_id: string };
        Returns: string[];
      };
      has_module_permission: {
        Args: {
          _module_key: string;
          _permission?: string;
          _topic_key?: string;
          _user_id: string;
        };
        Returns: boolean;
      };
      has_timeclock_permission: {
        Args: { _permission?: string; _topic_key?: string; _user_id: string };
        Returns: boolean;
      };
      has_role: {
        Args: {
          _role: Database['public']['Enums']['app_role'];
          _user_id: string;
        };
        Returns: boolean;
      };
      mail_account_delete: { Args: { p_account: string }; Returns: undefined };
      mail_is_member: {
        Args: { p_account: string; p_user: string };
        Returns: boolean;
      };
      mail_secret_get: { Args: { p_account: string }; Returns: string };
      mail_secret_set: {
        Args: { p_account: string; p_secret: string };
        Returns: undefined;
      };
      mail_sync_access_members: {
        Args: { p_access: string };
        Returns: undefined;
      };
      review_employee_document: {
        Args: {
          _document_id: string;
          _decision: string;
          _category?: string | null;
          _document_number?: string | null;
          _issue_date?: string | null;
          _expiry_date?: string | null;
          _period_month?: string | null;
          _notes?: string | null;
        };
        Returns: undefined;
      };
      reschedule_vacation: {
        Args: {
          p_absence_id: string;
          p_notes?: string | null;
          p_periods: Json;
        };
        Returns: string;
      };
      rz_my_company: { Args: never; Returns: string };
      task_can_see: { Args: { _task_id: string }; Returns: boolean };
      task_is_participant: { Args: { _task_id: string }; Returns: boolean };
      task_valid_assignee: { Args: { _user_id: string }; Returns: boolean };
      time_clock_admin_create_entry: {
        Args: {
          _employee_id: string;
          _entry_type: string;
          _kind?: string;
          _location_id?: string | null;
          _notes?: string | null;
          _punched_at: string;
          _reason: string;
        };
        Returns: string;
      };
      time_clock_admin_review: {
        Args: { _decision: string; _entry_ids: string[]; _reason?: string | null };
        Returns: number;
      };
      time_clock_admin_set_status: {
        Args: { _entry_id: string; _reason: string; _status: string };
        Returns: undefined;
      };
      time_clock_swap_own_entry: {
        Args: { _entry_id: string };
        Returns: string;
      };
      time_clock_undo_own_entry: {
        Args: { _entry_id: string };
        Returns: string;
      };
      time_clock_admin_update_entry: {
        Args: {
          _entry_id: string;
          _entry_type: string;
          _kind?: string | null;
          _notes?: string | null;
          _punched_at: string;
          _reason: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: 'admin' | 'company_admin' | 'employee';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ['admin', 'company_admin', 'employee'],
    },
  },
} as const;
