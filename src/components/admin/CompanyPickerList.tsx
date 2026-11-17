import React from 'react';
import { Command as CommandPrimitive } from 'cmdk';
import { Building2, Check, Layers, Search } from 'lucide-react';
import { companyInitials, companyLabel } from '@/lib/companyName';
import { fold } from '@/lib/text';
import { cn } from '@/lib/utils';
import { ModuleIcon } from '@/modules/workspace/components/ModuleIcon';

export interface CompanyPickerEntry {
  id: string;
  name: string;
  /** 'all' (todas), 'group' (grupo de empresas) ou 'company' (uma empresa). */
  kind: 'all' | 'group' | 'company';
  /** Texto à direita (ex.: "11 empresas"). */
  meta?: string;
}

export interface CompanyPickerSection {
  key: string;
  heading?: string;
  entries: CompanyPickerEntry[];
}

interface CompanyPickerListProps {
  sections: CompanyPickerSection[];
  value: string;
  onPick: (id: string) => void;
  query: string;
  onQueryChange: (query: string) => void;
  placeholder: string;
}

const ALL_TINT = 'from-sky-400 to-blue-600';
const GROUP_TINT = 'from-amber-400 to-orange-500';

/** O mosaico de cada linha: o mesmo estilo dos ícones do menu (empresas levam as iniciais). */
export const CompanyTile: React.FC<{ entry: Pick<CompanyPickerEntry, 'name' | 'kind'> }> = ({
  entry,
}) =>
  entry.kind === 'company' ? (
    <span
      aria-hidden
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-rz-primary-soft text-[11px] font-bold text-rz-primary"
    >
      {companyInitials(entry.name)}
    </span>
  ) : (
    <ModuleIcon
      module={
        entry.kind === 'group'
          ? { icon: Layers, tint: GROUP_TINT }
          : { icon: Building2, tint: ALL_TINT }
      }
      size="sm"
    />
  );

/**
 * A lista de empresas e grupos com pesquisa, no aspeto do resto do sistema (como o menu da
 * conta): painel arredondado, cartões brancos, mosaicos coloridos e barra de rolagem discreta.
 * Serve ao seletor do menu e aos filtros de empresa das páginas.
 */
export const CompanyPickerList: React.FC<CompanyPickerListProps> = ({
  sections,
  value,
  onPick,
  query,
  onQueryChange,
  placeholder,
}) => (
  <CommandPrimitive
    filter={(itemValue, search) => (fold(itemValue).includes(fold(search)) ? 1 : 0)}
    className="flex flex-col gap-2 bg-transparent text-rz-ink"
  >
    <label className="flex h-11 items-center gap-2.5 rounded-full bg-white px-4 text-rz-muted shadow-rz-soft ring-1 ring-rz-line focus-within:ring-2 focus-within:ring-rz-primary/40">
      <Search className="h-4 w-4 shrink-0" aria-hidden />
      <CommandPrimitive.Input
        value={query}
        onValueChange={onQueryChange}
        placeholder={placeholder}
        className="w-full bg-transparent text-[14px] text-rz-ink outline-none placeholder:text-rz-muted"
      />
    </label>
    <CommandPrimitive.List className="rz-scroll max-h-[min(20rem,55vh)] space-y-2 overflow-y-auto overscroll-contain">
      <CommandPrimitive.Empty className="rounded-[20px] bg-white px-3 py-6 text-center text-[13px] text-rz-muted shadow-rz-soft">
        Nenhuma empresa encontrada.
      </CommandPrimitive.Empty>
      {sections.map(section => (
        <CommandPrimitive.Group
          key={section.key}
          heading={section.heading}
          className={cn(
            'rounded-[20px] bg-white p-1.5 shadow-rz-soft',
            '[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-1.5',
            '[&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase',
            '[&_[cmdk-group-heading]]:tracking-[0.14em] [&_[cmdk-group-heading]]:text-rz-muted'
          )}
        >
          {section.entries.map(entry => {
            const active = entry.id === value;
            return (
              <CommandPrimitive.Item
                key={entry.id}
                value={companyLabel(entry.name)}
                onSelect={() => onPick(entry.id)}
                className={cn(
                  'flex min-h-11 cursor-pointer select-none items-center gap-2.5 rounded-xl px-2 py-1.5 text-[13.5px] font-medium outline-none sm:min-h-10',
                  'data-[selected=true]:bg-rz-canvas',
                  active && 'font-bold text-rz-primary'
                )}
              >
                <CompanyTile entry={entry} />
                <span className="min-w-0 flex-1 truncate">{companyLabel(entry.name)}</span>
                {entry.meta && (
                  <span className="shrink-0 text-xs font-medium text-rz-muted">{entry.meta}</span>
                )}
                <Check
                  className={cn('h-4 w-4 shrink-0', active ? 'opacity-100' : 'opacity-0')}
                  aria-hidden
                />
              </CommandPrimitive.Item>
            );
          })}
        </CommandPrimitive.Group>
      ))}
    </CommandPrimitive.List>
  </CommandPrimitive>
);

/** Classes do painel que abre (as mesmas dos outros menus do sistema). */
export const COMPANY_PANEL_CLASS = 'rounded-[28px] border-white/60 bg-rz-canvas p-2 shadow-rz-pop';
