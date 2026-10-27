import { supabase } from '@/integrations/supabase/client';

export interface AdminTaskPerson {
  userId: string;
  name: string;
  department: string | null;
}

export interface AdminTaskInput {
  companyId: string;
  title: string;
  description: string;
  assigneeId: string;
  participantIds: string[];
  dueAt: string | null;
  priority: string;
}

/** Tarefas criadas no admin por quem não tem ficha de colaborador (funções só para admins). */
export const adminTaskService = {
  /** Colaboradores ativos, com conta, da empresa. */
  people: async (companyId: string) => {
    const { data, error } = await supabase.rpc('admin_task_people', { _company_id: companyId });
    const people: AdminTaskPerson[] = (data ?? []).map(row => ({
      userId: row.user_id,
      name: row.name,
      department: row.department,
    }));
    return { data: people, error };
  },

  /** Cria a tarefa na empresa; devolve o id. */
  create: async (input: AdminTaskInput) => {
    const { data, error } = await supabase.rpc('admin_create_task', {
      _company_id: input.companyId,
      _title: input.title,
      _description: input.description,
      _assignee_id: input.assigneeId,
      _participant_ids: input.participantIds,
      _due_at: input.dueAt,
      _priority: input.priority,
    });
    return { data, error };
  },
};
