import React, { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useEmployees } from '@/hooks/useEmployees';
import { useTimeClockConfigHistory } from '../../hooks/useTimeClockConfigHistory';
import { useTimeClockHistory } from '../../hooks/useTimeClockHistory';
import { ConfigHistoryList } from './ConfigHistoryList';
import { HistoryChangeList } from './HistoryChangeList';

const PERIODS = [7, 30, 90];

export const HistoryTab: React.FC = () => {
  const [days, setDays] = useState(30);
  const [onlyManual, setOnlyManual] = useState(true);
  const [scope, setScope] = useState<'entries' | 'config'>('entries');
  const entriesHistory = useTimeClockHistory(days);
  const configHistory = useTimeClockConfigHistory(days, scope === 'config');
  const { items } = entriesHistory;
  const { isLoading, error } = scope === 'config' ? configHistory : entriesHistory;
  const { employees } = useEmployees();

  const employeeNames = useMemo(
    () => Object.fromEntries(employees.map(e => [e.id, e.name])),
    [employees]
  );

  // Por defeito esconde os registos criados pelo próprio colaborador (picagens normais).
  const visible = useMemo(
    () =>
      onlyManual
        ? items.filter(item => {
            if (item.action !== 'create') return true;
            const source = (item.new_data as Record<string, unknown> | null)?.source;
            return source === 'admin';
          })
        : items,
    [items, onlyManual]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="space-y-1 sm:w-48">
          <Label>Mostrar</Label>
          <Select value={scope} onValueChange={v => setScope(v as 'entries' | 'config')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="entries">Registos de ponto</SelectItem>
              <SelectItem value="config">Locais e tags</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 sm:w-44">
          <Label>Período</Label>
          <Select value={String(days)} onValueChange={v => setDays(Number(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map(p => (
                <SelectItem key={p} value={String(p)}>
                  Últimos {p} dias
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {scope === 'entries' && (
          <div className="flex items-center gap-2 sm:pb-2">
            <Switch id="hist-manual" checked={onlyManual} onCheckedChange={setOnlyManual} />
            <Label htmlFor="hist-manual">Só alterações de administradores</Label>
          </div>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        O histórico é imutável: cada criação, edição, anulação, aprovação ou alteração de locais e
        tags fica gravada com autor, data e motivo, e não pode ser apagada.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : scope === 'config' ? (
        <ConfigHistoryList items={configHistory.items} />
      ) : (
        <HistoryChangeList items={visible} employeeNames={employeeNames} />
      )}
    </div>
  );
};
