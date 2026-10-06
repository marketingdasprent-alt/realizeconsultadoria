import React from 'react';
import { format } from 'date-fns';
import { Download, FileText, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { TimesheetFilters as Filters } from '../../hooks/useTimesheet';
import type { ReportAction } from '../../hooks/useTimesheetPrint';
import { NameSearchInput } from './NameSearchInput';

interface Option {
  id: string;
  name: string;
}

interface TimesheetFiltersProps {
  filters: Filters;
  companies: Option[];
  employees: Option[];
  canEdit: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  busyAction: ReportAction | null;
  onChange: (filters: Filters) => void;
  onCreate: () => void;
  onReport: (action: ReportAction) => void;
}

const ALL = '__all__';

export const TimesheetFilters: React.FC<TimesheetFiltersProps> = ({
  filters,
  companies,
  employees,
  canEdit,
  search,
  onSearchChange,
  busyAction,
  onChange,
  onCreate,
  onReport,
}) => (
  <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
    <NameSearchInput id="ts-search" value={search} onChange={onSearchChange} className="lg:w-64" />
    <div className="space-y-1">
      <Label htmlFor="ts-month">Mês</Label>
      <Input
        id="ts-month"
        type="month"
        className="w-full lg:w-44"
        value={format(filters.month, 'yyyy-MM')}
        onChange={e => {
          if (!e.target.value) return;
          onChange({ ...filters, month: new Date(`${e.target.value}-01T00:00:00`) });
        }}
      />
    </div>
    <div className="space-y-1 lg:w-56">
      <Label>Empresa</Label>
      <Select
        value={filters.companyId ?? ALL}
        onValueChange={v =>
          onChange({ ...filters, companyId: v === ALL ? null : v, employeeId: null })
        }
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todas as empresas</SelectItem>
          {companies.map(c => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
    <div className="space-y-1 lg:w-56">
      <Label>Colaborador</Label>
      <Select
        value={filters.employeeId ?? ALL}
        onValueChange={v => onChange({ ...filters, employeeId: v === ALL ? null : v })}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos</SelectItem>
          {employees.map(e => (
            <SelectItem key={e.id} value={e.id}>
              {e.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
    <div className="flex items-center gap-2 lg:pb-2">
      <Switch
        id="ts-flagged"
        checked={filters.onlyFlagged}
        onCheckedChange={checked => onChange({ ...filters, onlyFlagged: checked })}
      />
      <Label htmlFor="ts-flagged">Só com alertas</Label>
    </div>
    <div className="flex gap-2 lg:ml-auto">
      <Button variant="outline" onClick={() => onReport('view')} disabled={!!busyAction}>
        {busyAction === 'view' ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <FileText className="h-4 w-4 mr-2" />
        )}
        Ver relatório
      </Button>
      <Button variant="outline" onClick={() => onReport('pdf')} disabled={!!busyAction}>
        {busyAction === 'pdf' ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Download className="h-4 w-4 mr-2" />
        )}
        Descarregar PDF
      </Button>
      {canEdit && (
        <Button onClick={onCreate}>
          <Plus className="h-4 w-4 mr-2" /> Novo registo
        </Button>
      )}
    </div>
  </div>
);
