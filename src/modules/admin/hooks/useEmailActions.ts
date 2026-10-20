import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { Credential } from '../lib/credentials';
import { credentialService } from '../services/credentialService';

const people = (count: number) => `${count} ${count === 1 ? 'pessoa' : 'pessoas'}`;

/** Ligar caixas ao Webmail (uma ou todas), mudar as pessoas e apagar, com avisos. */
export const useEmailActions = (refresh: () => Promise<unknown> | void) => {
  const { toast } = useToast();
  const [linking, setLinking] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState({ running: false, done: 0, total: 0 });

  const mark = (id: string, on: boolean) =>
    setLinking(current => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const link = async (credential: Credential) => {
    mark(credential.id, true);
    const { members, error } = await credentialService.linkMailbox(credential.id);
    mark(credential.id, false);
    toast(
      error
        ? { title: `${credential.username} não ligou`, description: error, variant: 'destructive' }
        : {
            title: `${credential.username} ligada`,
            description: `No Webmail de ${people(members ?? 0)}.`,
          }
    );
    void refresh();
  };

  const linkAll = async (credentials: Credential[]) => {
    setBulk({ running: true, done: 0, total: credentials.length });
    let failed = 0;
    for (const [index, credential] of credentials.entries()) {
      const { error } = await credentialService.linkMailbox(credential.id);
      if (error) failed += 1;
      setBulk({ running: true, done: index + 1, total: credentials.length });
    }
    setBulk({ running: false, done: 0, total: 0 });
    toast({
      title: `${credentials.length - failed} de ${credentials.length} caixas ligadas`,
      description: failed ? `${failed} com erro — veja o motivo na linha de cada uma.` : undefined,
      variant: failed ? 'destructive' : undefined,
    });
    void refresh();
  };

  const savePeople = async (credential: Credential, employeeIds: string[]) => {
    const { ok } = await credentialService.setShares(credential.id, employeeIds);
    if (!ok) {
      toast({ title: 'Erro ao guardar as pessoas', variant: 'destructive' });
      return;
    }
    if (employeeIds.length === 0) {
      toast({ title: 'Pessoas guardadas', description: 'Ninguém tem esta caixa no Webmail.' });
      void refresh();
      return;
    }
    await link(credential);
  };

  const remove = async (credential: Credential) => {
    const { ok } = await credentialService.remove(credential.id);
    toast(
      ok ? { title: 'Acesso eliminado' } : { title: 'Erro ao eliminar', variant: 'destructive' }
    );
    void refresh();
  };

  return { linking, bulk, link, linkAll, savePeople, remove };
};
