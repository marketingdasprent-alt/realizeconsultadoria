import React, { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { PeoplePicker } from '@/modules/social/components/PeoplePicker';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { RECURRENCE_LABELS, TASK_PRIORITIES } from '../lib/taskRules';
import type { Task, TaskInput, TaskPriority, TaskRecurrence } from '../types';

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Editar uma tarefa, ou valores iniciais de uma nova (ex.: a partir de uma mensagem). */
  task?: Task | null;
  initial?: Partial<TaskInput>;
  title?: string;
  onSave: (input: TaskInput) => Promise<unknown>;
}

const LABEL = 'mb-1.5 block text-[13px] font-bold';
const FIELD =
  'h-11 w-full rounded-2xl bg-rz-canvas px-4 text-sm outline-none ring-1 ring-transparent focus:bg-white focus:ring-rz-primary/40';

/** Criar ou editar uma tarefa. */
export const TaskFormDialog: React.FC<TaskFormDialogProps> = ({
  open,
  onOpenChange,
  task,
  initial,
  title,
  onSave,
}) => {
  const { user } = useWorkspace();
  const [form, setForm] = useState<TaskInput>({
    title: '',
    description: '',
    assigneeId: user.userId,
    participantIds: [],
    dueAt: null,
    priority: 'medium',
    recurrence: null,
  });
  const [isSaving, setIsSaving] = useState(false);
  // Valores iniciais lidos só ao abrir (quem chama pode criar um objeto novo a cada render).
  const initialRef = useRef(initial);
  initialRef.current = initial;

  useEffect(() => {
    if (!open) return;
    const initial = initialRef.current;
    setForm({
      title: task?.title ?? initial?.title ?? '',
      description: task?.description ?? initial?.description ?? '',
      assigneeId: task ? task.assigneeId : (initial?.assigneeId ?? user.userId),
      participantIds: task?.participantIds ?? initial?.participantIds ?? [],
      dueAt: task?.dueAt ?? initial?.dueAt ?? null,
      priority: task?.priority ?? initial?.priority ?? 'medium',
      recurrence: task?.recurrence ?? initial?.recurrence ?? null,
      parentId: initial?.parentId ?? null,
      sourceType: initial?.sourceType ?? null,
      sourceRef: initial?.sourceRef ?? null,
    });
  }, [open, task, user.userId]);

  const set = <K extends keyof TaskInput>(key: K, value: TaskInput[K]) =>
    setForm(f => ({ ...f, [key]: value }));

  const save = async () => {
    if (!form.title.trim()) return;
    setIsSaving(true);
    await onSave(form);
    setIsSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[28px] sm:max-w-lg sm:rounded-[28px]">
        <DialogHeader className="text-left">
          <DialogTitle className="text-xl font-extrabold">
            {title ?? (task ? 'Editar tarefa' : 'Nova tarefa')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <input
            autoFocus
            value={form.title}
            onChange={e => set('title', e.target.value.slice(0, 200))}
            placeholder="O que é preciso fazer?"
            className={cn(FIELD, 'h-12 text-[15px] font-semibold')}
          />
          <textarea
            value={form.description}
            onChange={e => set('description', e.target.value.slice(0, 5000))}
            rows={3}
            placeholder="Descrição (opcional)"
            className={cn(FIELD, 'h-auto resize-none py-3')}
          />
          <div>
            <span className={LABEL}>Responsável</span>
            <PeoplePicker
              single
              includeMe
              value={form.assigneeId ? [form.assigneeId] : []}
              onChange={ids => set('assigneeId', ids[0] ?? null)}
              placeholder="Escolher"
            />
          </div>
          <div>
            <span className={LABEL}>Participantes</span>
            <PeoplePicker
              includeMe
              value={form.participantIds}
              onChange={ids => set('participantIds', ids)}
              placeholder="Adicionar"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className={LABEL}>Prazo</span>
              <input
                type="datetime-local"
                value={form.dueAt ? format(new Date(form.dueAt), "yyyy-MM-dd'T'HH:mm") : ''}
                onChange={e =>
                  set('dueAt', e.target.value ? new Date(e.target.value).toISOString() : null)
                }
                className={FIELD}
              />
            </label>
            <label>
              <span className={LABEL}>Repetir</span>
              <select
                value={form.recurrence ?? ''}
                onChange={e => set('recurrence', (e.target.value || null) as TaskRecurrence | null)}
                className={FIELD}
              >
                <option value="">Não repete</option>
                {Object.entries(RECURRENCE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <span className={LABEL}>Prioridade</span>
            <div className="flex gap-1.5">
              {(Object.keys(TASK_PRIORITIES) as TaskPriority[]).reverse().map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => set('priority', p)}
                  className={cn(
                    'flex-1 rounded-full py-2 text-[12.5px] font-bold ring-1',
                    form.priority === p
                      ? `${TASK_PRIORITIES[p].chip} ring-transparent`
                      : 'text-rz-muted ring-rz-line'
                  )}
                >
                  {TASK_PRIORITIES[p].label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={!form.title.trim() || isSaving}
          className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-rz-primary text-[15px] font-semibold text-white disabled:opacity-40"
        >
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}{' '}
          {task ? 'Guardar' : 'Criar tarefa'}
        </button>
      </DialogContent>
    </Dialog>
  );
};
