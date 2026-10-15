import React from 'react';
import { format, isToday, isTomorrow } from 'date-fns';
import { pt } from 'date-fns/locale';
import { CalendarClock, MessageSquare, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDirectory } from '@/modules/social/hooks/useDirectory';
import { UserAvatar } from '@/modules/workspace/components/UserAvatar';
import { isOverdue, TASK_PRIORITIES, TASK_STATUSES } from '../lib/taskRules';
import type { Task } from '../types';

export const PriorityChip: React.FC<{ priority: Task['priority'] }> = ({ priority }) => (
  <span
    className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', TASK_PRIORITIES[priority].chip)}
  >
    {TASK_PRIORITIES[priority].label}
  </span>
);

export const StatusDot: React.FC<{ status: Task['status'] }> = ({ status }) => (
  <span
    className={cn(
      'h-2.5 w-2.5 shrink-0 rounded-full',
      TASK_STATUSES.find(s => s.key === status)?.dot
    )}
  />
);

const dueText = (iso: string) => {
  const date = new Date(iso);
  if (isToday(date)) return `Hoje, ${format(date, 'HH:mm')}`;
  if (isTomorrow(date)) return `Amanhã, ${format(date, 'HH:mm')}`;
  return format(date, 'd MMM, HH:mm', { locale: pt });
};

/** Prazo (vermelho se ultrapassado), recorrência e origem da tarefa. */
export const TaskMeta: React.FC<{ task: Task }> = ({ task }) => (
  <span className="flex flex-wrap items-center gap-2 text-[12px] font-semibold text-rz-muted">
    {task.dueAt && (
      <span className={cn('inline-flex items-center gap-1', isOverdue(task) && 'text-rose-600')}>
        <CalendarClock className="h-3.5 w-3.5" /> {dueText(task.dueAt)}
      </span>
    )}
    {task.recurrence && <Repeat className="h-3.5 w-3.5" aria-label="Recorrente" />}
    {task.sourceType === 'message' && (
      <MessageSquare className="h-3.5 w-3.5" aria-label="Criada a partir de uma mensagem" />
    )}
    {task.subtaskCount > 0 && (
      <span>
        {task.subtaskDone}/{task.subtaskCount} subtarefas
      </span>
    )}
  </span>
);

/** Responsável (avatar com o nome no título). */
export const AssigneeAvatar: React.FC<{ userId: string | null; size?: 'xs' | 'sm' }> = ({
  userId,
  size = 'xs',
}) => {
  const { nameOf } = useDirectory();
  if (!userId) return <span className="text-[12px] text-rz-muted">Sem responsável</span>;
  const name = nameOf(userId);
  return (
    <span title={name}>
      <UserAvatar name={name} userId={userId} size={size} />
    </span>
  );
};
