// Tarefas no Supabase (tasks, participantes, lista, comentários e anexos em task-files).
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { TaskInput } from '../types';

type Tables = Database['public']['Tables'];
export type TaskRow = Tables['tasks']['Row'] & { task_participants: { user_id: string }[] };
export type TaskUpdate = Pick<
  Tables['tasks']['Update'],
  | 'title'
  | 'description'
  | 'status'
  | 'priority'
  | 'due_at'
  | 'assignee_id'
  | 'recurrence'
  | 'position'
>;

const BUCKET = 'task-files';

export const taskService = {
  /** Tarefas que o utilizador pode ver (as regras da BD filtram), com os participantes. */
  list: async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*, task_participants(user_id)')
      .order('created_at', { ascending: false })
      .limit(1000);
    return { data: (data ?? []) as TaskRow[], error };
  },

  create: async (companyId: string, userId: string, input: TaskInput) => {
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        company_id: companyId,
        created_by: userId,
        title: input.title.trim(),
        description: input.description.trim() || null,
        assignee_id: input.assigneeId,
        due_at: input.dueAt,
        priority: input.priority,
        recurrence: input.recurrence,
        parent_id: input.parentId ?? null,
        source_type: input.sourceType ?? null,
        source_ref: input.sourceRef ?? null,
      })
      .select('id')
      .single();
    if (error || !data) return { data: null, error };
    const participants = input.participantIds.filter(id => id !== input.assigneeId);
    if (participants.length > 0) {
      await supabase
        .from('task_participants')
        .insert(participants.map(user_id => ({ task_id: data.id, user_id })));
    }
    return { data: data.id, error: null };
  },

  update: async (id: string, patch: TaskUpdate) => {
    const { error } = await supabase.from('tasks').update(patch).eq('id', id);
    return { error };
  },

  remove: async (id: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    return { error };
  },

  setParticipants: async (taskId: string, add: string[], remove: string[]) => {
    if (add.length) {
      const { error } = await supabase
        .from('task_participants')
        .insert(add.map(user_id => ({ task_id: taskId, user_id })));
      if (error) return { error };
    }
    if (remove.length) {
      const { error } = await supabase
        .from('task_participants')
        .delete()
        .eq('task_id', taskId)
        .in('user_id', remove);
      if (error) return { error };
    }
    return { error: null };
  },

  /** Lista de verificação, comentários e anexos de uma tarefa. */
  detail: async (taskId: string) => {
    const [checklist, comments, attachments] = await Promise.all([
      supabase.from('task_checklist_items').select('*').eq('task_id', taskId).order('position'),
      supabase.from('task_comments').select('*').eq('task_id', taskId).order('created_at'),
      supabase.from('task_attachments').select('*').eq('task_id', taskId).order('created_at'),
    ]);
    const error = checklist.error ?? comments.error ?? attachments.error;
    return {
      data: error
        ? null
        : {
            checklist: checklist.data ?? [],
            comments: comments.data ?? [],
            attachments: attachments.data ?? [],
          },
      error,
    };
  },

  addChecklistItem: async (taskId: string, text: string, position: number) => {
    const { error } = await supabase
      .from('task_checklist_items')
      .insert({ task_id: taskId, text, position });
    return { error };
  },

  toggleChecklistItem: async (id: string, done: boolean) => {
    const { error } = await supabase.from('task_checklist_items').update({ done }).eq('id', id);
    return { error };
  },

  removeChecklistItem: async (id: string) => {
    const { error } = await supabase.from('task_checklist_items').delete().eq('id', id);
    return { error };
  },

  addComment: async (taskId: string, authorId: string, body: string) => {
    const { error } = await supabase
      .from('task_comments')
      .insert({ task_id: taskId, author_id: authorId, body });
    return { error };
  },

  uploadAttachment: async (taskId: string, userId: string, file: File) => {
    const path = `${taskId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-80)}`;
    const upload = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type });
    if (upload.error) return { error: upload.error };
    const { error } = await supabase.from('task_attachments').insert({
      task_id: taskId,
      path,
      name: file.name,
      size: file.size,
      mime: file.type || null,
      uploaded_by: userId,
    });
    return { error };
  },

  getFileUrl: async (path: string) => {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600);
    return data?.signedUrl ?? null;
  },
};
