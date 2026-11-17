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
import { cn } from '@/lib/utils';
import { fold } from '@/lib/text';
import { companyLabel, sortCompanies, type MyCompany } from '../../lib/sharing';

interface CompanyPickerProps {
  id: string;
  companies: readonly MyCompany[];
  /** O id da empresa escolhida. */
  value: string;
  onChange: (companyId: string) => void;
}

/**
 * Escolha da empresa, por ordem alfabética e com pesquisa: escreve-se parte do nome (sem contar
 * acentos nem maiúsculas) e a lista fica só com as que batem. Com 16 empresas, rolar a lista
 * inteira era lento.
 */
export const CompanyPicker: React.FC<CompanyPickerProps> = ({ id, companies, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const sorted = sortCompanies(companies);
  const current = sorted.find(company => company.company_id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">
            {current ? companyLabel(current.name) : 'Escolher empresa'}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command filter={(itemValue, query) => (fold(itemValue).includes(fold(query)) ? 1 : 0)}>
          <CommandInput placeholder="Procurar empresa…" />
          <CommandList>
            <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
            <CommandGroup>
              {sorted.map(company => (
                <CommandItem
                  key={company.company_id}
                  value={companyLabel(company.name)}
                  onSelect={() => {
                    onChange(company.company_id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4 shrink-0',
                      company.company_id === value ? 'opacity-100' : 'opacity-0'
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
  );
};
