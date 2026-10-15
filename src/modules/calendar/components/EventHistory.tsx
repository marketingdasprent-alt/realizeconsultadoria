import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { ChevronDown, History, Loader2 } from 'lucide-react';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { calendarService } from '../services/calendarService';

const RESPONSE: Record<string, string> = {
  pending: 'por responder',
  accepted: 'vai',
  declined: 'não vai',
  tentative: 'talvez',
};

/**
 * Histórico de convites e respostas (só o organizador e os admins o leem). Útil quando
 * alguém diz que respondeu e não aparece, ou muda de ideias várias vezes.
 */
export const EventHistory: React.FC<{ eventId: string; nameOf: (id: string) => string }> = ({
  eventId,
  nameOf,
}) => {
  const { isPreview } = useWorkspace();
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ['calendar', 'history', eventId],
    queryFn: async () => {
      const { data, error } = await calendarService.history(eventId);
      if (error) throw error;
      return data;
    },
    enabled: open && !isPreview,
  });

  return (
    <div className="border-t border-rz-line pt-3">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-2 text-[13px] font-bold text-rz-muted hover:text-rz-ink"
      >
        <History className="h-4 w-4" /> Histórico de respostas
        <ChevronDown
          className={`ml-auto h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <ul className="mt-2 space-y-1.5 text-[12.5px]">
          {query.isLoading && <Loader2 className="mx-auto h-4 w-4 animate-spin text-rz-primary" />}
          {isPreview && <li className="text-rz-muted">Disponível com dados reais.</li>}
          {query.data?.length === 0 && <li className="text-rz-muted">Sem alterações.</li>}
          {query.data?.map(row => (
            <li key={row.id} className="flex gap-2">
              <span className="w-[92px] shrink-0 text-rz-muted">
                {format(new Date(row.changed_at), 'd MMM, HH:mm', { locale: pt })}
              </span>
              <span>
                <b>{nameOf(row.user_id)}</b>{' '}
                {row.action === 'convidado'
                  ? 'foi convidado'
                  : row.action === 'retirado'
                    ? 'foi retirado do evento'
                    : `mudou de «${RESPONSE[row.old_response ?? ''] ?? '—'}» para «${
                        RESPONSE[row.new_response ?? ''] ?? '—'
                      }»`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
