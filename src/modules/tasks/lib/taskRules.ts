// Regras e etiquetas das Tarefas.
import type { Task, TaskPriority, TaskScope, TaskStatus } from '../types';

export const TASK_STATUSES: { key: TaskStatus; label: string; dot: string; column: string }[] = [
  { key: 'todo', label: 'Por fazer', dot: 'bg-slate-400', column: 'from-slate-100' },
  { key: 'in_progress', label: 'Em curso', dot: 'bg-sky-500', column: 'from-sky-50' },
  { key: 'review', label: 'Em revisão', dot: 'bg-amber-500', column: 'from-amber-50' },
  { key: 'done', label: 'Concluída', dot: 'bg-emerald-500', column: 'from-emerald-50' },
];

export const TASK_PRIORITIES: Record<TaskPriority, { label: string; chip: string; order: number }> =
  {
    urgent: { label: 'Urgente', chip: 'bg-rose-100 text-rose-700', order: 0 },
    high: { label: 'Alta', chip: 'bg-orange-100 text-orange-800', order: 1 },
    medium: { label: 'Média', chip: 'bg-blue-100 text-blue-800', order: 2 },
    low: { label: 'Baixa', chip: 'bg-slate-100 text-slate-600', order: 3 },
  };

export const RECURRENCE_LABELS: Record<string, string> = {
  daily: 'Todos os dias',
  weekly: 'Todas as semanas',
  monthly: 'Todos os meses',
};

export const TASK_SCOPES: { key: TaskScope; label: string }[] = [
  { key: 'mine', label: 'Atribuídas a mim' },
  { key: 'created', label: 'Criadas por mim' },
  { key: 'all', label: 'Todas' },
];

/** Prazo ultrapassado e por concluir. */
export const isOverdue = (task: Pick<Task, 'dueAt' | 'status'>, now: Date = new Date()): boolean =>
  !!task.dueAt && task.status !== 'done' && new Date(task.dueAt) < now;

/** Tarefas principais (sem as subtarefas) de um âmbito, com pesquisa. */
export const filterTasks = (
  tasks: Task[],
  scope: TaskScope,
  myUserId: string,
  query = ''
): Task[] => {
  const term = query.trim().toLowerCase();
  return tasks.filter(task => {
    if (task.parentId) return false;
    if (scope === 'mine' && task.assigneeId !== myUserId) return false;
    if (scope === 'created' && task.createdBy !== myUserId) return false;
    return !term || `${task.title} ${task.description ?? ''}`.toLowerCase().includes(term);
  });
};

/** Por concluir primeiro; depois prazo (sem prazo no fim), prioridade e data de criação. */
export const sortTasks = (tasks: Task[]): Task[] =>
  [...tasks].sort((a, b) => {
    const doneA = a.status === 'done' ? 1 : 0;
    const doneB = b.status === 'done' ? 1 : 0;
    if (doneA !== doneB) return doneA - doneB;
    if (a.dueAt !== b.dueAt) {
      if (!a.dueAt) return 1;
      if (!b.dueAt) return -1;
      return a.dueAt.localeCompare(b.dueAt);
    }
    const priority = TASK_PRIORITIES[a.priority].order - TASK_PRIORITIES[b.priority].order;
    return priority || b.createdAt.localeCompare(a.createdAt);
  });

/** Quadro: tarefas de cada estado, pela posição no quadro. */
export const groupByStatus = (tasks: Task[]): Record<TaskStatus, Task[]> => {
  const groups: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], review: [], done: [] };
  for (const task of tasks) groups[task.status].push(task);
  for (const key of Object.keys(groups) as TaskStatus[]) {
    groups[key].sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
  }
  return groups;
};

/** Posição para largar um cartão entre dois vizinhos do quadro. */
export const positionBetween = (before?: number, after?: number): number => {
  if (before === undefined && after === undefined) return 0;
  if (before === undefined) return (after as number) - 1;
  if (after === undefined) return before + 1;
  return (before + after) / 2;
};
