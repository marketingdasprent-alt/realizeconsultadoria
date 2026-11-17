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
import { capabilityLabel, type ShareRequest } from '../../lib/sharing';
import { sharingService } from '../../services/sharingService';
import { CapabilityPicker } from './CapabilityPicker';
import { QueryState } from './QueryState';
import { ReauthDialog } from './ReauthDialog';

interface ApproveRequestDialogProps {
  request: ShareRequest | null;
  onClose: () => void;
}

/** B decide o que concede a A. Pode ser nada, se A só oferece. */
export const ApproveRequestDialog: React.FC<ApproveRequestDialogProps> = ({ request, onClose }) => {
  const catalog = useCapabilities();
  const action = useSharingAction();
  const [grant, setGrant] = useState<string[]>([]);
  const [lastRequest, setLastRequest] = useState<string | null>(null);

  // Cada pedido abre com as permissões pedidas já marcadas.
  if (request && request.request_id !== lastRequest) {
    setLastRequest(request.request_id);
    setGrant(request.ask);
  }

  const data = catalog.data ?? [];
  const nothingToGrant = grant.length === 0 && (request?.offer.length ?? 0) === 0;

  const approve = async () => {
    if (!request || nothingToGrant) return;
    const done = await action.run(
      () => sharingService.approveRequest(request.request_id, grant),
      'Pedido aprovado'
    );
    if (done) onClose();
  };

  return (
    <Dialog open={!!request} onOpenChange={next => !next && !action.pending && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Aprovar pedido de {request?.other_company_name ?? 'outra empresa'}
          </DialogTitle>
          <DialogDescription>
            Escolha o que esta empresa passa a ver ou fazer nos dados da sua. Pode retirar qualquer
            permissão mais tarde em “Quem tem acesso”.
          </DialogDescription>
        </DialogHeader>

        {request && request.offer.length > 0 && (
          <section className="rounded-md bg-muted p-3 text-sm">
            <p className="font-semibold">Oferece-lhe</p>
            <ul className="list-disc pl-5">
              {request.offer.map(item => (
                <li key={item}>{capabilityLabel(item, data)}</li>
              ))}
            </ul>
          </section>
        )}

        <QueryState
          isLoading={catalog.isLoading}
          error={catalog.error}
          isEmpty={data.length === 0}
          emptyTitle="Não há permissões para partilhar"
          onRetry={() => catalog.refetch()}
        >
          <section className="space-y-2">
            <h3 className="font-semibold">O que concede a esta empresa</h3>
            <CapabilityPicker idPrefix="grant" catalog={data} value={grant} onChange={setGrant} />
          </section>
        </QueryState>
        {nothingToGrant && (
          <p role="alert" className="text-sm text-destructive">
            Escolha pelo menos uma permissão para conceder.
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={action.pending}>
            Cancelar
          </Button>
          <Button variant="gold" onClick={approve} disabled={action.pending || nothingToGrant}>
            {action.pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Aprovar
          </Button>
        </DialogFooter>
        <ReauthDialog open={action.reauthOpen} onDone={action.finishReauth} />
      </DialogContent>
    </Dialog>
  );
};
