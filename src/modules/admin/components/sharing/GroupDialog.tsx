import React, { useId, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMembershipAction } from '../../hooks/useCompanyMembership';
import { useCapabilities } from '../../hooks/useSharing';
import {
  GROUP_DEFAULT_CAPABILITIES,
  companyAvailability,
  groupableCapabilities,
  type GroupOverview,
  type GroupOverviewRow,
  type MyCompany,
} from '../../lib/sharing';
import { sharingService } from '../../services/sharingService';
import { CapabilityPicker } from './CapabilityPicker';
import { GroupCompanyChecklist } from './GroupCompanyChecklist';
import { QueryState } from './QueryState';
import { ReauthDialog } from './ReauthDialog';

export type GroupDialogState =
  | { kind: 'create' }
  | { kind: 'rename' | 'members' | 'capabilities'; group: GroupOverview };

interface GroupDialogProps {
  state: GroupDialogState | null;
  rows: readonly GroupOverviewRow[];
  companies: readonly MyCompany[];
  onClose: () => void;
}

const SUCCESS = {
  create: 'Grupo criado',
  rename: 'Grupo renomeado',
  members: 'Empresas do grupo atualizadas',
  capabilities: 'Módulos do grupo atualizados',
} as const;

const SUBMIT_LABEL = {
  create: 'Criar grupo',
  rename: 'Guardar',
  members: 'Guardar',
  capabilities: 'Guardar',
} as const;

const DESCRIPTION = {
  create: 'Um grupo junta duas ou mais empresas. Cada empresa fica em, no máximo, um grupo.',
  rename: 'O nome só serve para o reconhecer: não muda nada às partilhas.',
  members: 'Junte ou retire empresas. Cada empresa fica em, no máximo, um grupo.',
  capabilities: 'O que as empresas do grupo veem umas das outras, só em leitura.',
} as const;

const GroupDialogBody: React.FC<Omit<GroupDialogProps, 'state'> & { state: GroupDialogState }> = ({
  state,
  rows,
  companies,
  onClose,
}) => {
  const nameId = useId();
  const action = useMembershipAction();
  const submitting = useRef(false);
  const group = state.kind === 'create' ? null : state.group;
  const { kind } = state;

  const showName = kind === 'create' || kind === 'rename';
  const showCompanies = kind === 'create' || kind === 'members';
  const showCaps = kind === 'create' || kind === 'capabilities';

  const [name, setName] = useState(group?.name ?? '');
  const [selected, setSelected] = useState<string[]>(
    group ? group.members.map(member => member.companyId) : []
  );
  const [caps, setCaps] = useState<string[]>(
    group ? group.defaultCapabilities : [...GROUP_DEFAULT_CAPABILITIES]
  );
  const catalog = useCapabilities(showCaps);

  const items = useMemo(
    () => companyAvailability(companies, rows, group?.id ?? null),
    [companies, rows, group]
  );
  // As empresas por ordem da lista (e as do grupo que a lista não traga, no fim)
  const chosen = useMemo(() => {
    const listed = items.map(item => item.id);
    return [
      ...listed.filter(id => selected.includes(id)),
      ...selected.filter(id => !listed.includes(id)),
    ];
  }, [items, selected]);
  const removing = group
    ? group.members.filter(member => !selected.includes(member.companyId)).length
    : 0;
  const groupable = useMemo(() => groupableCapabilities(catalog.data ?? []), [catalog.data]);

  const nameOk = !showName || name.trim().length > 0;
  const companiesOk = !showCompanies || chosen.length >= 2;
  // Só ao mudar os módulos é que a lista do catálogo tem de estar à vista
  const capsOk = kind !== 'capabilities' || (!!catalog.data && !catalog.error);
  const canSubmit = nameOk && companiesOk && capsOk && !action.pending;

  const call = () => {
    if (kind === 'create') return sharingService.createGroup(name.trim(), chosen, caps);
    if (!group) return Promise.resolve(undefined);
    if (kind === 'rename') return sharingService.renameGroup(group.id, name.trim());
    if (kind === 'members') return sharingService.setGroupMembers(group.id, chosen);
    return sharingService.setGroupCapabilities(group.id, caps);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    // O ref apanha o duplo clique antes de o botão chegar a ficar desativado
    if (!canSubmit || submitting.current) return;
    submitting.current = true;
    try {
      const done = await action.run(call, SUCCESS[kind]);
      if (done) onClose();
    } finally {
      submitting.current = false;
    }
  };

  const title =
    kind === 'create'
      ? 'Novo grupo'
      : kind === 'rename'
        ? 'Renomear grupo'
        : kind === 'members'
          ? `Gerir empresas de ${group?.name}`
          : `Módulos de ${group?.name}`;

  return (
    <>
      {/* Fora do <form>: o diálogo tem o seu próprio formulário e o submit não pode subir até aqui */}
      <ReauthDialog open={action.reauthOpen} onDone={action.finishReauth} />
      <form onSubmit={submit} className="space-y-4">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{DESCRIPTION[kind]}</DialogDescription>
        </DialogHeader>

        {showName && (
          <div className="space-y-1.5">
            <Label htmlFor={nameId}>Nome do grupo</Label>
            <Input
              id={nameId}
              value={name}
              maxLength={80}
              disabled={action.pending}
              onChange={event => setName(event.target.value)}
            />
          </div>
        )}

        {showCompanies && (
          <div className="space-y-2">
            <GroupCompanyChecklist
              idPrefix={`${nameId}-empresa`}
              items={items}
              value={selected}
              onChange={setSelected}
              disabled={action.pending}
            />
            {chosen.length < 2 && (
              <p className="text-xs text-muted-foreground">Escolha pelo menos 2 empresas.</p>
            )}
            {kind === 'members' && chosen.length < 2 && (
              <p className="text-xs text-muted-foreground">
                Um grupo precisa de pelo menos 2 empresas. Para o terminar, use Dissolver.
              </p>
            )}
            {removing > 0 && (
              <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                Ao retirar uma empresa, as partilhas dela com as outras empresas do grupo são
                revogadas.
              </p>
            )}
          </div>
        )}

        {showCaps && (
          <div className="space-y-2">
            <p className="text-sm font-semibold">Módulos do grupo</p>
            <QueryState
              isLoading={catalog.isLoading}
              error={catalog.error}
              isEmpty={groupable.length === 0}
              emptyTitle="Não há módulos que um grupo possa mostrar"
              onRetry={() => catalog.refetch()}
            >
              <CapabilityPicker
                idPrefix={`${nameId}-modulo`}
                catalog={groupable}
                value={caps}
                onChange={setCaps}
                disabled={action.pending}
              />
            </QueryState>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={action.pending}>
            Cancelar
          </Button>
          <Button type="submit" variant="gold" disabled={!canSubmit}>
            {action.pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {SUBMIT_LABEL[kind]}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
};

/** Criar, renomear, gerir as empresas e os módulos de um grupo (só Super Admin). */
export const GroupDialog: React.FC<GroupDialogProps> = ({ state, onClose, ...rest }) => (
  <Dialog open={!!state} onOpenChange={next => !next && onClose()}>
    <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
      {/* O corpo só existe aberto e nasce de novo por grupo e tipo */}
      {state && (
        <GroupDialogBody
          key={`${state.kind}-${state.kind === 'create' ? 'novo' : state.group.id}`}
          state={state}
          onClose={onClose}
          {...rest}
        />
      )}
    </DialogContent>
  </Dialog>
);
