import React, { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useShares } from '../../hooks/useSharing';
import { useSharingAction } from '../../hooks/useSharingAction';
import type { Share } from '../../lib/sharing';
import { sharingService } from '../../services/sharingService';
import { EditSharesDialog, type EditTarget } from './EditSharesDialog';
import { QueryState } from './QueryState';
import { ReauthDialog } from './ReauthDialog';
import { ShareGroupCard } from './ShareGroupCard';

interface Bucket {
  key: string;
  otherId: string;
  otherName: string;
  direction: Share['direction'];
  shares: Share[];
}

/** Uma caixa por empresa e sentido; as dadas primeiro. */
const bucketize = (shares: readonly Share[]): Bucket[] => {
  const map = new Map<string, Bucket>();
  for (const share of shares) {
    const key = `${share.direction}:${share.other_company_id}`;
    const bucket = map.get(key) ?? {
      key,
      otherId: share.other_company_id,
      otherName: share.other_company_name,
      direction: share.direction,
      shares: [],
    };
    bucket.shares.push(share);
    map.set(key, bucket);
  }
  return [...map.values()].sort(
    (a, b) =>
      a.direction.localeCompare(b.direction) || a.otherName.localeCompare(b.otherName, 'pt-PT')
  );
};

/** "Quem tem acesso": o que a sua empresa dá e o que recebe, com edição e revogação. */
export const SharesPanel: React.FC<{ company: string }> = ({ company }) => {
  const [showRevoked, setShowRevoked] = useState(false);
  const query = useShares(company, showRevoked);
  const action = useSharingAction();
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [revoking, setRevoking] = useState<Share | null>(null);
  const [reason, setReason] = useState('');

  const buckets = useMemo(() => bucketize(query.data ?? []), [query.data]);

  const edit = (bucket: Bucket) =>
    setEditing({
      otherId: bucket.otherId,
      otherName: bucket.otherName,
      current: bucket.shares.filter(s => s.status !== 'revogado').map(s => s.capability),
    });

  const revoke = async () => {
    if (!revoking) return;
    const done = await action.run(
      () => sharingService.revokeShare(company, revoking.share_id, reason.trim() || null),
      'Partilha retirada'
    );
    if (done) {
      setRevoking(null);
      setReason('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Switch id="show-revoked" checked={showRevoked} onCheckedChange={setShowRevoked} />
        <Label htmlFor="show-revoked">Mostrar partilhas já retiradas</Label>
      </div>
      <QueryState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={buckets.length === 0}
        emptyTitle="Nenhuma empresa tem acesso"
        emptyHint="Quando aprovar um pedido, ou uma empresa lhe der acesso, aparece aqui."
        onRetry={() => query.refetch()}
      >
        <ul className="space-y-3">
          {buckets.map(bucket => (
            <ShareGroupCard
              key={bucket.key}
              otherName={bucket.otherName}
              direction={bucket.direction}
              shares={bucket.shares}
              busy={action.pending}
              onEdit={bucket.direction === 'dada' ? () => edit(bucket) : undefined}
              onRevoke={setRevoking}
              onConfirmLegacy={share =>
                action.run(
                  () => sharingService.confirmLegacyShare(company, share.share_id),
                  'Partilha confirmada'
                )
              }
            />
          ))}
        </ul>
      </QueryState>

      <EditSharesDialog company={company} target={editing} onClose={() => setEditing(null)} />

      <Dialog
        open={!!revoking}
        onOpenChange={next => !next && !action.pending && setRevoking(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Retirar esta partilha?</DialogTitle>
            <DialogDescription>
              {revoking?.capability_description ?? revoking?.capability} com{' '}
              {revoking?.other_company_name}. Deixa de funcionar logo a seguir; os dados que já
              estão no ecrã de outra pessoa mantêm-se até ela recarregar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="revoke-reason">Motivo (opcional)</Label>
            <Textarea
              id="revoke-reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              maxLength={300}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRevoking(null)} disabled={action.pending}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={revoke} disabled={action.pending}>
              {action.pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Retirar partilha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ReauthDialog open={action.reauthOpen} onDone={action.finishReauth} />
    </div>
  );
};
