import React from 'react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { ENTRY_STATUS_LABELS, HISTORY_ACTION_LABELS, type TimeClockHistory } from '@/lib/timeclock';
import { getEntryLabel } from '@/lib/workday';

interface HistoryChangeListProps {
  items: TimeClockHistory[];
  /** Nome do colaborador por employee_id (vista global). */
  employeeNames?: Record<string, string>;
}

const FIELD_LABELS: Record<string, string> = {
  punched_at: 'Hora',
  type: 'Tipo',
  status: 'Estado',
  notes: 'Notas',
};

/** entry_type + kind mostrados juntos: Início / Pausa / Retoma / Fim. */
const typeLabel = (data: Record<string, unknown>): string =>
  data.entry_type
    ? getEntryLabel({ entry_type: String(data.entry_type), kind: String(data.kind ?? 'work') })
    : '—';

const changedFields = (fields: string[]): string[] =>
  [...new Set(fields.map(f => (f === 'entry_type' || f === 'kind' ? 'type' : f)))].filter(
    f => FIELD_LABELS[f]
  );

const formatValue = (field: string, value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—';
  if (field === 'punched_at' && typeof value === 'string')
    return format(new Date(value), 'dd/MM/yyyy HH:mm');
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
        const fields = changedFields(item.changed_fields);
        const show = (field: string, data: Record<string, unknown>) =>
          field === 'type' ? typeLabel(data) : formatValue(field, data[field]);
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
                {typeLabel(newData)} às {formatValue('punched_at', newData.punched_at)} (
                {String(newData.source ?? '')})
              </p>
            )}
            {fields.length > 0 && item.action !== 'create' && (
              <ul className="mt-1 space-y-0.5">
                {fields.map(field => (
                  <li key={field}>
                    <span className="text-muted-foreground">{FIELD_LABELS[field]}:</span>{' '}
                    <span className="line-through opacity-70">{show(field, oldData)}</span> →{' '}
                    <span className="font-medium">{show(field, newData)}</span>
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
