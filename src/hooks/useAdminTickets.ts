import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  admin_notes: string | null;
  employee_id: string;
  company_id: string;
  department_id: string | null;
  employees: {
    name: string;
    email: string;
  };
  companies: {
    name: string;
  };
}

export const useAdminTickets = () => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadTickets = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select(
          `
          *,
          employees(name, email),
          companies(name)
        `
        )
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }
      setTickets((data as unknown as SupportTicket[]) || []);
    } catch (error) {
      console.error('Error loading tickets:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const sendStatusNotification = async (
    ticket: SupportTicket,
    newStatus: string,
    notes: string | null,
    notificationType: 'status_change' | 'notes_added'
  ) => {
    try {
      await supabase.functions.invoke('send-ticket-status-notification', {
        body: {
          ticketId: ticket.id,
          employeeEmail: ticket.employees.email,
          employeeName: ticket.employees.name,
          ticketSubject: ticket.subject,
          oldStatus: ticket.status,
          newStatus: newStatus,
          adminNotes: notes,
          notificationType,
        },
      });
      console.log('Status notification sent successfully');
    } catch (error) {
      console.error('Failed to send status notification:', error);
    }
  };

  const updateTicketStatus = async (ticketId: string, newStatus: string) => {
    const ticket = tickets.find(t => t.id === ticketId);
    const oldStatus = ticket?.status;

    const updateData: Record<string, any> = {
      status: newStatus,
    };

    if (newStatus === 'resolved' || newStatus === 'closed') {
      updateData.resolved_at = new Date().toISOString();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) updateData.resolved_by = user.id;
    }

    const { error } = await supabase.from('support_tickets').update(updateData).eq('id', ticketId);

    if (error) throw error;

    if (ticket && oldStatus !== newStatus) {
      const { data: updatedTicket } = await supabase
        .from('support_tickets')
        .select('admin_notes')
        .eq('id', ticketId)
        .single();

      await sendStatusNotification(
        ticket,
        newStatus,
        updatedTicket?.admin_notes || null,
        'status_change'
      );
    }

    await loadTickets();
  };

  const saveAdminNotes = async (ticket: SupportTicket, notes: string) => {
    const { error } = await supabase
      .from('support_tickets')
      .update({ admin_notes: notes })
      .eq('id', ticket.id);

    if (error) throw error;

    await sendStatusNotification(ticket, ticket.status, notes, 'notes_added');

    await loadTickets();
  };

  return {
    tickets,
    isLoading,
    refetch: loadTickets,
    updateTicketStatus,
    saveAdminNotes,
  };
};
