import React, { useId, useMemo, useState } from 'react';
import { ArrowRightLeft, Loader2, Search, UserPlus, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QueryState } from './sharing/QueryState';
import { CompanyEmployeePicker } from './CompanyEmployeePicker';
import { MoveEmployeesDialog, type MoveSubject } from './employees/MoveEmployeesDialog';
import {
  useCompanyEmployees,
  useMoveAccess,
  useRefreshCompanyEmployees,
} from '../hooks/useCompanyMembership';
import {
  SEARCH_THRESHOLD,
  canManageCompany,
  filterByName,
  type CompanyEmployee,
} from '../lib/companyMembership';

interface CompanyEmployeesSectionProps {
  company: { id: string; name: string; isActive: boolean };
}

const EmployeeRow: React.FC<{
  employee: CompanyEmployee;
  canMove: boolean;
  onMove: (employee: CompanyEmployee) => void;
}> = ({ employee, canMove, onMove }) => {
  const detail = [employee.position, employee.department].filter(Boolean).join(' · ');
  return (
    <li className="flex min-w-0 flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
          aria-hidden
        >
          <UserRound className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium" title={employee.name}>
            {employee.name}
          </p>
          {detail && (
            <p className="truncate text-xs text-muted-foreground" title={detail}>
              {detail}
            </p>
          )}
        </div>
      </div>
      {!employee.user_id && (
        <Badge variant="secondary" className="self-start whitespace-nowrap sm:self-center">
          Sem conta
        </Badge>
      )}
      {canMove && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label={`Mover ${employee.name} para outra empresa`}
          onClick={() => onMove(employee)}
        >
          <ArrowRightLeft className="mr-1.5 h-4 w-4" /> Mover para outra empresa…
        </Button>
      )}
    </li>
  );
};

const EmployeesPanel: React.FC<CompanyEmployeesSectionProps> = ({ company }) => {
  const searchId = useId();
  const query = useCompanyEmployees(company.id);
  const access = useMoveAccess();
  const refresh = useRefreshCompanyEmployees();
  const [search, setSearch] = useState('');
  const [picking, setPicking] = useState(false);
  const [moving, setMoving] = useState<{ employees: MoveSubject[]; fixed: boolean } | null>(null);

  const employees = useMemo(() => query.data ?? [], [query.data]);
  const visible = useMemo(() => filterByName(employees, search), [employees, search]);
  const count = employees.length;

  return (
    <section aria-labelledby="company-employees" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="company-employees" className="text-lg font-semibold leading-none tracking-tight">
            Colaboradores
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Quem trabalha em <strong>{company.name}</strong>. Cada pessoa pertence a uma só empresa:
            ao passar para esta, o Workspace dela segue esta empresa.
          </p>
          {query.data && (
            <p className="mt-1 text-sm font-medium">
              {count} {count === 1 ? 'colaborador' : 'colaboradores'}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="gold"
          className="self-start"
          disabled={!company.isActive}
          onClick={() => setPicking(true)}
        >
          <UserPlus className="mr-2 h-4 w-4" /> Adicionar colaboradores
        </Button>
      </div>

      {!company.isActive && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Esta empresa está inativa e não pode receber colaboradores. Ative-a para os adicionar.
        </p>
      )}

      {employees.length > SEARCH_THRESHOLD && (
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"
            aria-hidden
          />
          <Input
            id={searchId}
            className="pl-9"
            value={search}
            onChange={event => setSearch(event.target.value)}
            aria-label="Pesquisar na lista da empresa"
            placeholder="Pesquisar por nome"
          />
        </div>
      )}

      <QueryState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={employees.length === 0}
        emptyTitle="Esta empresa ainda não tem colaboradores"
        emptyHint="Use «Adicionar colaboradores» para passar fichas de outras empresas para esta."
        onRetry={() => query.refetch()}
      >
        {visible.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nenhum colaborador com esse nome.
          </p>
        ) : (
          <ul className="space-y-2">
            {visible.map(employee => (
              <EmployeeRow
                key={employee.id}
                employee={employee}
                canMove={access.canOfferMove(employee)}
                onMove={picked =>
                  setMoving({ employees: [{ ...picked, companyName: company.name }], fixed: false })
                }
              />
            ))}
          </ul>
        )}
      </QueryState>

      <CompanyEmployeePicker
        open={picking}
        company={company}
        onClose={() => setPicking(false)}
        onContinue={selected => {
          setPicking(false);
          setMoving({ employees: selected, fixed: true });
        }}
      />
      <MoveEmployeesDialog
        employees={moving?.employees ?? null}
        fixedDestination={moving?.fixed ? { id: company.id, name: company.name } : undefined}
        onClose={() => setMoving(null)}
        onMoved={() => void refresh()}
      />
    </section>
  );
};

/** A secção só se abre (e só chama a base) a quem administra a empresa; a base é o controlo real. */
export const CompanyEmployeesSection: React.FC<CompanyEmployeesSectionProps> = ({ company }) => {
  const access = useMoveAccess();
  if (access.isLoading)
    return <Loader2 className="mx-auto my-4 h-5 w-5 animate-spin text-muted-foreground" />;
  if (!canManageCompany(access.companies, company.id))
    return (
      <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
        Só os administradores desta empresa podem ver e alterar quem lhe pertence.
      </p>
    );
  // A chave recomeça a pesquisa e os diálogos ao mudar de empresa
  return <EmployeesPanel key={company.id} company={company} />;
};
