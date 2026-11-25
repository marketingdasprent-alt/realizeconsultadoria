import React, { useState } from 'react';
import { Loader2, UserMinus, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { companyInitials } from '@/lib/companyName';
import { QueryState } from '../sharing/QueryState';
import { useSuperAdminAction, useSuperAdmins } from '../../hooks/usePlatformTeam';
import { superAdminService, type SuperAdmin } from '../../services/superAdminService';
import { ReauthDialog } from '../sharing/ReauthDialog';
import { AddPlatformAdminDialog } from './AddPlatformAdminDialog';

const sinceText = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });

const AdminRow: React.FC<{
  admin: SuperAdmin;
  busy: boolean;
  onRemove: (admin: SuperAdmin) => void;
}> = ({ admin, busy, onRemove }) => (
  <li className="flex min-w-0 flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center">
    <span
      aria-hidden
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rz-primary-soft text-[12px] font-bold text-rz-primary"
    >
      {companyInitials(admin.name)}
    </span>
    <div className="min-w-0 flex-1">
      <p className="truncate font-medium" title={admin.name}>
        {admin.name}
        {admin.is_self && <span className="ml-2 text-xs text-muted-foreground">(você)</span>}
      </p>
      <p className="truncate text-xs text-muted-foreground" title={admin.email}>
        {admin.email}
      </p>
      <p className="text-xs text-muted-foreground">
        Desde {sinceText(admin.since)}
        {admin.added_by_name ? `, adicionado por ${admin.added_by_name}` : ''}
      </p>
    </div>
    <Badge
      variant="outline"
      className="self-start font-normal text-muted-foreground sm:self-center"
    >
      Segundo passo: {admin.mfa_enabled ? 'ativo' : 'desativado'}
    </Badge>
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={busy || admin.is_self}
      title={
        admin.is_self ? 'Peça a outro super administrador para retirar o seu acesso.' : undefined
      }
      aria-label={`Retirar ${admin.name}`}
      onClick={() => onRemove(admin)}
    >
      <UserMinus className="mr-1.5 h-4 w-4" aria-hidden /> Retirar
    </Button>
  </li>
);

/** Quem são os super administradores da plataforma, com adicionar e retirar (só super admin). */
export const PlatformTeamPanel: React.FC = () => {
  const admins = useSuperAdmins(true);
  const action = useSuperAdminAction();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<SuperAdmin | null>(null);
  const list = admins.data ?? [];

  const add = async (userId: string) => {
    const done = await action.run(
      () => superAdminService.add(userId),
      'Super administrador adicionado',
      admins.refetch
    );
    if (done) setAdding(false);
  };

  const remove = async () => {
    if (!removing) return;
    const done = await action.run(
      () => superAdminService.remove(removing.user_id),
      'Acesso retirado',
      admins.refetch
    );
    if (done) setRemoving(null);
  };

  return (
    <section
      aria-labelledby="platform-team"
      className="space-y-4 rounded-2xl border p-4 shadow-card"
    >
      <ReauthDialog
        open={action.reauthOpen}
        onDone={action.finishReauth}
        description="Alterar quem é super administrador exige um login recente. Por segurança, confirme que é você."
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="platform-team" className="text-lg font-semibold">
            Super administradores
          </h2>
          <p className="text-sm text-muted-foreground">
            Veem e gerem todas as empresas. O segundo passo (autenticador) é opcional.
          </p>
        </div>
        <Button type="button" variant="gold" onClick={() => setAdding(true)}>
          <UserPlus className="mr-2 h-4 w-4" aria-hidden /> Adicionar
        </Button>
      </div>
      <QueryState
        isLoading={admins.isLoading}
        error={admins.error}
        isEmpty={list.length === 0}
        emptyTitle="Sem super administradores"
        emptyHint="Não devia acontecer: contacte o suporte."
        onRetry={() => admins.refetch()}
      >
        <ul className="space-y-2">
          {list.map(admin => (
            <AdminRow
              key={admin.user_id}
              admin={admin}
              busy={action.pending}
              onRemove={setRemoving}
            />
          ))}
        </ul>
      </QueryState>

      <AddPlatformAdminDialog
        open={adding}
        busy={action.pending}
        onClose={() => setAdding(false)}
        onConfirm={add}
      />
      <AlertDialog
        open={!!removing}
        onOpenChange={next => !next && !action.pending && setRemoving(null)}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Retirar super administrador</AlertDialogTitle>
            <AlertDialogDescription>
              {removing?.name} deixa de ver todas as empresas. Continua a ter acesso às empresas que
              administra. Há sempre pelo menos um super administrador.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={action.pending}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" onClick={remove} disabled={action.pending}>
              {action.pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              Retirar acesso
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};
