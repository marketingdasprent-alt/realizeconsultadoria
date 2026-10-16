import React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ChevronRight, Sunrise } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { getDigestEnabled, getSuggestions, setDigestEnabled } from '../services/aiService';

const DEMO = [
  {
    kind: 'late',
    text: 'Tem 2 tarefas em atraso. (exemplo)',
    link: '/colaborador/tarefas',
  },
];

/** Sugestões do dia (conflitos, atrasos, convites) e o interruptor do resumo diário. */
export const AiProactive: React.FC = () => {
  const { user, isPreview, basePath } = useWorkspace();
  const qc = useQueryClient();

  const suggestions = useQuery({
    queryKey: ['ai', 'suggestions', user.userId],
    queryFn: getSuggestions,
    enabled: !isPreview,
    staleTime: 60_000,
  });
  const digest = useQuery({
    queryKey: ['ai', 'digest', user.userId],
    queryFn: () => getDigestEnabled(user.userId),
    enabled: !isPreview,
  });
  const toggle = useMutation({
    mutationFn: (enabled: boolean) => setDigestEnabled(user.userId, enabled),
    onMutate: async enabled => {
      qc.setQueryData(['ai', 'digest', user.userId], enabled);
    },
    onError: () => qc.invalidateQueries({ queryKey: ['ai', 'digest', user.userId] }),
  });

  const list = isPreview ? DEMO : (suggestions.data ?? []);
  return (
    <div className="mb-3 space-y-2">
      {list.length > 0 && (
        <ul className="space-y-1.5">
          {list.map(item => (
            <li key={item.text}>
              <Link
                to={`${basePath}${item.link.replace('/colaborador', '')}`}
                className="flex items-center gap-2.5 rounded-2xl bg-amber-50 px-4 py-2.5 text-[13.5px] font-medium text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100"
              >
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.text}</span>
                <ChevronRight className="h-4 w-4 shrink-0 opacity-60" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-white px-4 py-2.5 ring-1 ring-rz-line">
        <Sunrise className="h-4 w-4 shrink-0 text-amber-500" />
        <span className="flex-1">
          <span className="block text-[13.5px] font-semibold">Resumo diário às 08:30</span>
          <span className="block text-[12px] text-rz-muted">
            Receba uma notificação com os eventos e tarefas do dia, nos dias úteis.
          </span>
        </span>
        <Switch
          checked={isPreview ? true : (digest.data ?? false)}
          disabled={isPreview || digest.isLoading || toggle.isPending}
          onCheckedChange={enabled => toggle.mutate(enabled)}
          aria-label="Resumo diário"
        />
      </label>
    </div>
  );
};
