import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Link2, Loader2, ShieldCheck, Unlink } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ROUTES } from '@/lib/constants';
import { useEmployeeAdminAccount } from '../../hooks/useEmployeeAdminAccount';
import type { AdminAccount } from '../../lib/adminLink';
import { PersonAvatar } from '../requests/requestStyles';
import { FileSection } from './files/FileRow';

interface EmployeeAdminAccountCardProps {
  employee: { id: string; name: string; user_id: string | null; admin_user_id?: string | null };
  onChanged: () => void;
}

const PRIMARY =
  'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-rz-primary px-4 text-[13px] font-bold text-white disabled:opacity-50';

const AccountRow: React.FC<{ account: AdminAccount; children: React.ReactNode }> = ({
  account,
  children,
}) => (
  <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-rz-canvas px-3 py-2.5">
    <PersonAvatar name={account.name} url={null} />
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[14px] font-semibold">{account.name}</span>
      <span className="block truncate text-[12.5px] text-rz-muted">{account.email}</span>
    </span>
    {children}
  </div>
);

/**
 * Ficha do colaborador → Conta de administrador (só super admins): liga a conta de admin da
 * mesma pessoa. Com as duas ligadas entra com qualquer uma e muda pelo botão do topo.
 */
export const EmployeeAdminAccountCard: React.FC<EmployeeAdminAccountCardProps> = ({
  employee,
  onChanged,
}) => {
  const account = useEmployeeAdminAccount(employee, onChanged);
  const [choice, setChoice] = useState('');
  if (!account.isSuperAdmin) return null;

  return (
    <div className="mt-4">
      <FileSection
        title="Conta de administrador"
        description="Para quem também é administrador: com as contas ligadas entra com qualquer uma e passa do admin para o Workspace (e ao contrário) pelo botão do topo, sem voltar a pôr a palavra-passe."
      >
        {account.isLoading ? (
          <Loader2 className="mx-auto my-6 h-6 w-6 animate-spin text-rz-primary" />
        ) : account.sameAccount ? (
          <p className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-2.5 text-[13.5px] font-medium text-emerald-800">
            <ShieldCheck className="h-4 w-4 shrink-0" /> Usa a mesma conta no admin e na app.
          </p>
        ) : account.linked ? (
          <AccountRow account={account.linked}>
            <button
              type="button"
              onClick={() => void account.link(null)}
              disabled={account.isSaving}
              className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold text-rz-muted hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
            >
              <Unlink className="h-3.5 w-3.5" /> Desligar
            </button>
          </AccountRow>
        ) : (
          <div className="space-y-3">
            {account.suggestion && (
              <AccountRow account={account.suggestion}>
                <span className="text-[12px] font-semibold text-amber-700">
                  Parece ser a mesma pessoa
                </span>
                <button
                  type="button"
                  onClick={() => void account.link(account.suggestion!.userId)}
                  disabled={account.isSaving}
                  className={PRIMARY}
                >
                  <Link2 className="h-4 w-4" /> Ligar
                </button>
              </AccountRow>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Select value={choice} onValueChange={setChoice}>
                <SelectTrigger className="h-10 min-w-0 flex-1 basis-64 rounded-full border-rz-line text-[13.5px]">
                  <SelectValue
                    placeholder={
                      account.options.length
                        ? 'Escolher outra conta de admin…'
                        : 'Sem contas livres'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {account.options.map(option => (
                    <SelectItem key={option.userId} value={option.userId}>
                      {option.name} · {option.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                onClick={() => void account.link(choice)}
                disabled={!choice || account.isSaving}
                className={PRIMARY}
              >
                {account.isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
                Ligar
              </button>
            </div>
            <p className="px-1 text-[12.5px] text-rz-muted">
              Sem conta de admin? Crie-a em{' '}
              <Link to={ROUTES.ADMIN.SETTINGS} className="font-semibold text-rz-primary">
                Definições → Acessos
              </Link>{' '}
              e ligue-a aqui.
            </p>
          </div>
        )}
        {!employee.user_id && (account.linked || account.sameAccount) && (
          <p className="mt-2 px-1 text-[12.5px] text-rz-muted">
            Ainda não tem conta na app: o botão "Ir para Workspace" aparece quando a tiver.
          </p>
        )}
      </FileSection>
    </div>
  );
};
