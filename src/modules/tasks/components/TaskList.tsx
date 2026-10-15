import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sortTasks } from '../lib/taskRules';
import type { Task } from '../types';
import { AssigneeAvatar, PriorityChip, TaskMeta } from './TaskBits';

interface TaskListProps {
  tasks: Task[];
  onOpen: (task: Task) => void;
  onToggleDone: (task: Task) => void;
}

/** Vista em lista: por concluir primeiro, prazo mais próximo e prioridade. */
export const TaskList: React.FC<TaskListProps> = ({ tasks, onOpen, onToggleDone }) => {
  if (tasks.length === 0) {
    return (
      <p className="rounded-[26px] bg-white p-10 text-center text-rz-muted ring-1 ring-rz-line">
        Sem tarefas aqui.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {sortTasks(tasks).map(task => {
        const done = task.status === 'done';
        return (
          <li
            key={task.id}
            className="rz-rise flex items-center gap-3 rounded-[22px] bg-white p-3.5 shadow-rz-soft ring-1 ring-rz-line"
          >
            <button
              type="button"
              onClick={() => onToggleDone(task)}
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-2 transition-colors',
                done
                  ? 'bg-emerald-500 text-white ring-emerald-500'
                  : 'ring-rz-line hover:ring-emerald-400'
              )}
              aria-label={done ? 'Reabrir tarefa' : 'Concluir tarefa'}
            >
              {done && <Check className="h-4 w-4 stroke-[3]" />}
            </button>
            <button type="button" onClick={() => onOpen(task)} className="min-w-0 flex-1 text-left">
              <span
                className={cn(
                  'block truncate text-[15px] font-bold',
                  done && 'text-rz-muted line-through'
                )}
              >
                {task.title}
              </span>
              <TaskMeta task={task} />
            </button>
            <span className="hidden sm:block">
              <PriorityChip priority={task.priority} />
            </span>
            <AssigneeAvatar userId={task.assigneeId} size="sm" />
          </li>
        );
      })}
    </ul>
  );
};
