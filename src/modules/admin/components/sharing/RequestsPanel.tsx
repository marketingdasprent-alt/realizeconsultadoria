import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCapabilities, useShareRequests } from '../../hooks/useSharing';
import { useSharingAction } from '../../hooks/useSharingAction';
import { sortRequests, type RequestDirection, type ShareRequest } from '../../lib/sharing';
import { sharingService } from '../../services/sharingService';
import { ApproveRequestDialog } from './ApproveRequestDialog';
import { QueryState } from './QueryState';
import { ReauthDialog } from './ReauthDialog';
import { RequestRow } from './RequestRow';

const RequestList: React.FC<{ company: string; direction: RequestDirection }> = ({
  company,
  direction,
}) => {
  const query = useShareRequests(company, direction);
  const catalog = useCapabilities();
  const action = useSharingAction();
  const [approving, setApproving] = useState<ShareRequest | null>(null);
  const [rejecting, setRejecting] = useState<ShareRequest | null>(null);
  const [note, setNote] = useState('');

  const cancel = (request: ShareRequest) =>
    action.run(() => sharingService.cancelRequest(request.request_id), 'Pedido cancelado');

  const reject = async () => {
    if (!rejecting) return;
    const done = await action.run(
      () => sharingService.rejectRequest(rejecting.request_id, note.trim() || null),
      'Pedido recusado'
    );
    if (done) {
      setRejecting(null);
      setNote('');
    }
  };

  const requests = sortRequests(query.data ?? []);
  const received = direction === 'received';

  return (
    <>
      <QueryState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={requests.length === 0}
        emptyTitle={received ? 'Sem pedidos recebidos' : 'Sem pedidos enviados'}
        emptyHint={
          received
            ? 'Quando outra empresa usar o código da sua, o pedido aparece aqui para decidir.'
            : 'Use “Ligar a outra empresa” para pedir acesso ou oferecer o seu.'
        }
        onRetry={() => query.refetch()}
      >
        <ul className="space-y-3">
          {requests.map(request => (
            <RequestRow
              key={request.request_id}
              request={request}
              direction={direction}
              catalog={catalog.data ?? []}
              busy={action.pending}
              onApprove={setApproving}
              onReject={setRejecting}
              onCancel={cancel}
            />
          ))}
        </ul>
      </QueryState>

      <ApproveRequestDialog request={approving} onClose={() => setApproving(null)} />

      <Dialog
        open={!!rejecting}
        onOpenChange={next => !next && !action.pending && setRejecting(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Recusar o pedido de {rejecting?.other_company_name ?? 'esta empresa'}?
            </DialogTitle>
            <DialogDescription>A outra empresa vê que o pedido foi recusado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-note">Nota (opcional)</Label>
            <Textarea
              id="reject-note"
              value={note}
              onChange={e => setNote(e.target.value)}
              maxLength={300}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRejecting(null)} disabled={action.pending}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={reject} disabled={action.pending}>
              {action.pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Recusar pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ReauthDialog open={action.reauthOpen} onDone={action.finishReauth} />
    </>
  );
};

/** Pedidos de ligação entre empresas: os que recebeu (decide) e os que enviou (acompanha). */
export const RequestsPanel: React.FC<{ company: string }> = ({ company }) => (
  <Tabs defaultValue="received" className="w-full">
    <TabsList>
      <TabsTrigger value="received">Recebidos</TabsTrigger>
      <TabsTrigger value="sent">Enviados</TabsTrigger>
    </TabsList>
    <TabsContent value="received" className="mt-4">
      <RequestList company={company} direction="received" />
    </TabsContent>
    <TabsContent value="sent" className="mt-4">
      <RequestList company={company} direction="sent" />
    </TabsContent>
  </Tabs>
);
