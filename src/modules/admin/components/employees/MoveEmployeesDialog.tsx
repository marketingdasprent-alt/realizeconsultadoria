import React, { useMemo, useRef, useState } from 'react';
import { ArrowRightLeft, CheckCircle2, Info, Loader2, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CompanySelect } from '@/components/admin/CompanySelect';
import { useToast } from '@/hooks/use-toast';
import { companyLabel } from '@/lib/companyName';
import { useMoveAccess } from '../../hooks/useCompanyMembership';
import { useRefreshSharing } from '../../hooks/useSharing';
import {
  SKIP_REASON_TEXT,
  bulkItemError,
  bulkSummaryText,
  describePendingEffects,
  membershipErrorText,
  splitMovable,
  sumPendingEffects,
  transferTargets,
  type BulkTransferResult,
  type MovableEmployee,
  type PendingEffects,
  type TransferResult,
} from '../../lib/companyMembership';
import { companyMembershipService } from '../../services/companyMembershipService';

export interface MoveSubject extends MovableEmployee {
  /** Nome da empresa atual, para mostrar na lista. */
  companyName?: string;
}

interface MoveEmployeesDialogProps {
  /** As fichas a mover; vazio ou null fecha o diálogo. */
  employees: MoveSubject[] | null;
  onClose: () => void;
  /** Chamado assim que a base confirma (para voltar a ler a lista ou a ficha). */
  onMoved: () => void;
  /** Destino já decidido (ex.: "Adicionar colaboradores" na página da empresa): não se escolhe. */
  fixedDestination?: { id: string; name: string };
}

type Outcome = { destination: string } & (
  | { kind: 'single'; result: TransferResult; employee: MoveSubject }
  | { kind: 'bulk'; result: BulkTransferResult; names: Map<string, string> }
);

const EffectsList: React.FC<{ effects: PendingEffects }> = ({ effects }) => {
  const lines = describePendingEffects(effects);
  if (lines.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Não há tarefas, eventos, pastas nem conversas por rever.
      </p>
    );
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm">
      {lines.map(line => (
        <li key={line.key}>{line.text}</li>
      ))}
    </ul>
  );
};

const OutcomeView: React.FC<{ outcome: Outcome }> = ({ outcome }) => {
  const { destination } = outcome;
  if (outcome.kind === 'single')
    return (
      <div className="space-y-3">
        <p className="flex items-start gap-2 text-sm font-medium">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          {outcome.employee.name} passou para {destination}.
        </p>
        <div className="rounded-lg border bg-muted/40 p-3">
          <p className="mb-2 text-sm font-semibold">O que fica na empresa anterior</p>
          <EffectsList effects={outcome.result.pending_effects} />
          <p className="mt-2 text-xs text-muted-foreground">
            Tarefas, eventos e conversas ficam onde foram criados; as pastas atribuídas seguem a
            ficha e convém revê-las. O histórico de férias e ponto acompanha a pessoa.
          </p>
        </div>
      </div>
    );

  const { result, names } = outcome;
  return (
    <div className="space-y-3">
      <p className="flex items-start gap-2 text-sm font-medium">
        {result.failed === 0 ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        ) : (
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        )}
        {bulkSummaryText(result)} {result.ok > 0 && `para ${destination}`}
      </p>
      <ul className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-2 text-sm">
        {result.results.map(item => (
          <li key={item.employee_id} className="flex flex-col gap-0.5 rounded px-2 py-1">
            <span className="font-medium">{names.get(item.employee_id) ?? 'Colaborador'}</span>
            {item.ok ? (
              <span className="text-xs text-emerald-700">Movido</span>
            ) : (
              <span className="text-xs text-destructive">{bulkItemError(item)}</span>
            )}
          </li>
        ))}
      </ul>
      {result.ok > 0 && (
        <div className="rounded-lg border bg-muted/40 p-3">
          <p className="mb-2 text-sm font-semibold">O que fica por rever nas empresas anteriores</p>
          <EffectsList effects={sumPendingEffects(result.results)} />
        </div>
      )}
    </div>
  );
};

const MoveBody: React.FC<{
  employees: MoveSubject[];
  onClose: () => void;
  onMoved: () => void;
  fixedDestination?: { id: string; name: string };
}> = ({ employees: opened, onClose, onMoved, fixedDestination }) => {
  // As fichas ficam como estavam ao abrir: depois de mover, a lista muda mas o resumo não.
  const [employees] = useState(opened);
  const access = useMoveAccess();
  const { toast } = useToast();
  const refreshSharing = useRefreshSharing();
  const [target, setTarget] = useState(fixedDestination?.id ?? '');
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const { movable, skipped } = useMemo(
    () => splitMovable(employees, access.companies),
    [employees, access.companies]
  );
  const destinations = useMemo(
    () =>
      fixedDestination
        ? []
        : transferTargets(access.companies, movable.length ? movable : employees),
    [fixedDestination, access.companies, movable, employees]
  );
  const destinationName = companyLabel(
    fixedDestination?.name ??
      destinations.find(company => company.company_id === target)?.name ??
      ''
  );

  const submit = async () => {
    // O ref apanha o duplo clique antes de o botão chegar a ficar desativado
    if (!target || movable.length === 0 || submitting.current) return;
    submitting.current = true;
    setPending(true);
    try {
      if (movable.length === 1) {
        const result = await companyMembershipService.transferEmployee(movable[0].id, target);
        setOutcome({ kind: 'single', result, employee: movable[0], destination: destinationName });
      } else {
        const result = await companyMembershipService.transferEmployees(
          movable.map(employee => employee.id),
          target
        );
        setOutcome({
          kind: 'bulk',
          result,
          names: new Map(movable.map(employee => [employee.id, employee.name])),
          destination: destinationName,
        });
      }
      // A ficha mudou de empresa: a lista (ou a ficha) e o que depende das empresas voltam a ser lidos.
      onMoved();
      void refreshSharing();
    } catch (error) {
      toast({
        title: 'Não foi possível mover',
        description: membershipErrorText(error),
        variant: 'destructive',
      });
    } finally {
      submitting.current = false;
      setPending(false);
    }
  };

  const single = employees.length === 1 ? employees[0] : null;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5" />
          {fixedDestination
            ? `Adicionar ${employees.length === 1 ? employees[0].name : `${employees.length} colaboradores`} a ${destinationName}`
            : single
              ? `Mover ${single.name} para outra empresa`
              : `Mover ${employees.length} colaboradores para outra empresa`}
        </DialogTitle>
        <DialogDescription>
          A pessoa muda de empresa e passa a aparecer na empresa de destino.
        </DialogDescription>
      </DialogHeader>

      {outcome ? (
        <OutcomeView outcome={outcome} />
      ) : (
        <div className="space-y-4">
          {single?.companyName && (
            <p className="text-sm text-muted-foreground">
              Empresa atual: <strong>{companyLabel(single.companyName)}</strong>
            </p>
          )}

          {skipped.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
              <p className="mb-1 flex items-center gap-2 font-semibold text-amber-900">
                <TriangleAlert className="h-4 w-4" /> Não vão ser movidos
              </p>
              <ul className="list-disc space-y-0.5 pl-5 text-amber-900">
                {skipped.map(({ employee, reason }) => (
                  <li key={employee.id}>
                    {employee.name}: {SKIP_REASON_TEXT[reason]}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {fixedDestination ? (
            <p className="text-sm text-muted-foreground">
              Empresa de destino: <strong>{destinationName}</strong>
            </p>
          ) : (
            <div className="space-y-1.5">
              <label htmlFor="move-target" className="text-sm font-medium">
                Empresa de destino
              </label>
              <CompanySelect
                id="move-target"
                companies={destinations.map(company => ({
                  id: company.company_id,
                  name: company.name,
                }))}
                value={target}
                onChange={setTarget}
                placeholder="Escolher a empresa"
                disabled={pending || access.isLoading || movable.length === 0}
              />
              {!access.isLoading && destinations.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Não há outra empresa que administre para onde mover.
                </p>
              )}
            </div>
          )}

          <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <ul className="list-disc space-y-1 pl-4">
              <li>
                O histórico de férias e de ponto acompanha a pessoa e continua visível para ela.
              </li>
              <li>Tarefas, eventos e conversas ficam na empresa onde foram criados.</li>
              <li>Só pode mover para empresas que administra.</li>
            </ul>
          </div>
        </div>
      )}

      <DialogFooter className="gap-2 sm:gap-0">
        {outcome ? (
          <Button variant="gold" onClick={onClose}>
            Fechar
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button
              variant="gold"
              onClick={submit}
              disabled={pending || !target || movable.length === 0}
            >
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {movable.length > 1 ? `Mover ${movable.length} colaboradores` : 'Mover'}
            </Button>
          </>
        )}
      </DialogFooter>
    </>
  );
};

/** "Mover para empresa…": uma ficha ou várias; mostra depois o que fica por tratar. */
export const MoveEmployeesDialog: React.FC<MoveEmployeesDialogProps> = ({
  employees,
  onClose,
  onMoved,
  fixedDestination,
}) => {
  const open = !!employees && employees.length > 0;
  return (
    <Dialog open={open} onOpenChange={next => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        {open && employees && (
          <MoveBody
            key={employees.map(employee => employee.id).join(',')}
            employees={employees}
            onClose={onClose}
            onMoved={onMoved}
            fixedDestination={fixedDestination}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
