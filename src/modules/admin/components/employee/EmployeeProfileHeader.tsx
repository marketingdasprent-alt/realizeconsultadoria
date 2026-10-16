import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  Cake,
  Key,
  Loader2,
  Mail,
  MoreHorizontal,
  Phone,
  RefreshCw,
  UserCheck,
  UserX,
  type LucideIcon,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import EmployeeAvisoDialog from '@/components/admin/EmployeeAvisoDialog';
import ChangeEmployeePasswordDialog from '@/components/admin/ChangeEmployeePasswordDialog';
import ResendInviteSuccessDialog from '@/components/admin/ResendInviteSuccessDialog';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/modules/workspace/components/UserAvatar';
import { useEmployeeProfileActions } from '../../hooks/useEmployeeProfileActions';
import type { EmployeeRecord } from './EmployeeGeneralTab';

interface EmployeeProfileHeaderProps {
  employee: EmployeeRecord;
  avatarUrl: string | null;
  onChanged: () => void;
}

const Chip: React.FC<{ icon: LucideIcon; href?: string; children: React.ReactNode }> = ({
  icon: Icon,
  href,
  children,
}) => {
  const className =
    'inline-flex items-center gap-1.5 rounded-full bg-rz-canvas px-3 py-1.5 text-[12.5px] font-semibold text-rz-muted';
  const content = (
    <>
      <Icon className="h-3.5 w-3.5" />
      {children}
    </>
  );
  return href ? (
    <a href={href} className={cn(className, 'hover:text-rz-ink')}>
      {content}
    </a>
  ) : (
    <span className={className}>{content}</span>
  );
};

const day = (iso: string, pattern: string) => format(parseISO(iso), pattern, { locale: pt });

/** Topo da ficha: fotografia, nome, cargo e empresa, contactos e o menu de ações. */
export const EmployeeProfileHeader = ({
  employee,
  avatarUrl,
  onChanged,
}: EmployeeProfileHeaderProps) => {
  const navigate = useNavigate();
  const { canExecuteTopic } = useAdminPermissions();
  const actions = useEmployeeProfileActions(employee, onChanged);
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const canResetPassword = canExecuteTopic('employees', 'reset_password');
  const role = [employee.position, employee.companies?.name].filter(Boolean).join(' · ');

  return (
    <section className="rounded-[28px] bg-white p-4 shadow-rz-soft ring-1 ring-rz-line sm:p-5">
      <div className="flex items-start gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => navigate(ROUTES.ADMIN.EMPLOYEES)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-rz-muted transition-colors hover:bg-rz-canvas hover:text-rz-ink"
          aria-label="Voltar aos colaboradores"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <UserAvatar
          name={employee.name}
          src={avatarUrl}
          size="lg"
          className={cn(!employee.is_active && 'opacity-60 grayscale')}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[24px] font-extrabold leading-tight tracking-tight sm:text-[28px]">
              {employee.name}
            </h1>
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
          </div>
          {role && <p className="mt-0.5 text-[14px] text-rz-muted">{role}</p>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Chip icon={Mail} href={`mailto:${employee.email}`}>
              {employee.email}
            </Chip>
            {employee.phone && (
              <Chip icon={Phone} href={`tel:${employee.phone.replace(/\s/g, '')}`}>
                {employee.phone}
              </Chip>
            )}
            {employee.birth_date && (
              <Chip icon={Cake}>Faz anos a {day(employee.birth_date, "d 'de' MMMM")}</Chip>
            )}
            {employee.hire_date && (
              <Chip icon={Briefcase}>Desde {day(employee.hire_date, 'dd/MM/yyyy')}</Chip>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-rz-muted ring-1 ring-rz-line transition-colors hover:bg-rz-canvas hover:text-rz-ink"
              aria-label="Mais ações"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {canExecuteTopic('employees', 'notifications') && (
              <DropdownMenuItem onClick={() => setNoticesOpen(true)}>
                <AlertTriangle className="mr-2 h-4 w-4" /> Avisos
              </DropdownMenuItem>
            )}
            {canResetPassword && (
              <>
                <DropdownMenuItem onClick={() => setPasswordOpen(true)}>
                  <Key className="mr-2 h-4 w-4" /> Definir nova senha
                </DropdownMenuItem>
                <DropdownMenuItem onClick={actions.resendInvite} disabled={actions.isResending}>
                  {actions.isResending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Re-enviar convite
                </DropdownMenuItem>
              </>
            )}
            {canExecuteTopic('employees', 'edit') && (
              <DropdownMenuItem onClick={actions.toggleStatus} disabled={actions.isToggling}>
                {employee.is_active ? (
                  <>
                    <UserX className="mr-2 h-4 w-4" /> Desativar colaborador
                  </>
                ) : (
                  <>
                    <UserCheck className="mr-2 h-4 w-4" /> Ativar colaborador
                  </>
                )}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <EmployeeAvisoDialog
        open={noticesOpen}
        onOpenChange={setNoticesOpen}
        employeeId={employee.id}
        employeeName={employee.name}
      />
      <ChangeEmployeePasswordDialog
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
        employeeId={employee.id}
        employeeName={employee.name}
      />
      <ResendInviteSuccessDialog
        open={!!actions.invitePassword}
        onOpenChange={open => !open && actions.clearInvite()}
        employeeName={employee.name}
        newPassword={actions.invitePassword || ''}
      />
    </section>
  );
};
