import React from 'react';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ENTRY_SOURCE_LABELS, REJECT_REASON_LABELS } from '@/lib/timeclock';
import type { TimeClockAttemptWithRelations } from '../../services/timeClockService';

interface AttemptsTableProps {
  attempts: TimeClockAttemptWithRelations[];
}

const mapsLink = (lat: number | null, lng: number | null) =>
  lat !== null && lng !== null ? `https://www.google.com/maps?q=${lat},${lng}` : null;

/** Tentativas de registo rejeitadas pelo servidor. */
export const AttemptsTable: React.FC<AttemptsTableProps> = ({ attempts }) => {
  if (attempts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">Sem tentativas rejeitadas.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Quando</TableHead>
            <TableHead>Colaborador</TableHead>
            <TableHead>Motivo</TableHead>
            <TableHead>Local</TableHead>
            <TableHead className="text-right">Distância</TableHead>
            <TableHead className="text-right">Precisão</TableHead>
            <TableHead>IP</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {attempts.map(a => {
            const link = mapsLink(a.latitude, a.longitude);
            return (
              <TableRow key={a.id}>
                <TableCell className="whitespace-nowrap">
                  {format(new Date(a.created_at), 'dd/MM HH:mm')}
                </TableCell>
                <TableCell>{a.employee?.name ?? '—'}</TableCell>
                <TableCell>
                  <span className="font-medium">{REJECT_REASON_LABELS[a.reason] ?? a.reason}</span>
                  <span className="block text-xs text-muted-foreground">
                    {ENTRY_SOURCE_LABELS[a.source ?? ''] ?? a.source}
                  </span>
                </TableCell>
                <TableCell>{a.location?.name ?? '—'}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {link ? (
                    <a
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline"
                    >
                      {a.distance_m !== null ? `${Math.round(a.distance_m)} m` : 'mapa'}
                    </a>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {a.accuracy_m !== null ? `${Math.round(a.accuracy_m)} m` : '—'}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs">
                  {a.ip_address ?? '—'} {a.ip_country && `(${a.ip_country})`}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
