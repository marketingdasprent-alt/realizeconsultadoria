import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { useDirectory } from '@/modules/social/hooks/useDirectory';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { backfillContacts } from '../lib/contactBackfill';
import type { ContactEntry, ContactList } from '../lib/recipients';
import { contactService } from '../services/contactService';
import type { MailAccount } from '../types';

const CONTACTS_KEY = ['mail', 'contacts'] as const;
const LISTS_KEY = ['mail', 'contact-lists'] as const;

/**
 * Contactos para as sugestões e listas de contactos da pessoa. Na primeira vez aprende com os
 * emails que já enviou (pasta Enviados das suas caixas).
 */
export const useContacts = (accounts: MailAccount[] = []) => {
  const { isPreview } = useWorkspace();
  const { colleagues } = useDirectory();
  const qc = useQueryClient();
  // Colegas da empresa com email (sugeridos tal como quem já se escreveu).
  const team = useMemo<ContactEntry[]>(
    () =>
      colleagues
        .filter(person => person.email)
        .map(person => ({ email: person.email as string, name: person.name })),
    [colleagues]
  );
  const contacts = useQuery({
    queryKey: CONTACTS_KEY,
    queryFn: async () => {
      const { data, error } = await contactService.listContacts();
      if (error) throw error;
      return data;
    },
    enabled: !isPreview,
    staleTime: 60_000,
  });
  const lists = useQuery({
    queryKey: LISTS_KEY,
    queryFn: async () => {
      const { data, error } = await contactService.listLists();
      if (error) throw error;
      return data;
    },
    enabled: !isPreview,
    staleTime: 60_000,
  });

  // Uma vez por pessoa e aparelho, quando ainda não há contactos: aprende com os Enviados.
  const ready = contacts.isSuccess && !contacts.data.length;
  const accountIds = accounts.map(account => account.id).join(',');
  useEffect(() => {
    if (isPreview || !ready || !accountIds) return;
    void backfillContacts(accountIds.split(',')).then(done => {
      if (done) void qc.invalidateQueries({ queryKey: CONTACTS_KEY });
    });
  }, [isPreview, ready, accountIds, qc]);

  const refresh = () => qc.invalidateQueries({ queryKey: LISTS_KEY });

  return {
    team,
    contacts: (contacts.data ?? []) as ContactEntry[],
    lists: (lists.data ?? []) as ContactList[],
    isLoading: !isPreview && lists.isLoading,

    /** Devolve o id da lista gravada (null se falhou). */
    saveList: async (list: {
      id?: string;
      name: string;
      members: ContactEntry[];
    }): Promise<string | null> => {
      const { id, error } = await contactService.saveList(list);
      if (error) {
        const duplicate = String((error as { code?: string }).code) === '23505';
        toast({
          title: duplicate ? 'Já existe uma lista com esse nome' : 'A lista não foi guardada',
          variant: 'destructive',
        });
        return null;
      }
      await refresh();
      toast({ title: list.id ? 'Lista guardada' : `Lista «${list.name.trim()}» criada` });
      return id;
    },

    deleteList: async (id: string) => {
      const { error } = await contactService.deleteList(id);
      if (error) {
        toast({ title: 'A lista não foi eliminada', variant: 'destructive' });
        return false;
      }
      await refresh();
      return true;
    },

    /** Depois de enviar: quem recebeu passa a ser sugerido. */
    remember: async (emails: string[]) => {
      if (isPreview) return;
      await contactService.remember(emails.map(email => ({ email })));
      void qc.invalidateQueries({ queryKey: CONTACTS_KEY });
    },
  };
};
