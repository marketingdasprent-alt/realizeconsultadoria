import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { SignaturesManager } from '@/modules/webmail/components/SignaturesManager';
import type { MailSignature } from '@/modules/webmail/types';
import { personAccessService } from '../services/personAccessService';

interface PersonSignaturesTabProps {
  userId: string;
}

/** Assinaturas de email de uma pessoa, caixa a caixa, geridas por um administrador. */
export const PersonSignaturesTab: React.FC<PersonSignaturesTabProps> = ({ userId }) => {
  const qc = useQueryClient();
  const key = ['person-signatures', userId] as const;
  const accounts = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await personAccessService.signatures(userId);
      if (error || !data) throw new Error(error ?? '');
      return data;
    },
    staleTime: 30_000,
  });
  const [accountId, setAccountId] = useState<string | null>(null);
  const [draft, setDraft] = useState<MailSignature[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const list = accounts.data ?? [];
  const current = list.find(account => account.id === accountId) ?? list[0] ?? null;

  // Ao mudar de caixa (ou ao chegarem os dados) o editor começa no que está gravado
  useEffect(() => {
    setDraft(current?.signatures ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao mudar de caixa
  }, [current?.id, accounts.dataUpdatedAt]);

  if (accounts.isLoading)
    return <Loader2 className="mx-auto my-6 h-6 w-6 animate-spin text-rz-primary" />;
  if (accounts.error)
    return (
      <p className="text-[13.5px] text-rose-600">
        {accounts.error.message || 'Não foi possível ler as assinaturas.'}
      </p>
    );
  if (!current)
    return (
      <p className="rounded-2xl bg-rz-canvas px-4 py-5 text-center text-[13.5px] text-rz-muted">
        Esta pessoa ainda não tem caixas de email no Webmail.
      </p>
    );

  const changed = JSON.stringify(draft) !== JSON.stringify(current.signatures);
  const save = async () => {
    setIsSaving(true);
    const { error } = await personAccessService.saveSignatures(userId, current.id, draft);
    setIsSaving(false);
    if (error) {
      toast({ title: 'Não foi possível guardar', description: error, variant: 'destructive' });
      return;
    }
    toast({ title: 'Assinaturas guardadas', description: current.email });
    void qc.invalidateQueries({ queryKey: key });
  };

  return (
    <div className="space-y-3">
      {list.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {list.map(account => (
            <button
              key={account.id}
              type="button"
              onClick={() => setAccountId(account.id)}
              title={account.email}
              className={cn(
                'max-w-[16rem] truncate rounded-full px-3 py-1.5 text-[12.5px] font-semibold ring-1',
                account.id === current.id
                  ? 'bg-rz-primary-soft text-rz-primary ring-rz-primary'
                  : 'bg-white text-rz-muted ring-rz-line hover:text-rz-ink'
              )}
            >
              {account.name || account.email}
            </button>
          ))}
        </div>
      )}
      <SignaturesManager key={current.id} value={draft} onChange={setDraft} />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          disabled={!changed || isSaving}
          onClick={() => setDraft(current.signatures)}
          className="h-10 rounded-full px-4 text-sm font-semibold text-rz-muted hover:bg-rz-canvas disabled:opacity-40"
        >
          Desfazer
        </button>
        <button
          type="button"
          disabled={!changed || isSaving}
          onClick={() => void save()}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-rz-primary px-5 text-sm font-bold text-white disabled:opacity-40"
        >
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar assinaturas
        </button>
      </div>
    </div>
  );
};
