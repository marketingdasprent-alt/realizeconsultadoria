import React, { useState } from 'react';
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
import { useCapabilities } from '../../hooks/useSharing';
import { useSharingAction } from '../../hooks/useSharingAction';
import { sharingService } from '../../services/sharingService';
import { CapabilityPicker } from './CapabilityPicker';
import { QueryState } from './QueryState';
import { ReauthDialog } from './ReauthDialog';

export interface EditTarget {
  otherId: string;
  otherName: string;
  /** Permissões ativas agora. */
  current: string[];
}

interface EditSharesDialogProps {
  company: string;
  target: EditTarget | null;
  onClose: () => void;
}

/** O dono define o conjunto completo de permissões que a outra empresa passa a ter. */
export const EditSharesDialog: React.FC<EditSharesDialogProps> = ({ company, target, onClose }) => {
  const catalog = useCapabilities();
  const action = useSharingAction();
  const [value, setValue] = useState<string[]>([]);
  const [lastTarget, setLastTarget] = useState<string | null>(null);

  if (target && target.otherId !== lastTarget) {
    setLastTarget(target.otherId);
    setValue(target.current);
  }

  const data = catalog.data ?? [];
  const unchanged =
    !!target &&
    value.length === target.current.length &&
    value.every(item => target.current.includes(item));

  const save = async () => {
    if (!target || unchanged) return;
    const done = await action.run(
      () => sharingService.setShares(company, target.otherId, value),
      'Permissões atualizadas'
    );
    if (done) onClose();
  };

  return (
    <Dialog open={!!target} onOpenChange={next => !next && !action.pending && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>O que {target?.otherName} pode ver ou fazer</DialogTitle>
          <DialogDescription>
            Marque o que quer manter. O que desmarcar deixa de estar disponível logo a seguir.
          </DialogDescription>
        </DialogHeader>
        <QueryState
          isLoading={catalog.isLoading}
          error={catalog.error}
          isEmpty={data.length === 0}
          emptyTitle="Não há permissões para partilhar"
          onRetry={() => catalog.refetch()}
        >
          <CapabilityPicker idPrefix="edit" catalog={data} value={value} onChange={setValue} />
        </QueryState>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={action.pending}>
            Cancelar
          </Button>
          <Button variant="gold" onClick={save} disabled={action.pending || unchanged}>
            {action.pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
        <ReauthDialog open={action.reauthOpen} onDone={action.finishReauth} />
      </DialogContent>
    </Dialog>
  );
};
