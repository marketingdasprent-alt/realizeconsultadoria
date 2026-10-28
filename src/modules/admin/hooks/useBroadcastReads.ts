import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import type { BroadcastEmployee } from '../lib/broadcast';
import { confirmationsOf } from '../lib/broadcastReads';
import { broadcastService, type BroadcastHistoryRow } from '../services/broadcastService';

/** Comunicados → Enviados → um envio: quem confirmou a leitura na app e lembrar quem falta. */
export const useBroadcastReads = (row: BroadcastHistoryRow | null, people: BroadcastEmployee[]) => {
  const { toast } = useToast();
  const [reminding, setReminding] = useState(false);

  const query = useQuery({
    queryKey: ['admin', 'broadcast-reads', row?.id],
    queryFn: () => broadcastService.reads(row!),
    enabled: !!row?.published_in_app,
    refetchInterval: 60_000,
  });

  const confirmations = useMemo(
    () => confirmationsOf(query.data?.notices ?? [], query.data?.reads ?? [], people),
    [query.data, people]
  );

  const remind = async () => {
    const pending = confirmations.pending;
    if (!pending.length) return;
    setReminding(true);
    const noticeIds = [...new Set(pending.map(p => confirmations.noticeOf.get(p.id)!))];
    const sent = await broadcastService.remind(
      noticeIds,
      pending.map(p => p.id)
    );
    setReminding(false);
    toast(
      sent === null
        ? { title: 'Não foi possível lembrar', variant: 'destructive' }
        : sent > 0
          ? { title: `Lembrete enviado para ${sent} ${sent === 1 ? 'telemóvel' : 'telemóveis'}` }
          : {
              title: 'Ninguém tem as notificações ligadas',
              description: 'Quem falta ainda não ativou as notificações da app no telemóvel.',
            }
    );
  };

  return {
    isLoading: query.isLoading,
    isError: query.isError,
    confirmations,
    reactions: query.data?.reactions ?? [],
    reach: confirmations.confirmed.length + confirmations.pending.length,
    reminding,
    remind,
  };
};
