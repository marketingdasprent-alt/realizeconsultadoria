// Detalhe de uma tarefa: lista de verificação, comentários e anexos (com tempo real).
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { DEMO_CHECKLIST, DEMO_TASK_COMMENTS } from '../lib/demoData';
import { taskService } from '../services/taskService';
import type { ChecklistItem, TaskAttachment, TaskComment } from '../types';

interface DetailData {
  checklist: ChecklistItem[];
  comments: TaskComment[];
  attachments: TaskAttachment[];
}

const EMPTY: DetailData = { checklist: [], comments: [], attachments: [] };

export const useTaskDetail = (taskId: string | null) => {
  const { isPreview, user } = useWorkspace();
  const qc = useQueryClient();
  const key = ['tasks', 'detail', taskId] as const;
  const [demo, setDemo] = useState<DetailData>(EMPTY);

  useEffect(() => {
    if (isPreview && taskId) {
      setDemo({
        checklist: DEMO_CHECKLIST[taskId] ?? [],
        comments: DEMO_TASK_COMMENTS[taskId] ?? [],
        attachments: [],
      });
    }
  }, [isPreview, taskId]);

  const live = useQuery({
    queryKey: key,
    queryFn: async (): Promise<DetailData> => {
      const { data, error } = await taskService.detail(taskId as string);
      if (error || !data) throw error;
      return {
        checklist: data.checklist.map(c => ({
          id: c.id,
          text: c.text,
          done: c.done,
          position: c.position,
        })),
        comments: data.comments.map(c => ({
          id: c.id,
          authorId: c.author_id,
          body: c.body,
          createdAt: c.created_at,
        })),
        attachments: data.attachments.map(a => ({
          id: a.id,
          path: a.path,
          name: a.name,
          size: a.size,
          mime: a.mime,
          uploadedBy: a.uploaded_by,
        })),
      };
    },
    enabled: !isPreview && !!taskId,
  });

  useEffect(() => {
    if (isPreview || !taskId) return;
    const refresh = () => qc.invalidateQueries({ queryKey: ['tasks', 'detail', taskId] });
    const filter = `task_id=eq.${taskId}`;
    const channel = supabase
      .channel(`task-${taskId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_comments', filter },
        refresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_checklist_items', filter },
        refresh
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isPreview, taskId, qc]);

  const data = isPreview ? demo : (live.data ?? EMPTY);
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const run = async (action: () => Promise<{ error: unknown }>, message: string) => {
    const { error } = await action();
    if (error) toast({ title: 'Não foi possível', description: message, variant: 'destructive' });
    else await refresh();
  };

  return {
    ...data,
    isLoading: !isPreview && live.isLoading,
    addChecklistItem: (text: string) =>
      isPreview
        ? setDemo(d => ({
            ...d,
            checklist: [
              ...d.checklist,
              { id: `d${Date.now()}`, text, done: false, position: d.checklist.length },
            ],
          }))
        : run(
            () => taskService.addChecklistItem(taskId as string, text, data.checklist.length),
            'O item não foi guardado.'
          ),
    toggleChecklistItem: (item: ChecklistItem) =>
      isPreview
        ? setDemo(d => ({
            ...d,
            checklist: d.checklist.map(c => (c.id === item.id ? { ...c, done: !c.done } : c)),
          }))
        : run(
            () => taskService.toggleChecklistItem(item.id, !item.done),
            'O item não foi atualizado.'
          ),
    removeChecklistItem: (id: string) =>
      isPreview
        ? setDemo(d => ({ ...d, checklist: d.checklist.filter(c => c.id !== id) }))
        : run(() => taskService.removeChecklistItem(id), 'O item não foi retirado.'),
    addComment: (body: string) =>
      isPreview
        ? setDemo(d => ({
            ...d,
            comments: [
              ...d.comments,
              {
                id: `d${Date.now()}`,
                authorId: user.userId,
                body,
                createdAt: new Date().toISOString(),
              },
            ],
          }))
        : run(
            () => taskService.addComment(taskId as string, user.userId, body),
            'O comentário não foi publicado.'
          ),
    upload: (file: File) =>
      isPreview
        ? toast({ title: 'Pré-visualização', description: 'Anexar usa dados reais.' })
        : run(
            () => taskService.uploadAttachment(taskId as string, user.userId, file),
            'O ficheiro não foi anexado.'
          ),
  };
};
