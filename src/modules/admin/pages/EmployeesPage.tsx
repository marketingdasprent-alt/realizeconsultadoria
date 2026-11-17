import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { Button } from '@/components/ui/button';
import EmployeeAvisoDialog from '@/components/admin/EmployeeAvisoDialog';
import DeleteConfirmDialog from '@/components/admin/DeleteConfirmDialog';
import ChangeEmployeePasswordDialog from '@/components/admin/ChangeEmployeePasswordDialog';
import ResendInviteSuccessDialog from '@/components/admin/ResendInviteSuccessDialog';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { ROUTES } from '@/lib/constants';
import { matchesSearch } from '@/lib/utils';
import { CompanyScopeNotice } from '@/components/admin/CompanyScopeNotice';
import { useCompanyScope } from '../context/CompanyScopeContext';
import { filterByScope, inScope } from '../lib/companyScope';
import { EmployeesStats } from '../components/employees/EmployeesStats';
import { MissingBirthdatesNotice } from '../components/employees/MissingBirthdatesNotice';
import { EmployeesToolbar, type StatusFilter } from '../components/employees/EmployeesToolbar';
import { EmployeesTable, type SortField } from '../components/employees/EmployeesTable';
import { PendingDocumentsDialog } from '../components/employees/PendingDocumentsDialog';
import { useDocumentAlerts } from '../hooks/useDocumentAlerts';
import { useEmployeeAvatars } from '../hooks/useEmployeeAvatars';
import { useEmployeeLastSignIn } from '../hooks/useEmployeeLastSignIn';
import { useEmployeeListActions } from '../hooks/useEmployeeListActions';
import { useCompanies } from '@/hooks/useCompanies';
import { companiesOf, companyName, hasBirthdayIn } from '../lib/employeeView';
import type { Employee } from '../services/employeeService';

const thisMonth = new Date().getMonth();

const SORTERS: Record<SortField, (a: Employee, b: Employee) => number> = {
  name: (a, b) => a.name.localeCompare(b.name, 'pt'),
  company: (a, b) => companyName(a).localeCompare(companyName(b), 'pt'),
  position: (a, b) => (a.position || '').localeCompare(b.position || '', 'pt'),
  status: (a, b) => Number(b.is_active) - Number(a.is_active),
};

/** Colaboradores: números da equipa, filtros (no endereço) e a lista pessoal ou financeira. */
const EmployeesPage = () => {
  const navigate = useNavigate();
  const { canExecuteTopic } = useAdminPermissions();
  const actions = useEmployeeListActions();
  const avatarOf = useEmployeeAvatars();
  const { accessOf } = useEmployeeLastSignIn();
  const [params, setParams] = useSearchParams();
  const [pendingOpen, setPendingOpen] = useState(false);
  const documentAlerts = useDocumentAlerts();
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const search = params.get('q') || '';
  const status = (
    ['inactive', 'all'].includes(params.get('status') || '') ? params.get('status') : 'active'
  ) as StatusFilter;
  const scopeCtx = useCompanyScope();
  const urlCompanyId = params.get('empresa') || 'all';
  const onlyBirthdays = params.get('aniversarios') === '1';
  const onlyMissingBirth = params.get('aniversarios') === 'sem';
  const onlyNotUsing = params.get('acesso') === '1';
  /** Ativo que nunca entrou ou não entra há 7+ dias. */
  const notUsing = (employee: Employee) => {
    const access = accessOf(employee.id);
    return employee.is_active && !!access && access.kind !== 'recent';
  };

  /** Muda um filtro no endereço (o valor por omissão sai do endereço). */
  const setParam = (key: string, value: string, fallback: string) =>
    setParams(
      previous => {
        const next = new URLSearchParams(previous);
        if (value === fallback) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true }
    );

  const permissions = {
    canEdit: canExecuteTopic('employees', 'edit'),
    canDelete: canExecuteTopic('employees', 'delete'),
    canNotifications: canExecuteTopic('employees', 'notifications'),
    canResetPassword: canExecuteTopic('employees', 'reset_password'),
  };

  // O menu pode limitar a uma empresa ou grupo: só as pessoas e empresas dessa escolha.
  const employees = useMemo(
    () => filterByScope(actions.employees, scopeCtx.ids, e => e.company_id),
    [actions.employees, scopeCtx.ids]
  );
  // Todas as empresas ativas (e não só as que já têm colaboradores): para filtrar e criar numa vazia.
  // O hook partilhado traz também as inativas; aqui só interessam as ativas, como na ficha.
  const allCompanies = useCompanies();
  const activeCompanies = useMemo(
    () => allCompanies.companies.filter(company => company.is_active),
    [allCompanies.companies]
  );
  const companies = useMemo(
    () =>
      (activeCompanies.length ? activeCompanies : companiesOf(employees)).filter(company =>
        inScope(scopeCtx.ids, company.id)
      ),
    [activeCompanies, employees, scopeCtx.ids]
  );
  // Uma empresa só no menu manda; senão vale o filtro do endereço, se ainda estiver na escolha.
  const companyId =
    scopeCtx.singleCompanyId ??
    (urlCompanyId !== 'all' && companies.some(c => c.id === urlCompanyId) ? urlCompanyId : 'all');

  // Os números refletem a pesquisa e a empresa, mas não o estado (servem para o escolher).
  const searched = useMemo(() => {
    const iban = search.replace(/\s/g, '').toLowerCase();
    return employees.filter(
      employee =>
        (companyId === 'all' || employee.company_id === companyId) &&
        (matchesSearch(employee.name, search) ||
          matchesSearch(employee.email, search) ||
          matchesSearch(companyName(employee), search) ||
          (!!iban && (employee.iban || '').replace(/\s/g, '').toLowerCase().includes(iban)))
    );
  }, [employees, search, companyId]);

  const visible = useMemo(() => {
    const direction = sortDirection === 'asc' ? 1 : -1;
    return searched
      .filter(e => status === 'all' || e.is_active === (status === 'active'))
      .filter(e => !onlyBirthdays || hasBirthdayIn(e, thisMonth))
      .filter(e => !onlyMissingBirth || (e.is_active && !e.birth_date))
      .filter(e => !onlyNotUsing || notUsing(e))
      .sort((a, b) => SORTERS[sortField](a, b) * direction);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- notUsing depende de accessOf
  }, [
    searched,
    status,
    onlyBirthdays,
    onlyMissingBirth,
    onlyNotUsing,
    accessOf,
    sortField,
    sortDirection,
  ]);

  const sort = (field: SortField) => {
    setSortDirection(field === sortField && sortDirection === 'asc' ? 'desc' : 'asc');
    setSortField(field);
  };
  const open = (employee: Employee) => navigate(`${ROUTES.ADMIN.EMPLOYEES}/${employee.id}`);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Colaboradores"
        description="Fichas, documentos e acessos da equipa"
        actions={
          <>
            {canExecuteTopic('employees', 'create') && (
              <Button
                className="rounded-full"
                onClick={() =>
                  // Com uma empresa escolhida no filtro, o colaborador novo já nasce nessa empresa
                  navigate(
                    companyId === 'all'
                      ? ROUTES.ADMIN.EMPLOYEE_NEW
                      : `${ROUTES.ADMIN.EMPLOYEE_NEW}?empresa=${companyId}`
                  )
                }
              >
                <Plus className="h-4 w-4" /> Novo colaborador
              </Button>
            )}
          </>
        }
      />

      <CompanyScopeNotice />

      <EmployeesStats
        active={searched.filter(e => e.is_active).length}
        inactive={searched.filter(e => !e.is_active).length}
        birthdays={searched.filter(e => e.is_active && hasBirthdayIn(e, thisMonth)).length}
        status={status}
        onlyBirthdays={onlyBirthdays}
        onStatusChange={value => setParam('status', value, 'active')}
        onBirthdaysChange={value => setParam('aniversarios', value ? '1' : '0', '0')}
        pendingDocuments={documentAlerts.pending.length}
        onPendingDocuments={() => setPendingOpen(true)}
        notUsing={searched.filter(notUsing).length}
        onlyNotUsing={onlyNotUsing}
        onNotUsingChange={value => setParam('acesso', value ? '1' : '0', '0')}
      />

      <MissingBirthdatesNotice
        count={searched.filter(e => e.is_active && !e.birth_date).length}
        isFiltering={onlyMissingBirth}
        onToggle={() => setParam('aniversarios', onlyMissingBirth ? '0' : 'sem', '0')}
      />

      <section className="overflow-hidden rounded-[28px] bg-white shadow-rz-soft ring-1 ring-rz-line">
        <EmployeesToolbar
          search={search}
          onSearchChange={value => setParam('q', value, '')}
          status={status}
          onStatusChange={value => setParam('status', value, 'active')}
          companies={companies}
          showCompany={!scopeCtx.singleCompanyId}
          companyId={companyId}
          onCompanyChange={value => setParam('empresa', value, 'all')}
          count={visible.length}
        />
        <EmployeesTable
          employees={visible}
          accessOf={accessOf}
          isLoading={actions.isLoading}
          avatarOf={avatarOf}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={sort}
          permissions={permissions}
          resendingId={actions.resendingId}
          alertsOf={employeeId => ({
            expiring: documentAlerts.expiringOf(employeeId).length,
            pending: documentAlerts.pendingOf(employeeId).length,
          })}
          onOpen={open}
          onNotices={actions.setNoticesFor}
          onPassword={actions.setPasswordFor}
          onResendInvite={actions.resend}
          onToggleStatus={actions.toggle}
          onDelete={actions.setDeleteFor}
        />
      </section>

      <EmployeeAvisoDialog
        open={!!actions.noticesFor}
        onOpenChange={value => !value && actions.setNoticesFor(null)}
        employeeId={actions.noticesFor?.id || ''}
        employeeName={actions.noticesFor?.name || ''}
      />
      <DeleteConfirmDialog
        open={!!actions.deleteFor}
        onOpenChange={value => !value && actions.setDeleteFor(null)}
        title="Eliminar colaborador"
        description="Tem a certeza que deseja eliminar este colaborador?"
        itemName={actions.deleteFor?.name}
        onConfirm={actions.confirmDelete}
        isLoading={actions.isDeleting}
      />
      <ChangeEmployeePasswordDialog
        open={!!actions.passwordFor}
        onOpenChange={value => !value && actions.setPasswordFor(null)}
        employeeId={actions.passwordFor?.id || ''}
        employeeName={actions.passwordFor?.name || ''}
      />
      <PendingDocumentsDialog
        open={pendingOpen}
        onOpenChange={setPendingOpen}
        pending={documentAlerts.pending}
        canReview={permissions.canEdit}
        onChanged={() => documentAlerts.refetch()}
      />
      <ResendInviteSuccessDialog
        open={!!actions.invite}
        onOpenChange={value => !value && actions.setInvite(null)}
        employeeName={actions.invite?.name || ''}
        newPassword={actions.invite?.password || ''}
      />
    </div>
  );
};

export default EmployeesPage;
