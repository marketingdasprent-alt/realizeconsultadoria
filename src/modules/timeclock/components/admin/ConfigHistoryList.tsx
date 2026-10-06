import React from 'react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { HISTORY_ACTION_LABELS, type TimeClockConfigHistory } from '@/lib/timeclock';

interface ConfigHistoryListProps {
  items: TimeClockConfigHistory[];
}

const TABLE_LABELS: Record<string, string> = {
  time_clock_locations: 'Local',
  time_clock_tags: 'Tag NFC',
};

const FIELD_LABELS: Record<string, string> = {
  name: 'Nome',
  label: 'Nome',
  address: 'Morada',
  latitude: 'Latitude',
  longitude: 'Longitude',
  radius_m: 'Raio (m)',
  max_accuracy_m: 'Precisão máx. (m)',
  allow_manual: 'Registo manual',
  block_vpn: 'Bloquear VPN',
  trusted_ips: 'IPs da rede',
  is_active: 'Ativo',
  location_id: 'Local',
  company_id: 'Empresa',
  token_hash: 'Código da tag',
};

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

const formatValue = (field: string, value: unknown): string => {
  if (field === 'token_hash') return 'regenerado';
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  return String(value);
};

/** Alterações a locais e tags: quem mudou o raio, desligou uma tag, etc. */
export const ConfigHistoryList: React.FC<ConfigHistoryListProps> = ({ items }) => {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">Sem alterações registadas.</p>
    );
  }

  return (
    <ol className="space-y-3">
      {items.map(item => {
        const oldData = asRecord(item.old_data);
        const newData = asRecord(item.new_data);
        const name = newData.name ?? newData.label ?? oldData.name ?? oldData.label;
        const fields = item.changed_fields.filter(f => FIELD_LABELS[f]);
        return (
          <li key={item.id} className="rounded-lg border border-border p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={item.action === 'delete' ? 'destructive' : 'secondary'}>
                {HISTORY_ACTION_LABELS[item.action] ?? item.action}
              </Badge>
              <span className="font-medium">
                {TABLE_LABELS[item.table_name] ?? item.table_name} · {String(name ?? '—')}
              </span>
              <span className="text-muted-foreground">
                {format(new Date(item.changed_at), 'dd/MM/yyyy HH:mm:ss')}
              </span>
              <span>por {item.changed_by_name ?? 'sistema'}</span>
            </div>
            {item.action === 'update' && fields.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {fields.map(field => (
                  <li key={field}>
                    <span className="text-muted-foreground">{FIELD_LABELS[field]}:</span>{' '}
                    {field !== 'token_hash' && (
                      <>
                        <span className="line-through opacity-70">
                          {formatValue(field, oldData[field])}
                        </span>{' '}
                        →{' '}
                      </>
                    )}
                    <span className="font-medium">{formatValue(field, newData[field])}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
};
