import { useState } from 'react';
import { Check, ChevronsUpDown, Loader2, Plus, X } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { fold, sameText } from '@/lib/text';
import { useCatalog } from '../../hooks/useCatalog';
import type { CatalogKind } from '../../services/catalogService';

interface CatalogComboboxProps {
  kind: CatalogKind;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Nome no singular para "Criar …" (ex.: "função"). */
  noun: string;
}

/**
 * Escolha de um departamento ou função das listas geridas, com pesquisa. Se faltar, cria-se
 * ali mesmo ("Criar …") e fica na lista para as outras fichas.
 */
export const CatalogCombobox = ({
  kind,
  value,
  onChange,
  placeholder,
  noun,
}: CatalogComboboxProps) => {
  const { toast } = useToast();
  const { items, create } = useCatalog(kind);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const term = search.trim();
  const exists = items.some(item => sameText(item.name, term));
  // Valor antigo da ficha que (ainda) não está na lista: mostra-se para não se perder.
  const legacy = value && !items.some(item => item.name === value) ? value : null;

  const pick = (name: string) => {
    onChange(name);
    setOpen(false);
    setSearch('');
  };

  const createItem = async () => {
    try {
      const created = await create.mutateAsync(term);
      pick(created.name);
      toast({ title: 'Adicionado à lista', description: created.name });
    } catch (error: unknown) {
      toast({
        title: 'Não foi possível criar',
        description: error instanceof Error ? error.message : '',
        variant: 'destructive',
      });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between font-normal', !value && 'text-muted-foreground')}
        >
          <span className="truncate">{value || placeholder}</span>
          <span className="flex shrink-0 items-center gap-1">
            {value && (
              <X
                className="h-4 w-4 opacity-50 hover:opacity-100"
                aria-label="Limpar"
                onClick={event => {
                  event.stopPropagation();
                  onChange('');
                }}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command filter={(itemValue, query) => (fold(itemValue).includes(fold(query)) ? 1 : 0)}>
          <CommandInput placeholder="Procurar…" value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>Nada encontrado.</CommandEmpty>
            <CommandGroup>
              {legacy && (
                <CommandItem value={legacy} onSelect={() => pick(legacy)}>
                  <Check className="mr-2 h-4 w-4" />
                  {legacy}{' '}
                  <span className="ml-1 text-xs text-muted-foreground">(fora da lista)</span>
                </CommandItem>
              )}
              {items.map(item => (
                <CommandItem key={item.id} value={item.name} onSelect={() => pick(item.name)}>
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === item.name ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {item.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          {term && !exists && (
            <button
              type="button"
              onClick={createItem}
              disabled={create.isPending}
              className="flex w-full items-center gap-2 border-t px-3 py-2.5 text-left text-[13.5px] font-semibold text-rz-primary hover:bg-rz-primary-soft"
            >
              {create.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Criar {noun} "{term}"
            </button>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
};
