import React, { useState } from 'react';
import {
  ArrowRightLeft,
  Building2,
  Network,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAllGroups, useMyCompanies } from '../../hooks/useSharing';
import {
  GROUP_DEFAULTS_NOTE,
  GROUP_ORIGIN_LABEL,
  companiesWithoutGroup,
  companyLabel,
  groupDefaultsText,
  groupOverview,
  type GroupOverview,
  type MyCompany,
} from '../../lib/sharing';
import { DissolveGroupDialog } from './DissolveGroupDialog';
import { GroupDialog, type GroupDialogState } from './GroupDialog';
import { QueryState } from './QueryState';

const date = (iso: string) => new Date(iso).toLocaleDateString('pt-PT');

const Heading: React.FC<{ title: string; count: number }> = ({ title, count }) => (
  <div className="flex min-w-0 items-center justify-between gap-2">
    <h3 className="truncate text-base font-semibold">{title}</h3>
    <Badge variant="secondary" className="shrink-0">
      {count === 1 ? '1 empresa' : `${count} empresas`}
    </Badge>
  </div>
);

const GroupActions: React.FC<{
  group: GroupOverview;
  onEdit: (state: GroupDialogState) => void;
  onDissolve: (group: GroupOverview) => void;
}> = ({ group, onEdit, onDissolve }) => (
  <div className="flex flex-wrap gap-2">
    <Button
      type="button"
      size="sm"
      variant="outline"
      aria-label={`Renomear ${group.name}`}
      onClick={() => onEdit({ kind: 'rename', group })}
    >
      <Pencil className="mr-1.5 h-4 w-4" /> Renomear
    </Button>
    <Button
      type="button"
      size="sm"
      variant="outline"
      aria-label={`Gerir empresas de ${group.name}`}
      onClick={() => onEdit({ kind: 'members', group })}
    >
      <ArrowRightLeft className="mr-1.5 h-4 w-4" /> Gerir empresas
    </Button>
    <Button
      type="button"
      size="sm"
      variant="outline"
      aria-label={`Módulos de ${group.name}`}
      onClick={() => onEdit({ kind: 'capabilities', group })}
    >
      <SlidersHorizontal className="mr-1.5 h-4 w-4" /> Módulos
    </Button>
    <Button
      type="button"
      size="sm"
      variant="outline"
      aria-label={`Dissolver ${group.name}`}
      onClick={() => onDissolve(group)}
    >
      <Trash2 className="mr-1.5 h-4 w-4" /> Dissolver
    </Button>
  </div>
);

/**
 * Todos os grupos de empresas (só Super Admin): criar, renomear, juntar ou retirar empresas,
 * escolher os módulos do grupo e dissolver. Os módulos só ficam guardados; a regra de leitura que
 * os aplica vem noutro lote (ver GROUP_DEFAULTS_NOTE).
 */
export const AllGroupsPanel: React.FC = () => {
  const groups = useAllGroups(true);
  const companies = useMyCompanies();
  const [dialog, setDialog] = useState<GroupDialogState | null>(null);
  const [dissolving, setDissolving] = useState<GroupOverview | null>(null);
  const rows = groups.data ?? [];
  const overview = groupOverview(rows);
  const all: MyCompany[] = companies.data ?? [];
  const alone = companiesWithoutGroup(all, rows);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl space-y-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Network className="h-5 w-5" aria-hidden /> Grupos de empresas
          </h2>
          <p className="text-sm text-muted-foreground">
            Os módulos do grupo definem o que as empresas veem umas das outras (só leitura); o resto
            só com partilha aprovada.
          </p>
          <p className="text-xs text-muted-foreground">{GROUP_DEFAULTS_NOTE}</p>
        </div>
        <Button
          type="button"
          variant="gold"
          className="self-start"
          disabled={groups.isLoading || !!groups.error}
          onClick={() => setDialog({ kind: 'create' })}
        >
          <Plus className="mr-2 h-4 w-4" /> Novo grupo
        </Button>
      </div>

      <QueryState
        isLoading={groups.isLoading || companies.isLoading}
        error={groups.error ?? companies.error}
        isEmpty={overview.length === 0 && alone.length === 0}
        emptyTitle="Ainda não há grupos"
        emptyHint="Crie o primeiro grupo em «Novo grupo»."
        onRetry={() => {
          void groups.refetch();
          void companies.refetch();
        }}
        retryOnEmpty
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {overview.map(group => (
            <section
              key={group.id}
              aria-label={group.name}
              className="min-w-0 space-y-3 rounded-lg border p-4"
            >
              <Heading title={group.name} count={group.members.length} />
              <p className="text-sm text-muted-foreground">
                Módulos do grupo: <strong>{groupDefaultsText(group.defaultCapabilities)}</strong>
              </p>
              <ul className="space-y-2">
                {group.members.map(member => (
                  <li
                    key={member.companyId}
                    className="flex min-w-0 flex-col gap-0.5 rounded-md bg-muted/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                  >
                    <span className="min-w-0 truncate font-medium" title={member.name}>
                      {member.name}
                    </span>
                    <span className="text-xs text-muted-foreground sm:shrink-0">
                      Desde {date(member.joinedAt)} · {GROUP_ORIGIN_LABEL[member.origin]}
                    </span>
                  </li>
                ))}
              </ul>
              <GroupActions group={group} onEdit={setDialog} onDissolve={setDissolving} />
            </section>
          ))}
          {alone.length > 0 && (
            <section
              aria-label="Empresas sem grupo"
              className="min-w-0 space-y-3 rounded-lg border border-dashed p-4"
            >
              <Heading title="Sem grupo" count={alone.length} />
              <ul className="space-y-2">
                {alone.map(company => (
                  <li
                    key={company.company_id}
                    className="flex min-w-0 items-center gap-2 rounded-md bg-muted/40 px-3 py-2"
                  >
                    <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span
                      className="min-w-0 truncate font-medium"
                      title={companyLabel(company.name)}
                    >
                      {companyLabel(company.name)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </QueryState>

      <GroupDialog state={dialog} rows={rows} companies={all} onClose={() => setDialog(null)} />
      <DissolveGroupDialog group={dissolving} onClose={() => setDissolving(null)} />
    </div>
  );
};
