import { useMemo } from 'react';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { useSupportDepartments } from '@/hooks/useSupportDepartments';
import { useAdminTickets } from '@/hooks/useAdminTickets';
import { SupportDesk } from '../components/support/SupportDesk';

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

  const accessible = useMemo(
    () => tickets.filter(ticket => canAccessDepartment(ticket.department_id)),
    [tickets, canAccessDepartment]
  );

  return (
    <SupportDesk
      tickets={accessible}
      isLoading={isLoading || loadingDepartments}
      refetch={refetch}
      updateTicketStatus={updateTicketStatus}
      departments={departments.filter(d => isSuperAdmin || userDepartmentIds.includes(d.id))}
      renderHeader={summary => <AdminPageHeader title="Suporte" description={summary} />}
    />
  );
};

export default SupportTicketsPage;
