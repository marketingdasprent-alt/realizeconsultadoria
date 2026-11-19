import React, { useId, useMemo, useState } from 'react';
import { Search, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { companyLabel } from '@/lib/companyName';
import { QueryState } from './sharing/QueryState';
import { useEmployeesOutsideCompany, useMoveAccess } from '../hooks/useCompanyMembership';
import {
  SKIP_REASON_TEXT,
  filterByName,
  splitMovable,
  type CompanyEmployee,
  type SkipReason,
} from '../lib/companyMembership';

interface PickerBodyProps {
  company: { id: string; name: string };
  onClose: () => void;
  onContinue: (selected: CompanyEmployee[]) => void;
}

const PickerBody: React.FC<PickerBodyProps> = ({ company, onClose, onContinue }) => {
  const searchId = useId();
  const query = useEmployeesOutsideCompany(company.id, true);
  const access = useMoveAccess();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const all = useMemo(() => query.data ?? [], [query.data]);
  // Quais se podem mover e porque não (empresa que não administra, ficha sem conta…)
  const reasons = useMemo(() => {
    const map = new Map<string, SkipReason>();
    for (const { employee, reason } of splitMovable(all, access.companies).skipped)
      map.set(employee.id, reason);
    return map;
  }, [all, access.companies]);
  const visible = useMemo(() => filterByName(all, search), [all, search]);

  const toggle = (id: string, on: boolean) =>
    setSelected(current => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const chosen = all.filter(employee => selected.has(employee.id));

  return (
    <>
      <DialogHeader>
        <DialogTitle>Adicionar colaboradores a {companyLabel(company.name)}</DialogTitle>
        <DialogDescription>
          Escolha as fichas ativas de outras empresas que passam a ser desta. Cada pessoa tem sempre
          uma só empresa.
        </DialogDescription>
      </DialogHeader>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"
          aria-hidden
        />
        <Input
          id={searchId}
          className="pl-9"
          value={search}
          onChange={event => setSearch(event.target.value)}
          aria-label="Pesquisar colaboradores de outras empresas"
          placeholder="Pesquisar por nome"
        />
      </div>

      <div className="max-h-[50vh] overflow-y-auto">
        <QueryState
          isLoading={query.isLoading || access.isLoading}
          error={query.error}
          isEmpty={all.length === 0}
          emptyTitle="Não há colaboradores noutras empresas"
          emptyHint="Todas as fichas ativas já são desta empresa."
          onRetry={() => query.refetch()}
        >
          {visible.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum colaborador com esse nome.
            </p>
          ) : (
            <ul className="space-y-1">
              {visible.map(employee => {
                const reason = reasons.get(employee.id);
                const rowId = `${searchId}-${employee.id}`;
                const hintId = `${rowId}-hint`;
                return (
                  <li
                    key={employee.id}
                    className="flex items-start gap-3 rounded-lg border px-3 py-2"
                  >
                    <Checkbox
                      id={rowId}
                      className="mt-1"
                      aria-label={employee.name}
                      aria-describedby={reason ? hintId : undefined}
                      disabled={!!reason}
                      checked={selected.has(employee.id)}
                      onCheckedChange={value => toggle(employee.id, value === true)}
                    />
                    <div className="min-w-0 flex-1">
                      <label htmlFor={rowId} className="block cursor-pointer truncate font-medium">
                        {employee.name}
                      </label>
                      <p className="truncate text-xs text-muted-foreground">
                        {[
                          employee.companyName && companyLabel(employee.companyName),
                          employee.email,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      {reason && (
                        <p
                          id={hintId}
                          className="mt-0.5 flex items-center gap-1 text-xs text-amber-800"
                        >
                          <TriangleAlert className="h-3 w-3" aria-hidden /> Não se pode mover:{' '}
                          {SKIP_REASON_TEXT[reason]}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </QueryState>
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="gold"
          disabled={chosen.length === 0}
          onClick={() => onContinue(chosen)}
        >
          Continuar{chosen.length > 0 ? ` (${chosen.length})` : ''}
        </Button>
      </DialogFooter>
    </>
  );
};

interface CompanyEmployeePickerProps extends Omit<PickerBodyProps, 'onClose'> {
  open: boolean;
  onClose: () => void;
}

/** Seletor com pesquisa e multi-seleção das fichas ativas de outras empresas. */
export const CompanyEmployeePicker: React.FC<CompanyEmployeePickerProps> = ({
  open,
  onClose,
  ...body
}) => (
  <Dialog open={open} onOpenChange={next => !next && onClose()}>
    <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
      {/* O corpo só existe aberto: a seleção e a pesquisa recomeçam de cada vez */}
      {open && <PickerBody {...body} onClose={onClose} />}
    </DialogContent>
  </Dialog>
);
