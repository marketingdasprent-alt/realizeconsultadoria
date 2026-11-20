import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { compareText, matchesText } from '@/lib/text';
import { cn } from '@/lib/utils';
import { descendantsOf, type ChainLink } from '@/lib/managerChain';

interface Candidate extends ChainLink {
  name: string;
  position: string | null;
}

interface ManagerSelectProps {
  companyId: string;
  /** Ficha aberta (null ao criar): não pode ser responsável de si nem de quem a chefia. */
  employeeId: string | null;
  /** Id do responsável direto ('' = sem responsável). */
  value: string;
  onChange: (managerId: string) => void;
  /** Alcance de equipa: só estas pessoas podem ser escolhidas e "sem responsável" não aparece. */
  allowedIds?: ReadonlySet<string> | null;
  id?: string;
}

const NONE = '';

/** Colaboradores ativos da empresa, com a chefia, para escolher o responsável direto. */
const useCandidates = (companyId: string) =>
  useQuery({
    queryKey: ['manager-candidates', companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<Candidate[]> => {
      // manager_id ainda não está nos tipos gerados até à migração do chefe de equipa.
      const untyped: SupabaseClient = supabase;
      const { data, error } = await untyped
        .from('employees')
        .select('id, name, position, manager_id')
        .eq('company_id', companyId)
        .eq('is_active', true);
      if (error) throw error;
      return ((data ?? []) as Candidate[]).sort((a, b) => compareText(a.name, b.name));
    },
  });

/**
 * Responsável direto: quem chefia o colaborador. Define a equipa de cada chefe (permissões com
 * "Só a minha equipa") e a árvore do organograma. Lista só a mesma empresa e esconde escolhas que
 * criariam um ciclo (a própria pessoa e quem está abaixo dela).
 */
export const ManagerSelect = ({
  companyId,
  employeeId,
  value,
  onChange,
  allowedIds,
  id,
}: ManagerSelectProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { data: candidates = [], isLoading, isError, refetch } = useCandidates(companyId);

  const options = useMemo(() => {
    const below = employeeId ? descendantsOf(employeeId, candidates) : new Set<string>();
    return candidates.filter(
      c =>
        c.id !== employeeId &&
        !below.has(c.id) &&
        (!allowedIds || allowedIds.has(c.id) || c.id === value)
    );
  }, [candidates, employeeId, allowedIds, value]);
  const visible = options.filter(c => matchesText(query, c.name, c.position));
  const current = candidates.find(c => c.id === value);
  const allowNone = !allowedIds;

  const pick = (managerId: string) => {
    onChange(managerId);
    setOpen(false);
    setQuery('');
  };

  if (!companyId) {
    return (
      <Button id={id} type="button" variant="outline" disabled className="w-full justify-between">
        <span className="truncate text-muted-foreground">Escolha primeiro a empresa</span>
      </Button>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={next => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn('truncate', !current && 'text-muted-foreground')}>
            {current ? current.name : value && isLoading ? 'A carregar…' : 'Sem responsável direto'}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] min-w-[18rem] rounded-2xl p-2"
        align="start"
        sideOffset={6}
        collisionPadding={12}
      >
        <input
          autoFocus
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Procurar pessoa ou função…"
          aria-label="Procurar responsável direto"
          className="mb-2 h-10 w-full rounded-full bg-muted px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div role="listbox" aria-label="Responsável direto" className="max-h-72 overflow-y-auto">
          {isLoading ? (
            <p className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> A carregar colaboradores…
            </p>
          ) : isError ? (
            <div className="px-3 py-4 text-sm">
              <p className="text-destructive">Não foi possível carregar os colaboradores.</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-1 h-9 rounded-full px-3"
                onClick={() => refetch()}
              >
                Tentar outra vez
              </Button>
            </div>
          ) : (
            <>
              {allowNone && !query.trim() && (
                <Option selected={value === NONE} onPick={() => pick(NONE)}>
                  <span className="text-muted-foreground">Sem responsável direto</span>
                </Option>
              )}
              {visible.map(candidate => (
                <Option
                  key={candidate.id}
                  selected={candidate.id === value}
                  onPick={() => pick(candidate.id)}
                >
                  <span className="block truncate">{candidate.name}</span>
                  {candidate.position && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {candidate.position}
                    </span>
                  )}
                </Option>
              ))}
              {visible.length === 0 && (
                <p className="px-3 py-4 text-sm text-muted-foreground">
                  {query.trim()
                    ? 'Ninguém com esse nome nesta empresa.'
                    : 'Não há outros colaboradores ativos nesta empresa.'}
                </p>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

const Option = ({
  selected,
  onPick,
  children,
}: {
  selected: boolean;
  onPick: () => void;
  children: ReactNode;
}) => (
  <button
    type="button"
    role="option"
    aria-selected={selected}
    onClick={onPick}
    className={cn(
      'flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-1.5 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none',
      selected && 'font-semibold'
    )}
  >
    <span className="min-w-0 flex-1">{children}</span>
    {selected && <Check className="h-4 w-4 shrink-0 text-rz-primary" aria-hidden />}
  </button>
);
