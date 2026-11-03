import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, FileText, Folder, Loader2, Trash2, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { companyFilesService } from '@/modules/documents/services/companyFilesService';

const KEY = ['ai', 'delete-requests'];

/**
 * Pedidos para eliminar nos Documentos da empresa, à espera de um admin. O Realize AI avisa
 * (notificação) e aqui aprova-se (vai para o lixo do servidor) ou recusa-se. Só aparece a admins:
 * aos outros a função devolve erro e não se mostra nada.
 */
export const AiDeleteRequests: React.FC = () => {
  const { isPreview } = useWorkspace();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const requests = useQuery({
    queryKey: KEY,
    enabled: !isPreview,
    staleTime: 30_000,
    queryFn: async () => (await companyFilesService.deleteRequests()).data ?? [],
  });

  const decide = async (id: string, approve: boolean) => {
    setBusy(id);
    const { error } = await companyFilesService.decideDelete(id, approve);
    setBusy(null);
    if (error) {
      toast({ title: 'Não foi possível', description: error, variant: 'destructive' });
      return;
    }
    toast({ title: approve ? 'Eliminado (está no lixo do servidor 30 dias)' : 'Pedido recusado' });
    await qc.invalidateQueries({ queryKey: KEY });
    await qc.invalidateQueries({ queryKey: ['company-files'] });
  };

  const list = requests.data ?? [];
  if (!list.length) return null;
  return (
    <ul className="mb-3 space-y-2">
      {list.map(request => {
        const Icon = request.entry_type === 'dir' ? Folder : FileText;
        return (
          <li key={request.id} className="rounded-2xl bg-white p-3 ring-1 ring-rz-line">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-orange-400 text-white">
                <Trash2 className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-rz-muted">
                  Pedido para eliminar
                </p>
                <p className="text-[14px]">
                  <strong>{request.requester_name ?? 'Um colaborador'}</strong> quer eliminar{' '}
                  {request.entry_type === 'dir' ? 'a pasta' : 'o ficheiro'}:
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 break-all text-[13px] text-rz-muted">
                  <Icon className="h-3.5 w-3.5 shrink-0" /> {request.path}
                </p>
              </div>
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy === request.id}
                onClick={() => void decide(request.id, false)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold text-rz-muted ring-1 ring-rz-line hover:text-rz-ink disabled:opacity-40"
              >
                <X className="h-4 w-4" /> Recusar
              </button>
              <button
                type="button"
                disabled={busy === request.id}
                onClick={() => void decide(request.id, true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-rose-600 px-4 text-[13px] font-bold text-white disabled:opacity-40"
              >
                {busy === request.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Aprovar
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
};
