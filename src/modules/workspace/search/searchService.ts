// Pesquisa global no Supabase. O RLS de cada tabela decide o que o colaborador vê;
// documentos e tickets ficam ainda limitados aos do próprio (um admin vê mais pelo RLS).
import { supabase } from '@/integrations/supabase/client';
import { PER_GROUP, likePattern } from './searchRules';

export interface ServerSearchResults {
  messages: {
    id: string;
    conversationId: string;
    senderId: string | null;
    body: string;
    createdAt: string;
  }[];
  tasks: { id: string; title: string; status: string; dueAt: string | null }[];
  events: { id: string; title: string; startsAt: string; allDay: boolean }[];
  documents: { id: string; fileName: string; category: string | null; createdAt: string }[];
  tickets: { id: string; subject: string; status: string; createdAt: string }[];
  posts: { id: string; body: string; authorId: string | null; createdAt: string }[];
}

export const searchService = {
  /** Até PER_GROUP resultados por tipo, os mais recentes primeiro. */
  search: async (term: string, employeeId: string) => {
    const pattern = likePattern(term);
    const [messages, tasks, events, documents, tickets, posts] = await Promise.all([
      supabase
        .from('chat_messages')
        .select('id, conversation_id, sender_id, body, created_at')
        .ilike('body', pattern)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(PER_GROUP),
      supabase
        .from('tasks')
        .select('id, title, status, due_at')
        .ilike('title', pattern)
        .order('updated_at', { ascending: false })
        .limit(PER_GROUP),
      supabase
        .from('calendar_events')
        .select('id, title, starts_at, all_day')
        .ilike('title', pattern)
        .order('starts_at', { ascending: false })
        .limit(PER_GROUP),
      supabase
        .from('employee_documents')
        .select('id, file_name, category, created_at')
        .eq('employee_id', employeeId)
        .ilike('file_name', pattern)
        .order('created_at', { ascending: false })
        .limit(PER_GROUP),
      supabase
        .from('support_tickets')
        .select('id, subject, status, created_at')
        .eq('employee_id', employeeId)
        .ilike('subject', pattern)
        .order('created_at', { ascending: false })
        .limit(PER_GROUP),
      supabase
        .from('feed_posts')
        .select('id, body, author_id, created_at')
        .ilike('body', pattern)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(PER_GROUP),
    ]);

    const error =
      messages.error ??
      tasks.error ??
      events.error ??
      documents.error ??
      tickets.error ??
      posts.error;
    const data: ServerSearchResults = {
      messages: (messages.data ?? []).map(m => ({
        id: m.id,
        conversationId: m.conversation_id,
        senderId: m.sender_id,
        body: m.body ?? '',
        createdAt: m.created_at,
      })),
      tasks: (tasks.data ?? []).map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        dueAt: t.due_at,
      })),
      events: (events.data ?? []).map(e => ({
        id: e.id,
        title: e.title,
        startsAt: e.starts_at,
        allDay: e.all_day,
      })),
      documents: (documents.data ?? []).map(d => ({
        id: d.id,
        fileName: d.file_name,
        category: d.category,
        createdAt: d.created_at,
      })),
      tickets: (tickets.data ?? []).map(t => ({
        id: t.id,
        subject: t.subject,
        status: t.status,
        createdAt: t.created_at,
      })),
      posts: (posts.data ?? []).map(p => ({
        id: p.id,
        body: p.body ?? '',
        authorId: p.author_id,
        createdAt: p.created_at,
      })),
    };
    return { data, error };
  },
};
