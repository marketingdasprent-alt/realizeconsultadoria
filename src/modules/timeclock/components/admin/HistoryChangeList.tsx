import React from 'react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import {
  ENTRY_STATUS_LABELS,
  ENTRY_TYPE_LABELS,
  HISTORY_ACTION_LABELS,
  type TimeClockHistory,
} from '@/lib/timeclock';

interface HistoryChangeListProps {
  items: TimeClockHistory[];
  /** Nome do colaborador por employee_id (vista global). */
  employeeNames?: Record<string, string>;
}

const FIELD_LABELS: Record<string, string> = {
  punched_at: 'Hora',
  entry_type: 'Tipo',
  status: 'Estado',
  notes: 'Notas',
};

const formatValue = (field: string, value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—';
  if (field === 'punched_at' && typeof value === 'string')
    return format(new Date(value), 'dd/MM/yyyy HH:mm');
  if (field === 'entry_type') return ENTRY_TYPE_LABELS[String(value)] ?? String(value);
  if (field === 'status') return ENTRY_STATUS_LABELS[String(value)] ?? String(value);
  return String(value);
};

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

/** Lista cronológica de alterações com o antes → depois dos campos relevantes. */
export const HistoryChangeList: React.FC<HistoryChangeListProps> = ({ items, employeeNames }) => {
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
        const fields = item.changed_fields.filter(f => FIELD_LABELS[f]);
        return (
          <li key={item.id} className="rounded-lg border border-border p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  item.action === 'void' || item.action === 'delete' ? 'destructive' : 'secondary'
                }
              >
                {HISTORY_ACTION_LABELS[item.action] ?? item.action}
              </Badge>
              <span className="text-muted-foreground">
                {format(new Date(item.changed_at), 'dd/MM/yyyy HH:mm:ss')}
              </span>
              <span>por {item.changed_by_name ?? 'sistema'}</span>
              {employeeNames && (
                <span className="font-medium">
                  · {employeeNames[item.employee_id] ?? 'Colaborador removido'}
                </span>
              )}
            </div>
            {item.action === 'create' && (
              <p className="mt-1 text-muted-foreground">
                {formatValue('entry_type', newData.entry_type)} às{' '}
                {formatValue('punched_at', newData.punched_at)} ({String(newData.source ?? '')})
              </p>
            )}
            {fields.length > 0 && item.action !== 'create' && (
              <ul className="mt-1 space-y-0.5">
                {fields.map(field => (
                  <li key={field}>
                    <span className="text-muted-foreground">{FIELD_LABELS[field]}:</span>{' '}
                    <span className="line-through opacity-70">
                      {formatValue(field, oldData[field])}
                    </span>{' '}
                    → <span className="font-medium">{formatValue(field, newData[field])}</span>
                  </li>
                ))}
              </ul>
            )}
            {item.reason && (
              <p className="mt-1">
                <span className="text-muted-foreground">Motivo:</span> {item.reason}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
};
