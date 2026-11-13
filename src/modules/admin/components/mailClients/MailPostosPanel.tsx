import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { ConfirmDialog } from '@/modules/workspace/components/ConfirmDialog';
import { mailClientsService } from '../../services/mailClientsService';
import {
  mailPostosService,
  type MailPosto,
  type PostoProblem,
} from '../../services/mailPostosService';
import { MailPostoDialog } from './MailPostoDialog';
import { MailPostoInviteDialog } from './MailPostoInviteDialog';
import { MailPostoRow } from './MailPostoRow';

const KEY = ['admin', 'mail-postos'] as const;

const problemsText = (problems: PostoProblem[]) =>
  problems.map(problem => `${problem.email}: ${problem.message}`).join(' ');

/**
 * Postos de email: o admin cria o posto, escolhe as caixas dos Acessos e envia o link a quem vai
 * instalar a Realize Mail. Também muda as caixas, desliga e apaga.
 */
export const MailPostosPanel: React.FC = () => {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<{ posto: MailPosto | null } | null>(null);
  const [invite, setInvite] = useState<{
    postoName: string;
    link: string;
    expiresAt: string;
  } | null>(null);
  const [toggling, setToggling] = useState<MailPosto | null>(null);
  const [deleting, setDeleting] = useState<MailPosto | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const postos = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await mailPostosService.list();
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const accesses = useQuery({
    queryKey: ['admin', 'mail-posto-accesses'],
    queryFn: async () => {
      const { data, error } = await mailPostosService.accesses();
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!dialog,
    staleTime: 0,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: KEY });
  const fail = (description: string) =>
    toast({ title: 'Não foi possível', description, variant: 'destructive' });

  const save = async (name: string, accessIds: string[]) => {
    const posto = dialog?.posto ?? null;
    const { data, error } = posto
      ? await mailPostosService.update(posto.id, name, accessIds)
      : await mailPostosService.create(name, accessIds);
    if (error || !data) return error ?? 'Não foi possível. Tente outra vez.';
    setDialog(null);
    await refresh();
    if (data.problems.length)
      toast({
        title: 'Posto gravado, mas há caixas que não ligaram',
        description: `${problemsText(data.problems)} Corrija o acesso em Acessos → Emails e volte a gravar o posto.`,
        variant: 'destructive',
      });
    else
      toast({
        title: posto ? 'Posto gravado' : 'Posto criado',
        description: 'Gere o link para instalar.',
      });
    return null;
  };

  const generateLink = async (posto: MailPosto) => {
    setBusyId(posto.id);
    const { data, error } = await mailPostosService.invite(posto.id);
    setBusyId(null);
    if (error || !data) return fail(error ?? 'Tente outra vez.');
    setInvite({ postoName: posto.name, ...data });
    await refresh();
  };

  const toggle = async () => {
    if (!toggling) return;
    const posto = toggling;
    setToggling(null);
    setBusyId(posto.id);
    const { error } = await mailClientsService.setDisabled(posto.userId, !posto.disabledAt);
    setBusyId(null);
    if (error) return fail(error.message);
    toast({ title: posto.disabledAt ? 'Posto religado' : 'Posto desligado' });
    await refresh();
  };

  const remove = async () => {
    if (!deleting) return;
    const posto = deleting;
    setDeleting(null);
    setBusyId(posto.id);
    const { error } = await mailPostosService.remove(posto.id);
    setBusyId(null);
    if (error) return fail(error);
    toast({ title: 'Posto apagado' });
    await refresh();
  };

  const list = postos.data ?? [];
  return (
    <section className="overflow-hidden rounded-[28px] bg-white shadow-rz-soft ring-1 ring-rz-line">
      <div className="flex flex-wrap items-center gap-3 border-b border-rz-line px-4 py-3">
        <p className="min-w-[220px] flex-1 text-[13px] text-rz-muted">
          Um posto é um computador ou telemóvel com a Realize Mail e as caixas que escolher. Envie o
          link a quem o vai instalar.
        </p>
        <button
          type="button"
          onClick={() => setDialog({ posto: null })}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-rz-primary px-4 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" /> Ligar novo posto de email
        </button>
      </div>
      {postos.isLoading ? (
        <Loader2 className="mx-auto my-10 h-6 w-6 animate-spin text-rz-primary" />
      ) : postos.isError ? (
        <p className="px-6 py-12 text-center text-sm text-rose-600">
          Não foi possível carregar os postos.{' '}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => void postos.refetch()}
          >
            Tentar outra vez
          </button>
        </p>
      ) : list.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-rz-muted">
          Ainda não há postos. Crie o primeiro com o botão acima.
        </p>
      ) : (
        list.map(posto => (
          <MailPostoRow
            key={posto.id}
            posto={posto}
            busy={busyId === posto.id}
            onInvite={p => void generateLink(p)}
            onEdit={p => setDialog({ posto: p })}
            onToggle={setToggling}
            onDelete={setDeleting}
          />
        ))
      )}
      <MailPostoDialog
        open={!!dialog}
        posto={dialog?.posto ?? null}
        accesses={accesses.data ?? []}
        accessesLoading={accesses.isLoading}
        onClose={() => setDialog(null)}
        onSave={save}
      />
      <MailPostoInviteDialog invite={invite} onClose={() => setInvite(null)} />
      <ConfirmDialog
        open={!!toggling}
        title={toggling?.disabledAt ? 'Religar o posto?' : 'Desligar o posto?'}
        description={
          toggling?.disabledAt
            ? `${toggling.name} volta a poder entrar com um link novo.`
            : `${toggling?.name ?? ''} sai já da Realize Mail e deixa de ver as caixas. Pode religar depois e gerar um link novo.`
        }
        confirmLabel={toggling?.disabledAt ? 'Religar' : 'Desligar'}
        onConfirm={() => void toggle()}
        onClose={() => setToggling(null)}
      />
      <ConfirmDialog
        open={!!deleting}
        title="Apagar o posto?"
        description={`${deleting?.name ?? ''} deixa de existir e o aparelho perde o acesso às caixas. As caixas nos Acessos não são apagadas.`}
        confirmLabel="Apagar"
        onConfirm={() => void remove()}
        onClose={() => setDeleting(null)}
      />
    </section>
  );
};
