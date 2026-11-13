import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Search } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/modules/workspace/components/ConfirmDialog';
import { MailClientRow } from '../components/mailClients/MailClientRow';
import { MailClientSignaturesDialog } from '../components/mailClients/MailClientSignaturesDialog';
import { MailPostosPanel } from '../components/mailClients/MailPostosPanel';
import { mailClientsService, type MailClient } from '../services/mailClientsService';

const KEY = ['admin', 'mail-clients'] as const;

/**
 * Realize Mail (email.realizeconsultadoria.pt): os clientes que entraram na app de email (a
 * empresa de cada um, as assinaturas das caixas, os tickets, desligar/religar o acesso) e os
 * postos de email, que o admin cria com as caixas dos Acessos e envia por link.
 */
const MailClientsPage: React.FC = () => {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'postos' ? 'postos' : 'clientes';
  const [search, setSearch] = useState('');
  const [signing, setSigning] = useState<MailClient | null>(null);
  const [toggling, setToggling] = useState<MailClient | null>(null);
  const clients = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await mailClientsService.list();
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const companies = useQuery({
    queryKey: ['admin', 'companies', 'names'],
    queryFn: mailClientsService.companies,
  });
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (clients.data ?? []).filter(
      c =>
        !term ||
        [c.name, c.mailbox, c.companyName ?? '', ...c.accounts.map(a => a.email)].some(v =>
          v.toLowerCase().includes(term)
        )
    );
  }, [clients.data, search]);
  const refresh = () => qc.invalidateQueries({ queryKey: KEY });

  const setCompany = async (client: MailClient, companyId: string | null) => {
    const { error } = await mailClientsService.setCompany(client.userId, companyId);
    if (error)
      toast({ title: 'Não foi possível', description: error.message, variant: 'destructive' });
    await refresh();
  };

  const toggle = async () => {
    if (!toggling) return;
    const disable = !toggling.disabledAt;
    const { error } = await mailClientsService.setDisabled(toggling.userId, disable);
    setToggling(null);
    if (error)
      return toast({
        title: 'Não foi possível',
        description: error.message,
        variant: 'destructive',
      });
    toast({ title: disable ? 'Acesso desligado' : 'Acesso religado' });
    await refresh();
  };

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Realize Mail"
        description="Clientes e postos da app de email (email.realizeconsultadoria.pt)"
      />
      <nav className="flex gap-1" aria-label="Realize Mail">
        {(
          [
            ['clientes', 'Clientes'],
            ['postos', 'Postos'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setParams(key === 'postos' ? { tab: 'postos' } : {}, { replace: true })}
            aria-current={tab === key ? 'page' : undefined}
            className={cn(
              'h-9 rounded-full px-4 text-[13.5px] font-semibold transition-colors',
              tab === key
                ? 'bg-rz-ink text-white'
                : 'text-rz-muted hover:bg-white hover:text-rz-ink'
            )}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === 'postos' ? (
        <MailPostosPanel />
      ) : (
        <section className="overflow-hidden rounded-[28px] bg-white shadow-rz-soft ring-1 ring-rz-line">
          <div className="flex items-center gap-3 border-b border-rz-line px-4 py-3">
            <Search className="h-4 w-4 text-rz-muted" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Procurar por nome, caixa ou empresa"
              className="h-9 flex-1 bg-transparent text-sm outline-none"
            />
            <span className="text-[12.5px] text-rz-muted">{visible.length} clientes</span>
          </div>
          {clients.isLoading ? (
            <Loader2 className="mx-auto my-10 h-6 w-6 animate-spin text-rz-primary" />
          ) : visible.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-rz-muted">
              {search ? 'Nenhum cliente encontrado.' : 'Ainda ninguém entrou na Realize Mail.'}
            </p>
          ) : (
            visible.map(client => (
              <MailClientRow
                key={client.userId}
                client={client}
                companies={companies.data ?? []}
                onCompany={setCompany}
                onSignatures={setSigning}
                onToggle={setToggling}
              />
            ))
          )}
        </section>
      )}
      <MailClientSignaturesDialog client={signing} onClose={() => setSigning(null)} />
      <ConfirmDialog
        open={!!toggling}
        title={toggling?.disabledAt ? 'Religar o acesso?' : 'Desligar o acesso?'}
        description={
          toggling?.disabledAt
            ? `${toggling.name} volta a poder entrar na Realize Mail com a caixa.`
            : `${toggling?.name ?? ''} sai já da Realize Mail, não consegue voltar a entrar e as caixas deixam de ser lidas. Pode religar depois.`
        }
        confirmLabel={toggling?.disabledAt ? 'Religar' : 'Desligar'}
        onConfirm={() => void toggle()}
        onClose={() => setToggling(null)}
      />
    </div>
  );
};

export default MailClientsPage;
