import React from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Cake,
  FileClock,
  UsersRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/modules/workspace/components/UserAvatar';
import { companyName, hasBirthdayIn } from '../../lib/employeeView';
import { accessLabel, type AccessStatus } from '../../lib/accessStatus';
import type { Employee } from '../../services/employeeService';
import {
  EmployeeRowActions,
  type EmployeeActionHandlers,
  type EmployeeActionPermissions,
} from './EmployeeRowActions';

export type SortField = 'name' | 'company' | 'position' | 'status';

interface EmployeesTableProps extends EmployeeActionHandlers {
  employees: Employee[];
  isLoading: boolean;
  avatarOf: (userId: string | null) => string | null;
  sortField: SortField;
  sortDirection: 'asc' | 'desc';
  onSort: (field: SortField) => void;
  permissions: EmployeeActionPermissions;
  resendingId: string | null;
  /** Documentos a expirar (ou expirados) e por aprovar de cada colaborador. */
  alertsOf: (employeeId: string) => { expiring: number; pending: number };
  /** Última entrada na app (null enquanto não chega). */
  accessOf?: (employeeId: string) => AccessStatus | null;
}

const COLUMNS: { field: SortField; label: string; className?: string }[] = [
  { field: 'name', label: 'Colaborador' },
  { field: 'company', label: 'Empresa', className: 'hidden md:table-cell' },
  { field: 'position', label: 'Função', className: 'hidden lg:table-cell' },
  { field: 'status', label: 'Estado' },
];

const thisMonth = new Date().getMonth();

/** Lista de colaboradores: fotografia, nome e email, empresa, cargo, telefone e estado. */
export const EmployeesTable: React.FC<EmployeesTableProps> = props => {
  const { employees, isLoading, sortField, sortDirection } = props;

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[0, 1, 2, 3, 4, 5].map(key => (
          <div key={key} className="h-14 animate-pulse rounded-2xl bg-rz-canvas" />
        ))}
      </div>
    );
  }

  if (employees.length === 0) {
    return (
      <div className="flex flex-col items-center px-6 py-14 text-center">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-rz-primary-soft">
          <UsersRound className="h-6 w-6 text-rz-primary" />
        </span>
        <p className="font-semibold">Nenhum colaborador encontrado</p>
        <p className="text-[13px] text-rz-muted">Experimente outro nome, empresa ou estado.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[14px]">
        <thead>
          <tr className="border-b border-rz-line text-left text-[12px] font-bold text-rz-muted">
            {COLUMNS.map(column => (
              <th key={column.field} className={cn('px-4 py-2.5', column.className)}>
                <button
                  type="button"
                  onClick={() => props.onSort(column.field)}
                  className="inline-flex items-center gap-1 hover:text-rz-ink"
                >
                  {column.label}
                  {sortField !== column.field ? (
                    <ArrowUpDown className="h-3 w-3 opacity-50" />
                  ) : sortDirection === 'asc' ? (
                    <ArrowUp className="h-3 w-3" />
                  ) : (
                    <ArrowDown className="h-3 w-3" />
                  )}
                </button>
              </th>
            ))}
            <th className="hidden px-4 py-2.5 xl:table-cell">Telefone</th>
            <th className="w-12" />
          </tr>
        </thead>
        <tbody>
          {employees.map(employee => {
            const alerts = props.alertsOf(employee.id);
            return (
              <tr
                key={employee.id}
                onClick={() => props.permissions.canEdit && props.onOpen(employee)}
                className={cn(
                  'border-b border-rz-line last:border-0 transition-colors',
                  props.permissions.canEdit && 'cursor-pointer hover:bg-rz-primary-soft/60',
                  // Documento perto de expirar: a linha fica vermelha até ser renovado.
                  alerts.expiring > 0 && 'bg-red-50 shadow-[inset_3px_0_0_#ef4444] hover:bg-red-100'
                )}
              >
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      name={employee.name}
                      src={props.avatarOf(employee.user_id)}
                      size="md"
                      className={cn(!employee.is_active && 'opacity-50 grayscale')}
                    />
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate font-semibold">
                        {employee.name}
                        {hasBirthdayIn(employee, thisMonth) && (
                          <Cake
                            className="h-3.5 w-3.5 shrink-0 text-pink-500"
                            aria-label="Faz anos este mês"
                          />
                        )}
                      </p>
                      <p className="truncate text-[12.5px] text-rz-muted">{employee.email}</p>
                      {(alerts.expiring > 0 || alerts.pending > 0) && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {alerts.expiring > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
                              <AlertTriangle className="h-3 w-3" />
                              {alerts.expiring === 1
                                ? 'Documento a expirar'
                                : `${alerts.expiring} documentos a expirar`}
                            </span>
                          )}
                          {alerts.pending > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                              <FileClock className="h-3 w-3" />
                              {alerts.pending === 1
                                ? 'Documento por aprovar'
                                : `${alerts.pending} por aprovar`}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="hidden px-4 py-2.5 text-[13.5px] md:table-cell">
                  {companyName(employee)}
                </td>
                <td className="hidden px-4 py-2.5 lg:table-cell">
                  <p className="text-[13.5px]">{employee.position || '—'}</p>
                  {employee.department && (
                    <p className="text-[12px] text-rz-muted">{employee.department}</p>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-1 text-[12px] font-bold',
                      employee.is_active
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                    )}
                  >
                    {employee.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                  {employee.is_active &&
                    (() => {
                      const access = props.accessOf?.(employee.id);
                      const label = access ? accessLabel(access) : null;
                      return label ? (
                        <p className="mt-1 whitespace-nowrap text-[11.5px] font-semibold text-orange-700">
                          {label}
                        </p>
                      ) : null;
                    })()}
                </td>
                <td className="hidden px-4 py-2.5 text-[13.5px] tabular-nums text-rz-muted xl:table-cell">
                  {employee.phone || '—'}
                </td>
                <td className="px-2 py-2.5" onClick={event => event.stopPropagation()}>
                  <EmployeeRowActions
                    employee={employee}
                    permissions={props.permissions}
                    isResending={props.resendingId === employee.id}
                    onOpen={props.onOpen}
                    onNotices={props.onNotices}
                    onPassword={props.onPassword}
                    onResendInvite={props.onResendInvite}
                    onToggleStatus={props.onToggleStatus}
                    onDelete={props.onDelete}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
