import React from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { CalendarClock, Pencil, Repeat, Trash2 } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useDirectory } from '@/modules/social/hooks/useDirectory';
import { PeoplePicker } from '@/modules/social/components/PeoplePicker';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { useTaskDetail } from '../hooks/useTaskDetail';
import { isOverdue, RECURRENCE_LABELS, TASK_STATUSES } from '../lib/taskRules';
import type { Task } from '../types';
import { AssigneeAvatar, PriorityChip } from './TaskBits';
import {
  AttachmentsSection,
  ChecklistSection,
  CommentsSection,
  SubtasksSection,
} from './TaskSections';

interface TaskDetailSheetProps {
  task: Task | null;
  subtasks: Task[];
  onClose: () => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onStatus: (task: Task, status: Task['status']) => void;
  onParticipants: (task: Task, ids: string[]) => void;
  onAddSubtask: (parent: Task, title: string) => void;
  onOpen: (task: Task) => void;
}

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex min-h-9 items-center gap-3">
    <span className="w-28 shrink-0 text-[13px] text-rz-muted">{label}</span>
    <div className="min-w-0 flex-1 text-[14px] font-semibold">{children}</div>
  </div>
);

/** Detalhe de uma tarefa num painel lateral (briefing §15). */
export const TaskDetailSheet: React.FC<TaskDetailSheetProps> = props => {
  const { task, subtasks, onClose } = props;
  const { user } = useWorkspace();
  const { nameOf } = useDirectory();
  const detail = useTaskDetail(task?.id ?? null);

  return (
    <Sheet open={!!task} onOpenChange={open => !open && onClose()}>
      <SheetContent
        side="right"
        className="rz-scroll w-full overflow-y-auto border-0 bg-white p-0 sm:max-w-xl"
      >
        {task && (
          <div className="space-y-6 p-6">
            <div className="flex flex-wrap gap-1.5 pr-8">
              {TASK_STATUSES.map(s => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => props.onStatus(task, s.key)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-bold ring-1',
                    task.status === s.key
                      ? 'bg-rz-ink text-white ring-rz-ink'
                      : 'text-rz-muted ring-rz-line'
                  )}
                >
                  <span className={cn('h-2 w-2 rounded-full', s.dot)} /> {s.label}
                </button>
              ))}
            </div>
            <div>
              <SheetTitle
                className={cn(
                  'text-[22px] font-extrabold leading-tight',
                  task.status === 'done' && 'text-rz-muted line-through'
                )}
              >
                {task.title}
              </SheetTitle>
              {task.description && (
                <p className="mt-2 whitespace-pre-wrap text-[14.5px] text-rz-ink/85">
                  {task.description}
                </p>
              )}
            </div>
            <div className="space-y-1 rounded-[22px] bg-rz-canvas/60 p-4">
              <Row label="Responsável">
                <span className="inline-flex items-center gap-2">
                  <AssigneeAvatar userId={task.assigneeId} />{' '}
                  {task.assigneeId && nameOf(task.assigneeId)}
                </span>
              </Row>
              <Row label="Participantes">
                <PeoplePicker
                  includeMe
                  value={task.participantIds}
                  onChange={ids => props.onParticipants(task, ids)}
                  placeholder="Adicionar"
                />
              </Row>
              <Row label="Prazo">
                {task.dueAt ? (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5',
                      isOverdue(task) && 'text-rose-600'
                    )}
                  >
                    <CalendarClock className="h-4 w-4" />{' '}
                    {format(new Date(task.dueAt), "d 'de' MMMM, HH:mm", { locale: pt })}
                  </span>
                ) : (
                  <span className="font-normal text-rz-muted">Sem prazo</span>
                )}
              </Row>
              <Row label="Prioridade">
                <PriorityChip priority={task.priority} />
              </Row>
              {task.recurrence && (
                <Row label="Repete">
                  <span className="inline-flex items-center gap-1.5">
                    <Repeat className="h-4 w-4" /> {RECURRENCE_LABELS[task.recurrence]}
                  </span>
                </Row>
              )}
              <Row label="Criada por">{nameOf(task.createdBy)}</Row>
            </div>
            {!task.parentId && (
              <SubtasksSection
                subtasks={subtasks}
                onToggle={t => props.onStatus(t, t.status === 'done' ? 'todo' : 'done')}
                onAdd={title => props.onAddSubtask(task, title)}
                onOpen={props.onOpen}
              />
            )}
            <ChecklistSection detail={detail} />
            <AttachmentsSection detail={detail} />
            <CommentsSection detail={detail} />
            <div className="flex gap-2 border-t border-rz-line pt-4">
              <button
                type="button"
                onClick={() => props.onEdit(task)}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-rz-canvas px-4 text-sm font-semibold"
              >
                <Pencil className="h-4 w-4" /> Editar
              </button>
              {task.createdBy === user.userId && (
                <button
                  type="button"
                  onClick={() => props.onDelete(task)}
                  className="ml-auto inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 className="h-4 w-4" /> Eliminar
                </button>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
