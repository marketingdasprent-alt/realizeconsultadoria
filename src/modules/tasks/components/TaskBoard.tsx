import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { groupByStatus, positionBetween, TASK_STATUSES } from '../lib/taskRules';
import type { Task, TaskStatus } from '../types';
import { AssigneeAvatar, PriorityChip, StatusDot, TaskMeta } from './TaskBits';

interface TaskBoardProps {
  tasks: Task[];
  onOpen: (task: Task) => void;
  onMove: (task: Task, status: TaskStatus, position: number) => void;
}

/** Quadro Kanban: arrastar um cartão para outra coluna muda o estado. */
export const TaskBoard: React.FC<TaskBoardProps> = ({ tasks, onOpen, onMove }) => {
  const groups = groupByStatus(tasks);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<TaskStatus | null>(null);

  const drop = (status: TaskStatus) => {
    const task = tasks.find(t => t.id === dragging);
    setDragging(null);
    setOver(null);
    if (!task) return;
    const column = groups[status].filter(t => t.id !== task.id);
    onMove(task, status, positionBetween(column[column.length - 1]?.position, undefined));
  };

  return (
    <div className="scrollbar-hide -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:px-0">
      {TASK_STATUSES.map(column => (
        <section
          key={column.key}
          onDragOver={event => {
            event.preventDefault();
            setOver(column.key);
          }}
          onDragLeave={() => setOver(current => (current === column.key ? null : current))}
          onDrop={() => drop(column.key)}
          className={cn(
            'flex w-[78vw] shrink-0 flex-col rounded-[26px] bg-gradient-to-b to-white p-3 ring-1 ring-rz-line transition-shadow sm:w-72 md:w-auto',
            column.column,
            over === column.key && 'ring-2 ring-rz-primary/50'
          )}
        >
          <h3 className="mb-2 flex items-center gap-2 px-1 text-[13.5px] font-bold">
            <StatusDot status={column.key} /> {column.label}
            <span className="ml-auto rounded-full bg-white px-2 text-[12px] text-rz-muted">
              {groups[column.key].length}
            </span>
          </h3>
          <div className="min-h-[120px] space-y-2">
            {groups[column.key].map(task => (
              <button
                key={task.id}
                type="button"
                draggable
                onDragStart={() => setDragging(task.id)}
                onDragEnd={() => setDragging(null)}
                onClick={() => onOpen(task)}
                className={cn(
                  'w-full cursor-grab rounded-2xl bg-white p-3 text-left shadow-rz-soft ring-1 ring-rz-line transition-transform hover:-translate-y-0.5 active:cursor-grabbing',
                  dragging === task.id && 'opacity-50'
                )}
              >
                <p
                  className={cn(
                    'text-[14px] font-bold',
                    task.status === 'done' && 'text-rz-muted line-through'
                  )}
                >
                  {task.title}
                </p>
                <div className="mt-2">
                  <TaskMeta task={task} />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <PriorityChip priority={task.priority} />
                  <AssigneeAvatar userId={task.assigneeId} />
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};
