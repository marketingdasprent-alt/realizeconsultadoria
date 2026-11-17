import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { needsLegacyConfirmation, type Share } from '../../lib/sharing';

interface ShareGroupCardProps {
  otherName: string;
  direction: Share['direction'];
  shares: Share[];
  busy: boolean;
  onEdit?: () => void;
  onRevoke: (share: Share) => void;
  onConfirmLegacy: (share: Share) => void;
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('pt-PT');

const ShareLine: React.FC<{
  share: Share;
  busy: boolean;
  onRevoke: (share: Share) => void;
  onConfirmLegacy: (share: Share) => void;
}> = ({ share, busy, onRevoke, onConfirmLegacy }) => (
  <li className="flex flex-wrap items-center justify-between gap-2 py-2">
    <div className="min-w-0">
      <p className="text-sm">{share.capability_description ?? share.capability}</p>
      <p className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
        {share.status === 'pedido' && <span>À espera da aprovação da outra empresa</span>}
        {share.status === 'revogado' && share.revoked_at && (
          <span>Revogada a {formatDate(share.revoked_at)}</span>
        )}
        {share.origin === 'legado' && <span>Já existia antes desta área</span>}
        {share.legacy_due_at && !share.legacy_confirmed_at && (
          <span>Confirmar até {formatDate(share.legacy_due_at)}</span>
        )}
        {share.sensitive && <span>Sensível</span>}
      </p>
    </div>
    {share.status !== 'revogado' && (
      <div className="flex gap-2">
        {needsLegacyConfirmation(share) && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onConfirmLegacy(share)}
          >
            Confirmar
          </Button>
        )}
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onRevoke(share)}>
          {share.direction === 'dada' ? 'Retirar' : 'Deixar de usar'}
        </Button>
      </div>
    )}
  </li>
);

/** As permissões partilhadas com uma empresa, num sentido (dadas por si ou recebidas dela). */
export const ShareGroupCard: React.FC<ShareGroupCardProps> = ({
  otherName,
  direction,
  shares,
  busy,
  onEdit,
  onRevoke,
  onConfirmLegacy,
}) => (
  <li className="rounded-lg border p-4">
    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold">{otherName}</h3>
        <Badge variant="secondary">
          {direction === 'dada' ? 'Vê os seus dados' : 'Partilha consigo'}
        </Badge>
      </div>
      {onEdit && (
        <Button size="sm" variant="outline" disabled={busy} onClick={onEdit}>
          Alterar permissões
        </Button>
      )}
    </div>
    <ul className="divide-y">
      {shares.map(share => (
        <ShareLine
          key={share.share_id}
          share={share}
          busy={busy}
          onRevoke={onRevoke}
          onConfirmLegacy={onConfirmLegacy}
        />
      ))}
    </ul>
  </li>
);
