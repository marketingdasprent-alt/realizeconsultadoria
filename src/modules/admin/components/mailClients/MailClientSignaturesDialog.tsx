import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { SignaturesManager } from '@/modules/webmail/components/SignaturesManager';
import type { MailSignature } from '@/modules/webmail/types';
import { mailClientsService, type MailClient } from '../../services/mailClientsService';

interface MailClientSignaturesDialogProps {
  client: MailClient | null;
  onClose: () => void;
}

/**
 * Assinaturas das caixas de um cliente da Realize Mail, com o mesmo editor do Webmail. O cliente
 * vê-as logo na app e pode alterá-las depois.
 */
export const MailClientSignaturesDialog: React.FC<MailClientSignaturesDialogProps> = ({
  client,
  onClose,
}) => {
  const [accountId, setAccountId] = useState('');
  const [list, setList] = useState<MailSignature[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => setAccountId(client?.accounts[0]?.id ?? ''), [client]);
  useEffect(() => {
    if (!accountId) return setList([]);
    let cancelled = false;
    setIsLoading(true);
    void mailClientsService.signatures(accountId).then(({ data }) => {
      if (cancelled) return;
      setList(data);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  const save = async () => {
    setIsSaving(true);
    const { error } = await mailClientsService.saveSignatures(accountId, list);
    setIsSaving(false);
    if (error)
      return toast({
        title: 'As assinaturas não foram gravadas',
        description: error.message,
        variant: 'destructive',
      });
    toast({ title: 'Assinaturas gravadas', description: 'O cliente já as vê na Realize Mail.' });
    onClose();
  };

  return (
    <Dialog open={!!client} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-h-[94vh] overflow-y-auto rounded-[28px] sm:max-w-3xl">
        <DialogTitle className="text-xl font-extrabold">Assinaturas — {client?.name}</DialogTitle>
        <DialogDescription className="text-[13px]">
          Ficam já na app do cliente, que as pode alterar depois.
        </DialogDescription>
        {client && client.accounts.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {client.accounts.map(account => (
              <button
                key={account.id}
                type="button"
                onClick={() => setAccountId(account.id)}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-[13px] font-semibold',
                  account.id === accountId ? 'bg-rz-ink text-white' : 'bg-rz-canvas text-rz-muted'
                )}
              >
                {account.email}
              </button>
            ))}
          </div>
        )}
        {isLoading ? (
          <Loader2 className="mx-auto my-10 h-6 w-6 animate-spin text-rz-primary" />
        ) : (
          <SignaturesManager value={list} onChange={setList} />
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-full px-4 text-sm font-semibold text-rz-muted hover:bg-rz-canvas"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={save}
            disabled={isSaving || isLoading || !accountId}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-rz-primary px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />} Gravar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
