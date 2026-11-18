import React, { useMemo, useState } from 'react';
import { Loader2, ShieldCheck, UserMinus, UserPlus, UserRound } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { QueryState } from './sharing/QueryState';
import {
  useCompanyEmployeesWithAccount,
  useMembershipAction,
  useMoveAccess,
} from '../hooks/useCompanyMembership';
import { useCompanyViewers } from '../hooks/useSharing';
import {
  ADMIN_ROLE_OPTIONS,
  LAST_ADMIN_RULE,
  adminCandidates,
  canManageCompany,
  canRemoveViewer,
  isLastAdmin,
  viewerRoleText,
  type AdminRole,
} from '../lib/companyMembership';
import type { CompanyViewer } from '../lib/sharing';
import { companyMembershipService } from '../services/companyMembershipService';

interface CompanyAdminsSectionProps {
  company: { id: string; name: string };
}

const ViewerRow: React.FC<{
  viewer: CompanyViewer;
  lastAdmin: boolean;
  busy: boolean;
  onRemove: (viewer: CompanyViewer) => void;
}> = ({ viewer, lastAdmin, busy, onRemove }) => {
  const removable = canRemoveViewer(viewer);
  return (
    <li className="flex min-w-0 flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
          aria-hidden
        >
          {viewer.kind === 'super_admin' ? (
            <ShieldCheck className="h-4 w-4" />
          ) : (
            <UserRound className="h-4 w-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium" title={viewer.name}>
            {viewer.name}
          </p>
          <p className="truncate text-xs text-muted-foreground" title={viewer.email}>
            {viewer.email}
          </p>
        </div>
      </div>
      <Badge
        variant={viewer.kind === 'super_admin' ? 'default' : 'secondary'}
        className="self-start whitespace-nowrap sm:self-center"
      >
        {viewerRoleText(viewer)}
      </Badge>
      {removable ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy || lastAdmin}
          title={lastAdmin ? LAST_ADMIN_RULE : undefined}
          onClick={() => onRemove(viewer)}
          aria-label={`Retirar ${viewer.name}`}
        >
          <UserMinus className="mr-1.5 h-4 w-4" /> Retirar
        </Button>
      ) : (
        <span className="text-xs text-muted-foreground sm:w-[88px]">Gerido pela plataforma</span>
      )}
    </li>
  );
};

/**
 * Administradores de uma empresa: quem a administra ou gere (e a equipa da plataforma, que não se
 * retira aqui). Qualquer administrador da empresa adiciona ou retira outros, menos o último.
 */
const AdminsPanel: React.FC<CompanyAdminsSectionProps> = ({ company }) => {
  const viewersQuery = useCompanyViewers(company.id);
  const employeesQuery = useCompanyEmployeesWithAccount(company.id);
  const action = useMembershipAction();
  const [chosen, setChosen] = useState('');
  const [role, setRole] = useState<AdminRole>('admin');
  const [removing, setRemoving] = useState<CompanyViewer | null>(null);

  const viewers = useMemo(() => viewersQuery.data ?? [], [viewersQuery.data]);
  const candidates = useMemo(
    () => adminCandidates(employeesQuery.data ?? [], viewers),
    [employeesQuery.data, viewers]
  );
  const own = viewers.filter(viewer => viewer.kind !== 'super_admin');
  const platform = viewers.filter(viewer => viewer.kind === 'super_admin');

  const add = async () => {
    if (!chosen) return;
    const done = await action.run(
      () => companyMembershipService.addAdmin(company.id, chosen, role),
      role === 'admin' ? 'Administrador adicionado' : 'Gestor adicionado'
    );
    if (done) setChosen('');
  };

  const confirmRemove = async () => {
    if (!removing) return;
    const done = await action.run(
      () => companyMembershipService.removeAdmin(company.id, removing.user_id),
      'Acesso retirado'
    );
    if (done) setRemoving(null);
  };

  return (
    <section aria-labelledby="company-admins" className="space-y-4">
      <div>
        <h3 id="company-admins" className="text-base font-semibold">
          Administradores
        </h3>
        <p className="text-sm text-muted-foreground">
          Quem administra ou gere <strong>{company.name}</strong>. Pode haver vários, mas a empresa
          nunca fica sem administrador.
        </p>
      </div>

      <QueryState
        isLoading={viewersQuery.isLoading}
        error={viewersQuery.error}
        isEmpty={viewers.length === 0}
        emptyTitle="Ainda não há administradores"
        emptyHint="Adicione abaixo o primeiro administrador."
        onRetry={() => viewersQuery.refetch()}
      >
        <ul className="space-y-2">
          {own.map(viewer => (
            <ViewerRow
              key={viewer.user_id}
              viewer={viewer}
              lastAdmin={isLastAdmin(viewers, viewer)}
              busy={action.pending}
              onRemove={setRemoving}
            />
          ))}
          {platform.map(viewer => (
            <ViewerRow
              key={viewer.user_id}
              viewer={viewer}
              lastAdmin={false}
              busy={action.pending}
              onRemove={setRemoving}
            />
          ))}
        </ul>
      </QueryState>

      <div className="space-y-2 rounded-lg border p-3">
        <p className="text-sm font-medium">Adicionar administrador ou gestor</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={chosen} onValueChange={setChosen} disabled={action.pending}>
            <SelectTrigger className="sm:flex-1" aria-label="Colaborador">
              <SelectValue
                placeholder={
                  candidates.length === 0
                    ? 'Sem colaboradores com conta disponíveis'
                    : 'Escolher um colaborador'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {candidates.map(candidate => (
                <SelectItem key={candidate.userId} value={candidate.userId}>
                  {candidate.name} · {candidate.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={role}
            onValueChange={value => setRole(value as AdminRole)}
            disabled={action.pending}
          >
            <SelectTrigger className="sm:w-[160px]" aria-label="Papel">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ADMIN_ROLE_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="gold" onClick={add} disabled={action.pending || !chosen}>
            {action.pending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="mr-2 h-4 w-4" />
            )}
            Adicionar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {ADMIN_ROLE_OPTIONS.find(option => option.value === role)?.hint} Só aparecem colaboradores
          ativos da empresa que já têm conta.
        </p>
      </div>

      <AlertDialog
        open={!!removing}
        onOpenChange={next => !next && !action.pending && setRemoving(null)}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Retirar acesso de administração</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                {removing?.name} deixa de {removing?.kind === 'gestor' ? 'gerir' : 'administrar'}{' '}
                {company.name}. Se também for colaborador desta empresa, continua como colaborador.
              </span>
              <span className="block">{LAST_ADMIN_RULE}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={action.pending}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" onClick={confirmRemove} disabled={action.pending}>
              {action.pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Retirar acesso
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};

/** A secção só se abre (e só chama a base) a quem administra a empresa. */
export const CompanyAdminsSection: React.FC<CompanyAdminsSectionProps> = ({ company }) => {
  const access = useMoveAccess();
  if (access.isLoading)
    return <Loader2 className="mx-auto my-4 h-5 w-5 animate-spin text-muted-foreground" />;
  if (!canManageCompany(access.companies, company.id))
    return (
      <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
        Só os administradores desta empresa podem ver e alterar quem a administra.
      </p>
    );
  return <AdminsPanel company={company} />;
};
