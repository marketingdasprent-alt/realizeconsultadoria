import React from 'react';
import {
  AlertTriangle,
  Edit,
  Key,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  UserCheck,
  UserX,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Employee } from '../../services/employeeService';

export interface EmployeeActionPermissions {
  canEdit: boolean;
  canDelete: boolean;
  canNotifications: boolean;
  canResetPassword: boolean;
}

export interface EmployeeActionHandlers {
  onOpen: (employee: Employee) => void;
  onNotices: (employee: Employee) => void;
  onPassword: (employee: Employee) => void;
  onResendInvite: (employee: Employee) => void;
  onToggleStatus: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
}

interface EmployeeRowActionsProps extends EmployeeActionHandlers {
  employee: Employee;
  permissions: EmployeeActionPermissions;
  isResending: boolean;
}

/** Menu "⋯" de cada colaborador (ativar/desativar está aqui, e não no clique do estado). */
export const EmployeeRowActions: React.FC<EmployeeRowActionsProps> = ({
  employee,
  permissions,
  isResending,
  ...on
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button
        type="button"
        onClick={event => event.stopPropagation()}
        className="flex h-9 w-9 items-center justify-center rounded-full text-rz-muted transition-colors hover:bg-rz-canvas hover:text-rz-ink"
        aria-label={`Ações de ${employee.name}`}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-52" onClick={event => event.stopPropagation()}>
      {permissions.canEdit && (
        <DropdownMenuItem onClick={() => on.onOpen(employee)}>
          <Edit className="mr-2 h-4 w-4" /> Abrir ficha
        </DropdownMenuItem>
      )}
      {permissions.canNotifications && (
        <DropdownMenuItem onClick={() => on.onNotices(employee)}>
          <AlertTriangle className="mr-2 h-4 w-4" /> Avisos
        </DropdownMenuItem>
      )}
      {permissions.canResetPassword && (
        <>
          <DropdownMenuItem onClick={() => on.onPassword(employee)}>
            <Key className="mr-2 h-4 w-4" /> Definir nova senha
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => on.onResendInvite(employee)} disabled={isResending}>
            {isResending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Re-enviar convite
          </DropdownMenuItem>
        </>
      )}
      {permissions.canEdit && (
        <DropdownMenuItem onClick={() => on.onToggleStatus(employee)}>
          {employee.is_active ? (
            <>
              <UserX className="mr-2 h-4 w-4" /> Desativar
            </>
          ) : (
            <>
              <UserCheck className="mr-2 h-4 w-4" /> Ativar
            </>
          )}
        </DropdownMenuItem>
      )}
      {permissions.canDelete && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => on.onDelete(employee)} className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" /> Eliminar
          </DropdownMenuItem>
        </>
      )}
    </DropdownMenuContent>
  </DropdownMenu>
);
