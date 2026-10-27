import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { Check, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { TASK_PRIORITIES } from '@/modules/tasks/lib/taskRules';
import type { TaskPriority } from '@/modules/tasks/types';
import { RzSelect } from '@/modules/workspace/components/RzSelect';
import { adminTaskService } from '../../services/adminTaskService';

interface AdminTaskDialogProps {
  companies: { id: string; name: string }[];
  /** Empresa do serviço (se tiver); senão começa na primeira da lista. */
  companyId: string | null;
  initial: { title: string; description: string; dueAt: string | null };
  onClose: () => void;
}

const LABEL = 'mb-1.5 block text-[13px] font-bold';
const FIELD =
  'h-11 w-full rounded-2xl bg-rz-canvas px-4 text-sm outline-none ring-1 ring-transparent focus:bg-white focus:ring-rz-primary/40';

/** Nova tarefa para quem está no admin sem ficha de colaborador: escolhe empresa e pessoas. */
export const AdminTaskDialog: React.FC<AdminTaskDialogProps> = ({
  companies,
  companyId,
  initial,
  onClose,
}) => {
  const [company, setCompany] = useState(companyId ?? companies[0]?.id ?? '');
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [dueAt, setDueAt] = useState(initial.dueAt);
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [assignee, setAssignee] = useState('');
  const [participants, setParticipants] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: people = [], isLoading } = useQuery({
    queryKey: ['admin', 'task-people', company],
    queryFn: async () => {
      const { data, error } = await adminTaskService.people(company);
      if (error) throw error;
      return data;
    },
    enabled: !!company,
  });

  // Outra empresa, outras pessoas.
  useEffect(() => {
    setAssignee('');
    setParticipants([]);
  }, [company]);

  const toggle = (userId: string) =>
    setParticipants(list =>
      list.includes(userId) ? list.filter(id => id !== userId) : [...list, userId]
    );

  const save = async () => {
    setSaving(true);
    const { error } = await adminTaskService.create({
      companyId: company,
      title: title.trim(),
      description,
      assigneeId: assignee,
      participantIds: participants,
      dueAt,
      priority,
    });
    setSaving(false);
    if (error) {
      toast({
        title: 'A tarefa não foi criada',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: 'Tarefa criada',
      description: 'O responsável e os participantes foram avisados.',
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[28px] sm:max-w-lg sm:rounded-[28px]">
        <DialogHeader className="text-left">
          <DialogTitle className="text-xl font-extrabold">Nova tarefa do serviço</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <input
            value={title}
            onChange={e => setTitle(e.target.value.slice(0, 200))}
            placeholder="O que é preciso fazer?"
            className={cn(FIELD, 'h-12 text-[15px] font-semibold')}
          />
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value.slice(0, 5000))}
            rows={4}
            placeholder="Descrição (opcional)"
            className={cn(FIELD, 'h-auto resize-none py-3')}
          />
          {companies.length > 1 && (
            <div>
              <span className={LABEL}>Empresa</span>
              <RzSelect
                value={company}
                onChange={setCompany}
                className={FIELD}
                ariaLabel="Empresa"
                options={companies.map(c => ({ value: c.id, label: c.name }))}
              />
            </div>
          )}
          <div>
            <span className={LABEL}>Responsável</span>
            <RzSelect
              value={assignee}
              onChange={id => {
                setAssignee(id);
                setParticipants(list => list.filter(p => p !== id));
              }}
              className={FIELD}
              ariaLabel="Responsável"
              placeholder={isLoading ? 'A carregar…' : 'Escolher'}
              options={people.map(p => ({ value: p.userId, label: p.name }))}
            />
          </div>
          <div>
            <span className={LABEL}>Participantes</span>
            <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
              {people
                .filter(p => p.userId !== assignee)
                .map(p => {
                  const on = participants.includes(p.userId);
                  return (
                    <button
                      key={p.userId}
                      type="button"
                      onClick={() => toggle(p.userId)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12.5px] font-semibold ring-1',
                        on
                          ? 'bg-rz-primary text-white ring-transparent'
                          : 'text-rz-muted ring-rz-line'
                      )}
                    >
                      {on && <Check className="h-3.5 w-3.5" />} {p.name}
                    </button>
                  );
                })}
            </div>
          </div>
          <label className="block">
            <span className={LABEL}>Prazo</span>
            <input
              type="datetime-local"
              value={dueAt ? format(new Date(dueAt), "yyyy-MM-dd'T'HH:mm") : ''}
              onChange={e =>
                setDueAt(e.target.value ? new Date(e.target.value).toISOString() : null)
              }
              className={FIELD}
            />
          </label>
          <div>
            <span className={LABEL}>Prioridade</span>
            <div className="flex gap-1.5">
              {(Object.keys(TASK_PRIORITIES) as TaskPriority[]).reverse().map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={cn(
                    'flex-1 rounded-full py-2 text-[12.5px] font-bold ring-1',
                    priority === p
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
          onClick={() => void save()}
          disabled={!title.trim() || !assignee || !company || saving}
          className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-rz-primary text-[15px] font-semibold text-white disabled:opacity-40"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Criar tarefa
        </button>
      </DialogContent>
    </Dialog>
  );
};
