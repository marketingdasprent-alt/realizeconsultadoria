import React, { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { companyLabel, sortCompanies } from '@/lib/companyName';
import { cn } from '@/lib/utils';
import { fold } from '@/lib/text';

/** O valor da opção "Todas as empresas". */
export const ALL_COMPANIES = 'all';

interface CompanySelectProps {
  companies: readonly { id: string; name: string }[];
  /** O id da empresa escolhida (ou ALL_COMPANIES, com `allLabel`). */
  value: string;
  onChange: (companyId: string) => void;
  /** Com texto, a primeira opção é "todas" (ex.: "Todas as empresas"). */
  allLabel?: string;
  /** Outras opções fixas no fim (ex.: "Outro (sem empresa)"). */
  extra?: readonly { id: string; name: string }[];
  placeholder?: string;
  id?: string;
  'aria-label'?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Escolha de empresa, por ordem alfabética e com pesquisa: escreve-se parte do nome (sem contar
 * acentos nem maiúsculas) e a lista fica só com as que batem. Com 16 empresas, rolar a lista
 * inteira era lento. Serve para filtros ("Todas as empresas") e para campos de formulário.
 */
export const CompanySelect: React.FC<CompanySelectProps> = ({
  companies,
  value,
  onChange,
  allLabel,
  extra = [],
  placeholder = 'Escolher empresa',
  id,
  'aria-label': ariaLabel,
  disabled,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const sorted = sortCompanies(companies);
  const all = allLabel ? [{ id: ALL_COMPANIES, name: allLabel }] : [];
  const options = [...all, ...sorted, ...extra];
  const current = options.find(option => option.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', className)}
        >
          <span className={cn('truncate', !current && 'text-muted-foreground')}>
            {current ? companyLabel(current.name) : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[16rem] p-0" align="start">
        <Command filter={(itemValue, query) => (fold(itemValue).includes(fold(query)) ? 1 : 0)}>
          <CommandInput placeholder="Procurar empresa…" />
          <CommandList>
            <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
            <CommandGroup>
              {options.map(option => (
                <CommandItem
                  key={option.id}
                  value={companyLabel(option.name)}
                  onSelect={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4 shrink-0',
                      option.id === value ? 'opacity-100' : 'opacity-0'
                    )}
                    aria-hidden
                  />
                  <span className="truncate">{companyLabel(option.name)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
