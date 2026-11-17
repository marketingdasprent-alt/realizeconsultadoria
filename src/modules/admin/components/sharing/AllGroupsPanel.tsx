import React from 'react';
import { Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAllGroups, useMyCompanies } from '../../hooks/useSharing';
import {
  GROUP_ORIGIN_LABEL,
  companiesWithoutGroup,
  groupOverview,
  type MyCompany,
} from '../../lib/sharing';
import { QueryState } from './QueryState';

const date = (iso: string) => new Date(iso).toLocaleDateString('pt-PT');

const Heading: React.FC<{ title: string; count: number }> = ({ title, count }) => (
  <div className="flex min-w-0 items-center justify-between gap-2">
    <h2 className="truncate text-base font-semibold">{title}</h2>
    <Badge variant="secondary" className="shrink-0">
      {count === 1 ? '1 empresa' : `${count} empresas`}
    </Badge>
  </div>
);

/**
 * Todos os grupos de empresas de uma vez (só Super Admin): cada grupo com as suas empresas, e as
 * que ainda não estão em nenhum. Entrar num grupo não dá acesso a nada: o acesso vem das partilhas.
 */
export const AllGroupsPanel: React.FC = () => {
  const groups = useAllGroups(true);
  const companies = useMyCompanies();
  const rows = groups.data ?? [];
  const overview = groupOverview(rows);
  const all: MyCompany[] = companies.data ?? [];
  const alone = companiesWithoutGroup(all, rows);

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Os grupos de empresas e as empresas que fazem parte de cada um. Pertencer a um grupo não dá
        acesso aos dados das outras empresas: o acesso só existe se uma empresa o partilhar.
      </p>
      <QueryState
        isLoading={groups.isLoading || companies.isLoading}
        error={groups.error ?? companies.error}
        isEmpty={overview.length === 0 && alone.length === 0}
        emptyTitle="Ainda não há grupos"
        emptyHint="Os grupos aparecem aqui quando forem criados."
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
                    <span className="min-w-0 truncate font-medium" title={company.name}>
                      {company.name}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </QueryState>
    </div>
  );
};
