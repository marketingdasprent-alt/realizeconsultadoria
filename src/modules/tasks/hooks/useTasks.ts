// Tarefas: lista (com tempo real) e alterações. Na pré-visualização, em memória.
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { DEMO_TASKS } from '../lib/demoData';
import { taskService, type TaskRow } from '../services/taskService';
import type { Task, TaskInput, TaskPriority, TaskRecurrence, TaskStatus } from '../types';

export const TASKS_KEY = ['tasks'] as const;

// Exemplo partilhado por todos os ecrãs da pré-visualização.
let demoTasks: Task[] = DEMO_TASKS;
const listeners = new Set<() => void>();
const setDemoTasks = (update: (tasks: Task[]) => Task[]) => {
  demoTasks = update(demoTasks);
  listeners.forEach(listener => listener());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export interface TaskPatch {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueAt?: string | null;
  assigneeId?: string | null;
  recurrence?: TaskRecurrence | null;
  position?: number;
}

const toTask = (row: TaskRow, all: TaskRow[]): Task => {
  const subtasks = all.filter(t => t.parent_id === row.id);
  return {
    id: row.id,
    parentId: row.parent_id,
    title: row.title,
    description: row.description,
    status: row.status as TaskStatus,
    priority: row.priority as TaskPriority,
    dueAt: row.due_at,
    createdBy: row.created_by,
    assigneeId: row.assignee_id,
    participantIds: (row.task_participants ?? []).map(p => p.user_id),
    recurrence: row.recurrence as TaskRecurrence | null,
    sourceType: row.source_type as Task['sourceType'],
    sourceRef: row.source_ref,
    position: row.position,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    subtaskCount: subtasks.length,
    subtaskDone: subtasks.filter(t => t.status === 'done').length,
  };
};

const fail = (description: string): void => {
  toast({ title: 'Não foi possível', description, variant: 'destructive' });
};

export const useTasks = () => {
  const { isPreview, user } = useWorkspace();
  const qc = useQueryClient();
  const demo = useSyncExternalStore(subscribe, () => demoTasks);

  const live = useQuery({
    queryKey: TASKS_KEY,
    queryFn: async () => {
      const { data, error } = await taskService.list();
      if (error) throw error;
      return data;
    },
    enabled: !isPreview,
  });

  // Alterações de colegas (atribuições, estados, comentários) em tempo real.
  useEffect(() => {
    if (isPreview) return;
    const refresh = () => qc.invalidateQueries({ queryKey: TASKS_KEY });
    const channel = supabase
      .channel(`tasks-${user.userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, refresh)
      // A tarefa grava-se antes dos participantes: ser posto numa tarefa chega por aqui.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_participants' }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isPreview, user.userId, qc]);

  const tasks = useMemo(
    () => (isPreview ? demo : (live.data ?? []).map(row => toTask(row, live.data ?? []))),
    [isPreview, demo, live.data]
  );
  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: TASKS_KEY }), [qc]);

  const create = async (input: TaskInput): Promise<string | null> => {
    if (!input.title.trim()) return null;
    if (isPreview) {
      const id = `demo-${Date.now()}`;
      setDemoTasks(list => [
        {
          id,
          parentId: input.parentId ?? null,
          title: input.title.trim(),
          description: input.description.trim() || null,
          status: 'todo',
          priority: input.priority,
          dueAt: input.dueAt,
          createdBy: user.userId,
          assigneeId: input.assigneeId,
          participantIds: input.participantIds,
          recurrence: input.recurrence,
          sourceType: input.sourceType ?? null,
          sourceRef: input.sourceRef ?? null,
          position: Date.now(),
          createdAt: new Date().toISOString(),
          completedAt: null,
          subtaskCount: 0,
          subtaskDone: 0,
        },
        ...list,
      ]);
      return id;
    }
    const { data, error } = await taskService.create(user.companyId, user.userId, input);
    if (error || !data) {
      fail('A tarefa não foi criada.');
      return null;
    }
    // Anexos escolhidos no "Nova tarefa": sobem depois de a tarefa existir.
    const failed: string[] = [];
    for (const file of input.files ?? []) {
      const { error: uploadError } = await taskService.uploadAttachment(data, user.userId, file);
      if (uploadError) failed.push(file.name);
    }
    if (failed.length)
      toast({
        title: 'Tarefa criada, mas alguns anexos falharam',
        description: failed.join(', '),
        variant: 'destructive',
      });
    else toast({ title: 'Tarefa criada' });
    await refresh();
    return data;
  };

  const update = async (id: string, patch: TaskPatch) => {
    if (isPreview) {
      return setDemoTasks(list => list.map(t => (t.id === id ? { ...t, ...patch } : t)));
    }
    const { error } = await taskService.update(id, {
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.description !== undefined && { description: patch.description }),
      ...(patch.status !== undefined && { status: patch.status }),
      ...(patch.priority !== undefined && { priority: patch.priority }),
      ...(patch.dueAt !== undefined && { due_at: patch.dueAt }),
      ...(patch.assigneeId !== undefined && { assignee_id: patch.assigneeId }),
      ...(patch.recurrence !== undefined && { recurrence: patch.recurrence }),
      ...(patch.position !== undefined && { position: patch.position }),
    });
    if (error) return fail('A alteração não foi guardada.');
    await refresh();
  };

  const remove = async (id: string) => {
    if (isPreview) return setDemoTasks(list => list.filter(t => t.id !== id && t.parentId !== id));
    const { error } = await taskService.remove(id);
    if (error) return fail('A tarefa não foi eliminada.');
    await refresh();
  };

  const setParticipants = async (task: Task, ids: string[]) => {
    if (isPreview) {
      return setDemoTasks(list =>
        list.map(t => (t.id === task.id ? { ...t, participantIds: ids } : t))
      );
    }
    const add = ids.filter(id => !task.participantIds.includes(id));
    const removeIds = task.participantIds.filter(id => !ids.includes(id));
    const { error } = await taskService.setParticipants(task.id, add, removeIds);
    if (error) return fail('Os participantes não foram guardados.');
    await refresh();
  };

  return {
    tasks,
    isLoading: !isPreview && live.isLoading,
    create,
    update,
    remove,
    setParticipants,
  };
};
