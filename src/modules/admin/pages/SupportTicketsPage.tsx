import { useMemo } from 'react';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { CompanyScopeNotice } from '@/components/admin/CompanyScopeNotice';
import { useSupportDepartments } from '@/hooks/useSupportDepartments';
import { useAdminTickets } from '@/hooks/useAdminTickets';
import { SupportDesk } from '../components/support/SupportDesk';
import { useCompanyScope } from '../context/CompanyScopeContext';
import { inScope } from '../lib/companyScope';

/** Suporte (admin): a fila de todos os departamentos a que o admin tem acesso. */
const SupportTicketsPage = () => {
  const {
    departments,
    isLoading: loadingDepartments,
    canAccessDepartment,
    isSuperAdmin,
    userDepartmentIds,
  } = useSupportDepartments();
  const { tickets, isLoading, refetch, updateTicketStatus } = useAdminTickets();
  const { ids: scopeIds } = useCompanyScope();

  // Departamento a que se tem acesso e empresa ou grupo escolhido no menu.
  const accessible = useMemo(
    () =>
      tickets.filter(
        ticket => canAccessDepartment(ticket.department_id) && inScope(scopeIds, ticket.company_id)
      ),
    [tickets, canAccessDepartment, scopeIds]
  );

  return (
    <SupportDesk
      tickets={accessible}
      isLoading={isLoading || loadingDepartments}
      refetch={refetch}
      updateTicketStatus={updateTicketStatus}
      departments={departments.filter(d => isSuperAdmin || userDepartmentIds.includes(d.id))}
      renderHeader={summary => (
        <>
          <AdminPageHeader title="Suporte" description={summary} />
          <CompanyScopeNotice />
        </>
      )}
    />
  );
};

export default SupportTicketsPage;
