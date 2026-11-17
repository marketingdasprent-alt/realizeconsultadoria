import React, { useState } from 'react';
import { Building2, Check, ChevronsUpDown, Layers } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { companyLabel, sortCompanies } from '@/lib/companyName';
import { fold } from '@/lib/text';
import { cn } from '@/lib/utils';
import { useCompanyScope } from '@/modules/admin/context/CompanyScopeContext';
import { SCOPE_ALL, companyScope, groupScope } from '@/modules/admin/lib/companyScope';

interface AdminCompanyScopeProps {
  /** Menu recolhido: só o ícone. */
  collapsed?: boolean;
  /** Fecha o menu do telemóvel depois de escolher. */
  onChosen?: () => void;
}

/**
 * "Empresa" no topo do menu do admin: escolhe-se uma vez e Colaboradores, Acessos e os outros
 * ecrãs mostram só essa empresa (ou todas as de um grupo). Só aparece com mais de uma empresa.
 */
export const AdminCompanyScope: React.FC<AdminCompanyScopeProps> = ({
  collapsed = false,
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
  const choose = (value: string) => {
    setScope(value);
    changeOpen(false);
    onChosen?.();
  };
  const filtered = scope !== SCOPE_ALL;
  const Icon = scope.startsWith('g:') ? Layers : Building2;

  const trigger = (
    <button
      type="button"
      role="combobox"
      aria-expanded={open}
      aria-label={`Empresa: ${label}. Mudar de empresa`}
      className={cn(
        'flex w-full min-h-11 items-center gap-3 rounded-2xl text-left text-[14px] font-medium text-white transition-colors',
        'bg-white/[0.10] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)] hover:bg-white/[0.16]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
        collapsed ? 'justify-center px-0' : 'px-2.5 py-2'
      )}
    >
      <span
        className={cn(
          'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
          filtered ? 'bg-white text-rz-ink' : 'bg-white/15 text-white'
        )}
        aria-hidden
      >
        <Icon className="h-4 w-4" />
      </span>
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
              Empresa
            </span>
            <span className="block truncate">{label}</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-white/60" aria-hidden />
        </>
      )}
    </button>
  );

  const sorted = sortCompanies(companies);

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
          className="w-[min(18rem,calc(100vw-2rem))] p-0"
        >
          <Command filter={(itemValue, q) => (fold(itemValue).includes(fold(q)) ? 1 : 0)}>
            <CommandInput
              placeholder="Procurar empresa ou grupo…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="Todas as empresas"
                  className="min-h-11 sm:min-h-0"
                  onSelect={() => choose(SCOPE_ALL)}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4 shrink-0',
                      scope === SCOPE_ALL ? 'opacity-100' : 'opacity-0'
                    )}
                    aria-hidden
                  />
                  <span className="truncate">Todas as empresas</span>
                </CommandItem>
              </CommandGroup>
              {groups.length > 0 && (
                <CommandGroup heading="Grupos">
                  {groups.map(group => (
                    <CommandItem
                      key={group.id}
                      value={group.name}
                      className="min-h-11 sm:min-h-0"
                      onSelect={() => choose(groupScope(group.id))}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4 shrink-0',
                          scope === groupScope(group.id) ? 'opacity-100' : 'opacity-0'
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate">{group.name}</span>
                      <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                        {group.companyIds.length} empresas
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              <CommandGroup heading="Empresas">
                {sorted.map(company => (
                  <CommandItem
                    key={company.id}
                    value={companyLabel(company.name)}
                    className="min-h-11 sm:min-h-0"
                    onSelect={() => choose(companyScope(company.id))}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4 shrink-0',
                        scope === companyScope(company.id) ? 'opacity-100' : 'opacity-0'
                      )}
                      aria-hidden
                    />
                    <span className="truncate">{companyLabel(company.name)}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};
