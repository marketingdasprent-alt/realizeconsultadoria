import React, { useState } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import {
  COMPANY_PANEL_CLASS,
  CompanyPickerList,
  CompanyTile,
  type CompanyPickerSection,
} from '@/components/admin/CompanyPickerList';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { sortCompanies } from '@/lib/companyName';
import { cn } from '@/lib/utils';
import { useCompanyScope } from '@/modules/admin/context/CompanyScopeContext';
import { SCOPE_ALL, companyScope, groupScope } from '@/modules/admin/lib/companyScope';

interface AdminCompanyScopeProps {
  /** Menu recolhido: só o mosaico. */
  collapsed?: boolean;
  /** 'light': sobre fundo claro (folha do menu no telemóvel). */
  tone?: 'dark' | 'light';
  /** Fecha o menu do telemóvel depois de escolher. */
  onChosen?: () => void;
}

/**
 * "Empresa" no topo do menu: escolhe-se uma vez e Colaboradores, Acessos, Calendário e os outros
 * ecrãs mostram só essa empresa (ou as de um grupo). Só aparece com mais de uma empresa.
 */
export const AdminCompanyScope: React.FC<AdminCompanyScopeProps> = ({
  collapsed = false,
  tone = 'dark',
  onChosen,
}) => {
  const { scope, setScope, companies, groups, label, hasChoice, isLoading } = useCompanyScope();
  const [open, setOpen] = useState(false);
  // A pesquisa é nossa para que a lista abra sempre limpa.
  const [query, setQuery] = useState('');

  if (isLoading || !hasChoice) return null;

  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next) setQuery('');
  };
  const choose = (id: string) => {
    setScope(id);
    changeOpen(false);
    onChosen?.();
  };

  const sections: CompanyPickerSection[] = [
    {
      key: 'all',
      entries: [{ id: SCOPE_ALL, name: 'Todas as empresas', kind: 'all' }],
    },
    ...(groups.length
      ? [
          {
            key: 'groups',
            heading: 'Grupos',
            entries: groups.map(group => ({
              id: groupScope(group.id),
              name: group.name,
              kind: 'group' as const,
              meta: `${group.companyIds.length} empresas`,
            })),
          },
        ]
      : []),
    {
      key: 'companies',
      heading: 'Empresas',
      entries: sortCompanies(companies).map(company => ({
        id: companyScope(company.id),
        name: company.name,
        kind: 'company' as const,
      })),
    },
  ];

  const kind = scope.startsWith('g:') ? 'group' : scope.startsWith('c:') ? 'company' : 'all';
  const light = tone === 'light';

  const trigger = (
    <button
      type="button"
      role="combobox"
      aria-expanded={open}
      aria-label={`Empresa: ${label}. Mudar de empresa`}
      className={cn(
        'flex w-full min-h-12 items-center gap-3 rounded-2xl text-left text-[14px] font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2',
        light
          ? 'bg-white px-2.5 py-2 text-rz-ink shadow-rz-soft ring-1 ring-rz-line focus-visible:ring-rz-primary'
          : cn(
              'text-white focus-visible:ring-white/70',
              collapsed ? 'justify-center px-0 py-2' : 'px-2.5 py-2',
              open || scope !== SCOPE_ALL
                ? 'bg-white/[0.16] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]'
                : 'bg-white/[0.08] hover:bg-white/[0.12]'
            )
      )}
    >
      <CompanyTile entry={{ name: label, kind }} />
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1">
            <span
              className={cn(
                'block text-[10.5px] font-semibold uppercase leading-none tracking-[0.14em]',
                light ? 'text-rz-muted' : 'text-white/55'
              )}
            >
              Empresa
            </span>
            <span className="mt-1 block truncate leading-tight">{label}</span>
          </span>
          <ChevronsUpDown
            className={cn('h-4 w-4 shrink-0', light ? 'text-rz-muted' : 'text-white/60')}
            aria-hidden
          />
        </>
      )}
    </button>
  );

  return (
    <div className="px-3 pb-2 pt-1">
      <Popover open={open} onOpenChange={changeOpen}>
        {collapsed ? (
          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>{trigger}</PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="right" className="rounded-xl font-medium">
              {label}
            </TooltipContent>
          </Tooltip>
        ) : (
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        )}
        <PopoverContent
          side={collapsed ? 'right' : 'bottom'}
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className={cn('w-[min(21rem,calc(100vw-1.5rem))]', COMPANY_PANEL_CLASS)}
        >
          <CompanyPickerList
            sections={sections}
            value={scope}
            onPick={choose}
            query={query}
            onQueryChange={setQuery}
            placeholder="Procurar empresa ou grupo…"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};
