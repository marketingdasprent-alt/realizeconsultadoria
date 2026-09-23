import React from 'react';
import { format } from 'date-fns';
import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ENTRY_SOURCE_LABELS,
  ENTRY_STATUS_LABELS,
  ENTRY_TYPE_LABELS,
  FLAG_INFO,
  getFlagLabel,
  type TimeClockEntryWithRelations,
} from '@/lib/timeclock';

interface EntryDetailsDialogProps {
  entry: TimeClockEntryWithRelations;
  onClose: () => void;
}

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="grid grid-cols-[130px_1fr] gap-2 py-1 text-sm border-b border-border/50 last:border-0">
    <span className="text-muted-foreground">{label}</span>
    <span className="break-all">{children ?? '—'}</span>
  </div>
);

export const EntryDetailsDialog: React.FC<EntryDetailsDialogProps> = ({ entry, onClose }) => {
  const hasCoords = entry.latitude !== null && entry.longitude !== null;
  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {ENTRY_TYPE_LABELS[entry.entry_type]} ·{' '}
            {format(new Date(entry.punched_at), 'dd/MM/yyyy HH:mm:ss')}
          </DialogTitle>
          <DialogDescription>{entry.employee?.name}</DialogDescription>
        </DialogHeader>

        {entry.flags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {entry.flags.map(flag => (
              <Badge key={flag} variant={FLAG_INFO[flag]?.warning ? 'destructive' : 'secondary'}>
                {getFlagLabel(flag)}
              </Badge>
            ))}
          </div>
        )}

        <div>
          <Row label="Estado">{ENTRY_STATUS_LABELS[entry.status] ?? entry.status}</Row>
          <Row label="Origem">{ENTRY_SOURCE_LABELS[entry.source] ?? entry.source}</Row>
          <Row label="Local">{entry.location?.name}</Row>
          <Row label="Localização">
            {hasCoords ? (
              <a
                href={`https://www.google.com/maps?q=${entry.latitude},${entry.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary underline"
              >
                {entry.latitude?.toFixed(6)}, {entry.longitude?.toFixed(6)}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </Row>
          <Row label="Precisão GPS">
            {entry.accuracy_m !== null ? `${Math.round(entry.accuracy_m)} m` : null}
          </Row>
          <Row label="Distância">
            {entry.distance_m !== null ? `${Math.round(entry.distance_m)} m` : null}
          </Row>
          <Row label="IP">{entry.ip_address}</Row>
          <Row label="País / cidade IP">
            {[entry.ip_country, entry.ip_city].filter(Boolean).join(' / ') || null}
          </Row>
          <Row label="VPN / proxy">
            {entry.ip_is_proxy === null ? 'Não verificado' : entry.ip_is_proxy ? 'Sim' : 'Não'}
          </Row>
          <Row label="Dispositivo">{entry.device_id}</Row>
          <Row label="Navegador">{entry.user_agent}</Row>
          <Row label="Notas">{entry.notes}</Row>
          <Row label="Gravado em">{format(new Date(entry.created_at), 'dd/MM/yyyy HH:mm:ss')}</Row>
        </div>
      </DialogContent>
    </Dialog>
  );
};
