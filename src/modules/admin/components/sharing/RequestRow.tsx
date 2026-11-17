import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  REQUEST_STATUS_LABEL,
  capabilityLabel,
  daysUntil,
  type Capability,
  type RequestDirection,
  type ShareRequest,
} from '../../lib/sharing';

interface RequestRowProps {
  request: ShareRequest;
  direction: RequestDirection;
  catalog: readonly Capability[];
  busy: boolean;
  onApprove: (request: ShareRequest) => void;
  onReject: (request: ShareRequest) => void;
  onCancel: (request: ShareRequest) => void;
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('pt-PT');

const CapabilityList: React.FC<{
  title: string;
  items: string[];
  catalog: readonly Capability[];
}> = ({ title, items, catalog }) =>
  items.length === 0 ? null : (
    <div>
      <p className="text-sm font-medium">{title}</p>
      <ul className="list-disc pl-5 text-sm text-muted-foreground">
        {items.map(item => (
          <li key={item}>{capabilityLabel(item, catalog)}</li>
        ))}
      </ul>
    </div>
  );

/** Um pedido de ligação, recebido (decide-se) ou enviado (só se acompanha ou cancela). */
export const RequestRow: React.FC<RequestRowProps> = ({
  request,
  direction,
  catalog,
  busy,
  onApprove,
  onReject,
  onCancel,
}) => {
  const open = request.status === 'pedido';
  const received = direction === 'received';
  // Quem pede só fica a saber o nome da outra empresa depois de aprovado (por desenho).
  const name =
    request.other_company_name ?? (received ? 'Empresa sem nome' : 'Empresa por confirmar');

  return (
    <li className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold">{name}</p>
          <p className="text-xs text-muted-foreground">
            Pedido de {formatDate(request.created_at)}
            {open && ` · expira em ${daysUntil(request.expires_at)} dias`}
            {request.decided_at && ` · decidido a ${formatDate(request.decided_at)}`}
          </p>
        </div>
        <Badge variant={open ? 'default' : 'secondary'}>
          {REQUEST_STATUS_LABEL[request.status]}
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <CapabilityList
          title={received ? 'Pede-lhe' : 'Pediu'}
          items={request.ask}
          catalog={catalog}
        />
        <CapabilityList
          title={received ? 'Oferece-lhe' : 'Ofereceu'}
          items={request.offer}
          catalog={catalog}
        />
      </div>
      {request.decision_note && (
        <p className="text-sm">
          <span className="font-medium">Nota: </span>
          {request.decision_note}
        </p>
      )}

      {open && (
        <div className="flex flex-wrap gap-2">
          {received ? (
            <>
              <Button size="sm" variant="gold" disabled={busy} onClick={() => onApprove(request)}>
                Aprovar
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => onReject(request)}>
                Recusar
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onCancel(request)}>
              Cancelar pedido
            </Button>
          )}
        </div>
      )}
    </li>
  );
};
