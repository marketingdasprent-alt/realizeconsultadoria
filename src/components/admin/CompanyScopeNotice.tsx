import React from 'react';
import { Building2, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCompanyScope } from '@/modules/admin/context/CompanyScopeContext';
import { SCOPE_ALL } from '@/modules/admin/lib/companyScope';

/**
 * Aviso no topo de um ecrã quando o menu está limitado a uma empresa ou a um grupo: lembra o que
 * se está a ver (para ninguém achar que faltam pessoas) e dá o caminho de volta a todas.
 */
export const CompanyScopeNotice: React.FC = () => {
  const { scope, label, setScope, hasChoice, isLoading } = useCompanyScope();
  if (isLoading || !hasChoice || scope === SCOPE_ALL) return null;
  const Icon = scope.startsWith('g:') ? Layers : Building2;
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-white px-4 py-2.5 text-[13px] text-rz-ink shadow-rz-soft ring-1 ring-rz-line"
    >
      <Icon className="h-4 w-4 shrink-0 text-rz-primary" aria-hidden />
      <span className="min-w-0 flex-1">
        A ver só <strong className="font-semibold">{label}</strong>. Mude a empresa no menu.
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-9 rounded-full px-3 text-[13px] font-semibold"
        onClick={() => setScope(SCOPE_ALL)}
      >
        Ver todas as empresas
      </Button>
    </div>
  );
};
